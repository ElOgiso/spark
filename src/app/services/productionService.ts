import { IProductionService } from "../domain/contracts";
import { Production, Asset, ViralSpark, Brand, Character, MemoryItem, ReviewItem, ProductionBrief, getEffectiveFormatSettings, AutomationMode, ProductionAsset } from "../domain/types";
import { loadPersistedState, savePersistedState } from "../state/persistence";
import { ProductionBriefService } from "./production/productionBriefService";
import { ProductionAssetService, isDurableMasterVideoReady } from "./production/productionAssetService";
import { canStartAssetGeneration } from "./production/characterSheetGate";
import { generateUuid } from "../backend/mappers/workspaceMappers";
import { createProductionPlan } from "./production/intelligence/productionOrchestrator";
import { executeProduction } from "./production/execution/productionExecutor";
import { createRuntimeAdapterPorts } from "./production/execution/runtimePorts";
import {
  runQcWithRepairLoop,
  type ShotObservationInput,
} from "./production/qc";
import type { SparkAutomationMode } from "./production/qc/types";
import {
  runEditorialPipeline,
  assembleEditorialTimeline,
} from "./production/editorial";
import type { ProductionSpec } from "./production/specification/productionSpec";

const defaultProductions: Production[] = [];
const defaultAssets: Asset[] = [];

export class ProductionService implements IProductionService {
  private getFullState() {
    return loadPersistedState<any>() || {};
  }

  private saveFullState(updates: any) {
    const current = this.getFullState();
    savePersistedState({ ...current, ...updates });
  }

  isProductionGenerationEnabled(): boolean {
    if (typeof localStorage === "undefined") return true;
    try {
      const val = localStorage.getItem("spark_production_generation_enabled");
      return val !== "false";
    } catch {
      return true;
    }
  }

  setProductionGenerationEnabled(enabled: boolean): void {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem("spark_production_generation_enabled", String(enabled));
    } catch (err) {
      console.warn("[ProductionService] Toggle save notice:", err);
    }
  }

  async getProductions(): Promise<Production[]> {
    const state = this.getFullState();
    if (!state.productions) {
      this.saveFullState({ productions: defaultProductions });
      return defaultProductions;
    }
    return state.productions;
  }

  async createProduction(productionData: Omit<Production, "id" | "dateCreated">): Promise<Production> {
    const productions = await this.getProductions();
    const newProduction: Production = {
      ...productionData,
      id: generateUuid(),
      dateCreated: new Date().toISOString().split("T")[0]
    };
    const updated = [newProduction, ...productions];
    this.saveFullState({ productions: updated });
    return newProduction;
  }

  /**
   * Extension: Creates a complete Production + ReviewItem + ProductionBrief from a ViralSpark
   */
  async createProductionFromSpark(params: {
    spark: ViralSpark;
    brand: Brand;
    character?: Character;
    characters?: Character[];
    niche?: string;
    memoryItems?: MemoryItem[];
    productionMode?: string;
    productionId?: string;
    reviewId?: string;
    researchContext?: any;
    targetDurationSec?: number;
  }): Promise<{ production: Production; reviewItem: ReviewItem; brief: ProductionBrief }> {
    const prodId = params.productionId || generateUuid();
    const reviewId = params.reviewId || generateUuid();
    const dateStr = new Date().toISOString().split("T")[0];

    const effectiveFormat = getEffectiveFormatSettings({
      formatSettings: (params.brand as any)?.formatSettings,
      brand: params.brand,
    });
    const resolvedMode = (params.productionMode as any) || "standard";
    const aspectRatio = effectiveFormat.aspectMode === "landscape" ? "16:9" : "9:16";

    // Phase 2: Creative Director planning FIRST (no media generation).
    const plan = createProductionPlan({
      idea: params.spark.hook || params.spark.title || params.spark.angle || "",
      productionId: prodId,
      brand: params.brand,
      character: params.character || params.characters?.[0],
      spark: params.spark,
      memoryItems: params.memoryItems,
      productionMode: resolvedMode,
      preferredAspectRatio: aspectRatio as "9:16" | "16:9",
      targetDurationSec:
        typeof params.targetDurationSec === "number"
          ? params.targetDurationSec
          : params.brand.formatSettings?.targetDurationSec,
    });

    // Existing brief service remains for script polish / brand-fit; intelligence owns structure.
    const llmBrief = await ProductionBriefService.generateBrief(params);

    const targetDurationSec =
      typeof params.targetDurationSec === "number"
        ? params.targetDurationSec
        : typeof plan.spec?.project.targetDurationSec === "number"
          ? plan.spec.project.targetDurationSec
          : typeof llmBrief.targetDurationSec === "number"
            ? llmBrief.targetDurationSec
            : effectiveFormat.targetDurationSec || 60;

    const brief: ProductionBrief = {
      ...llmBrief,
      ...(plan.ok && plan.brief
        ? {
            storyboard: plan.brief.storyboard,
            beats: plan.brief.beats,
            visualDirection: plan.brief.visualDirection || llmBrief.visualDirection,
            platformRecommendation: plan.brief.platformRecommendation || llmBrief.platformRecommendation,
            suggestedDuration: plan.brief.suggestedDuration || llmBrief.suggestedDuration,
            whyThisWorks: llmBrief.whyThisWorks || plan.brief.whyThisWorks,
          }
        : {}),
      title: llmBrief.title || plan.brief?.title || params.spark.title,
      hook: llmBrief.hook || plan.brief?.hook || params.spark.hook || params.spark.title,
      scriptOutline: llmBrief.scriptOutline || plan.brief?.scriptOutline || "",
      spokenCta: llmBrief.spokenCta || plan.brief?.spokenCta,
      onScreenCta: llmBrief.onScreenCta || plan.brief?.onScreenCta,
      caption: llmBrief.caption || plan.brief?.caption || "",
      brandFitScore: llmBrief.brandFitScore,
      researchContext: llmBrief.researchContext || params.researchContext || params.spark.researchContext,
      contentSource: llmBrief.contentSource,
      formatSettings: { ...effectiveFormat, targetDurationSec },
      targetDurationSec,
      productionMode: resolvedMode,
    };

    const platformRec = brief.platformRecommendation || params.spark.platformFit || "YouTube Shorts";
    const formats = platformRec.split(" + ").map((s) => s.trim()).filter(Boolean);

    const production: Production = {
      id: prodId,
      title: brief.title || params.spark.title,
      sparkId: params.spark.id,
      status: "Ready for Review",
      mode: resolvedMode,
      productionMode: resolvedMode,
      targetDurationSec,
      formatSettings: { ...effectiveFormat, targetDurationSec },
      dateCreated: dateStr,
      aspectRatio,
      formats,
      brief,
      productionScenes: brief.storyboard,
      scenes: (brief.storyboard || []).slice(0, 3).map((s, i) => ({
        scene: i + 1,
        description: s.visualDescription || s.scriptSnippet || `Scene ${i + 1}`,
        duration: s.duration || `${s.durationSec || 5}s`,
        image: s.image,
        videoUrl: s.videoUrl,
      })),
      reasoning: {
        productionSpec: plan.spec,
        approvalSummary: plan.spec?.approvalSummary,
        grammarIds: plan.spec?.meta?.grammarIds || plan.trace.selectedGrammarIds,
        productionIntelligenceTrace: plan.trace,
        productionIntelligenceOk: plan.ok,
        creativeDirection: plan.directed.direction,
        generationTaskCount: plan.generationTasks?.length,
        routedShots: plan.trace.routedShots,
      },
    };

    const reviewItem: ReviewItem = {
      id: reviewId,
      productionId: prodId,
      title: brief.title || params.spark.title,
      account: formats[0] || "YouTube Shorts",
      series: "Viral Concept Series",
      status: "Pending Review",
      dateCreated: dateStr,
      scriptSnippet: brief.hook,
      conceptText: brief.whyThisWorks,
      openingMoment: brief.visualDirection,
      qualityCheck: { brandSafety: "Passed", policyCheck: "Passed", technicalCheck: "Passed" },
      brief,
      whyThisWorks: brief.whyThisWorks,
    };

    // Save state
    const state = this.getFullState();
    const currentProds: Production[] = state.productions || [];
    const currentReviews: ReviewItem[] = state.reviewItems || [];

    this.saveFullState({
      productions: [production, ...currentProds.filter((p) => p.id !== prodId)],
      reviewItems: [reviewItem, ...currentReviews.filter((r) => r.id !== reviewId)],
    });

    return { production, reviewItem, brief };
  }

  /**
   * Executive Trigger: Generates complete multi-scene storyboard, voiceover, and thumbnail assets
   */
  async generateAssetsForProduction(params: {
    production: Production;
    brand: Brand;
    character?: Character;
    characters?: Character[];
    memoryItems?: MemoryItem[];
    creditSettings?: import("../domain/types").GenerationCreditSettings;
    onProgress?: (progress: import("../domain/types").GenerationProgress) => void;
    forceRegenerate?: boolean;
    signal?: AbortSignal;
  }): Promise<{ production: Production; brief: ProductionBrief }> {
    const { production, brand, character, characters, memoryItems = [], creditSettings, onProgress, forceRegenerate, signal } = params;
    if (!production.brief) {
      throw new Error("Production brief must exist before generating assets.");
    }

    const gate = canStartAssetGeneration({
      production,
      brief: production.brief,
      brand,
      character,
      formatSettings: (production as any)?.formatSettings || production.brief?.formatSettings,
    });

    if (!gate.allowed) {
      console.warn(`[ProductionService] Asset generation gated (${gate.contentFormat}): ${gate.reason}`);
      const updatedBrief: ProductionBrief = {
        ...production.brief,
        lastError: gate.reason,
      };
      const gatedProd: Production = {
        ...production,
        brief: updatedBrief,
        lastError: gate.reason,
        status: "Failed",
        isGeneratingAssets: false,
      };
      return { production: gatedProd, brief: updatedBrief };
    }

    const handleProgress = (prog: import("../domain/types").GenerationProgress) => {
      onProgress?.(prog);
      const state = this.getFullState();
      const currentProds: Production[] = state.productions || [];
      const currentReviews: ReviewItem[] = state.reviewItems || [];
      const partialVideoUrl = prog.partialAssets?.videoUrl || production.videoUrl;
      const partialAudioUrl = prog.partialAssets?.voiceUrl || production.audioUrl;

      this.saveFullState({
        productions: currentProds.map((p) =>
          p.id === production.id
            ? {
                ...p,
                videoUrl: partialVideoUrl || p.videoUrl,
                audioUrl: partialAudioUrl || p.audioUrl,
                generationProgress: prog,
                isGeneratingAssets: prog.stage !== "Complete" && prog.stage !== "Failed",
              }
            : p
        ),
        reviewItems: currentReviews.map((r) =>
          r.productionId === production.id
            ? {
                ...r,
                videoUrl: partialVideoUrl || r.videoUrl,
                audioUrl: partialAudioUrl || r.audioUrl,
                status: "Pending Review",
              }
            : r
        ),
      });
    };

    const result = await ProductionAssetService.generateAssets({
      production,
      brief: production.brief,
      brand,
      character,
      characters,
      memoryItems,
      creditSettings,
      onProgress: handleProgress,
      forceRegenerate,
      signal,
    });

    const isVideoSuccess = Boolean(result.videoUrl && isDurableMasterVideoReady(result.videoUrl));
    const finalProdStatus = isVideoSuccess ? "Ready for Review" : "Failed";

    const updatedProd: Production = {
      ...production,
      id: production.id,
      status: finalProdStatus,
      targetDurationSec: result.brief.targetDurationSec || (production as any).targetDurationSec || 60,
      productionMode: (result.brief.productionMode || production.productionMode || production.mode || "standard") as any,
      formatSettings: result.brief.formatSettings || production.formatSettings,
      brief: result.brief,
      scenes: result.scenes,
      productionScenes: result.productionScenes || production.productionScenes,
      audioUrl: result.audioUrl,
      videoUrl: result.videoUrl,
      isGeneratingAssets: false,
      generationProgress: result.brief.generatedAssets?.generationProgress,
    };

    const state = this.getFullState();
    const currentProds: Production[] = state.productions || [];
    const currentReviews: ReviewItem[] = state.reviewItems || [];

    this.saveFullState({
      productions: currentProds.map((p) => (p.id === production.id ? updatedProd : p)),
      reviewItems: currentReviews.map((r) =>
        r.productionId === production.id
          ? {
              ...r,
              brief: result.brief,
              videoUrl: result.videoUrl || r.videoUrl,
              openingMoment: result.brief.storyboard?.[0]?.visualDescription || r.openingMoment,
            }
          : r
      ),
    });

    return { production: updatedProd, brief: result.brief };
  }

  /**
   * Executive Action: Cancels active production asset generation cleanly
   */
  async cancelProduction(id: string): Promise<Production> {
    const productions = await this.getProductions();
    let updatedProd: Production | null = null;
    const updated = productions.map((p) => {
      if (p.id === id) {
        updatedProd = { ...p, status: "Cancelled", isGeneratingAssets: false };
        return updatedProd;
      }
      return p;
    });

    if (!updatedProd) {
      throw new Error(`Production with id ${id} not found`);
    }

    const state = this.getFullState();
    const currentReviews: ReviewItem[] = state.reviewItems || [];
    this.saveFullState({
      productions: updated,
      reviewItems: currentReviews.map((r) =>
        r.productionId === id ? { ...r, status: "Needs Edit" } : r
      ),
    });

    return updatedProd;
  }

  async updateProductionStatus(id: string, status: Production["status"]): Promise<Production> {
    const productions = await this.getProductions();
    let updatedProd: Production | null = null;
    const updated = productions.map((p) => {
      if (p.id === id) {
        updatedProd = { ...p, status, isGeneratingAssets: false };
        return updatedProd;
      }
      return p;
    });
    if (!updatedProd) {
      throw new Error(`Production with id ${id} not found`);
    }
    this.saveFullState({ productions: updated });
    return updatedProd;
  }

  async getAssets(): Promise<Asset[]> {
    const state = this.getFullState();
    if (!state.assets) {
      this.saveFullState({ assets: defaultAssets });
      return defaultAssets;
    }
    return state.assets;
  }

  async addAsset(name: string, type: Asset["type"], size: string): Promise<Asset> {
    const assets = await this.getAssets();
    const newAsset: Asset = {
      id: `as-${Date.now()}`,
      name,
      type,
      size,
      url: "#"
    };
    const updated = [newAsset, ...assets];
    this.saveFullState({ assets: updated });
    return newAsset;
  }

  /**
   * Phase 4 — execute planned GenerationTask DAG for a production that already has a ProductionSpec.
   * Phase 5 — optionally runs intelligent QC (+ repair loop per automation mode).
   * Preserves existing generateAssetsForProduction path; this is the Spec→Task→Asset execution entry.
   * Does not redesign UI — stores execution + QC summary on production.reasoning.
   */
  async executeProductionPlan(params: {
    production: Production;
    brand?: Brand;
    dryRun?: boolean;
    signal?: AbortSignal;
    enableQc?: boolean;
    automationMode?: AutomationMode;
  }): Promise<{
    production: Production;
    ok: boolean;
    state: string;
    assetCount: number;
    qcVerdict?: string;
  }> {
    const reasoning =
      typeof params.production.reasoning === "object" && params.production.reasoning
        ? params.production.reasoning
        : {};
    const spec = (reasoning as any).productionSpec as ProductionSpec | undefined;
    if (!spec) {
      throw new Error("ProductionSpec missing — run createProductionFromSpark / planning first");
    }

    if (params.signal?.aborted) {
      throw new Error("Aborted");
    }

    const result = await executeProduction(spec, {
      brandId: params.brand?.id || params.production.brandId,
      dryRun: params.dryRun === true,
      ports: params.dryRun ? undefined : createRuntimeAdapterPorts(),
      sleep: params.dryRun ? async () => undefined : undefined,
    });

    let qcSummary: Record<string, unknown> | undefined;
    let qcVerdict: string | undefined;
    let finalSpec = result.spec;

    if (params.enableQc !== false && !params.dryRun && result.ok) {
      const observations: ShotObservationInput[] = [];
      for (const asset of result.assets) {
        if (!asset.shotId) continue;
        observations.push({
          shotId: asset.shotId,
          mediaType:
            asset.assetType === "image" || asset.assetType === "frame" || asset.assetType === "thumbnail"
              ? "image"
              : asset.assetType === "audio"
                ? "audio"
                : "video",
          sourceUrl: asset.publicUrl,
          assetId: asset.id,
          taskId: asset.taskId,
          technical: { ok: true, reasons: [], retryable: false },
        });
      }
      for (const scene of result.spec.scenes) {
        for (const shot of scene.shots) {
          if (observations.some((o) => o.shotId === shot.id)) continue;
          if (shot.mediaUrl || shot.keyframeUrl) {
            observations.push({
              shotId: shot.id,
              mediaType: shot.mediaUrl ? "video" : "image",
              sourceUrl: shot.mediaUrl || shot.keyframeUrl,
              technical: { ok: true, reasons: [], retryable: false },
            });
          }
        }
      }

      const mode = (params.automationMode ||
        params.brand?.automation_mode ||
        "balanced") as SparkAutomationMode;

      const qc = await runQcWithRepairLoop(result.spec, {
        automationMode: mode,
        observations,
        // Dry-run / unit paths: no live re-execution — repair decisions still recorded
        reexecute: undefined,
      });

      finalSpec = qc.finalSpec;
      qcVerdict = qc.report.verdict;
      qcSummary = {
        verdict: qc.report.verdict,
        status: qc.report.productionResult.status,
        score: qc.report.productionResult.score,
        scores: qc.report.productionResult.scores,
        userMessage: qc.report.productionResult.userMessage,
        stoppedReason: qc.stoppedReason,
        shotCount: qc.report.shotResults.length,
        sceneCount: qc.report.sceneResults.length,
        repairsApplied: qc.repairsApplied.map((r) => ({
          action: r.action,
          providerChange: r.providerChange,
          reason: r.reason,
        })),
        budget: qc.budget,
        // Developer diagnostics only — no secrets
        failures: qc.report.productionResult.failures.map((f) => ({
          code: f.code,
          dimension: f.dimension,
          message: f.message,
        })),
      };
    }

    const ready =
      result.productionState === "completed" &&
      (qcVerdict === undefined || qcVerdict === "production_ready");

    const updated: Production = {
      ...params.production,
      reasoning: {
        ...reasoning,
        productionSpec: finalSpec,
        productionExecution: {
          state: result.productionState,
          ok: result.ok,
          errors: result.errors,
          executionCount: result.executions.length,
          assetCount: result.assets.length,
          taskStatuses: result.tasks.map((t) => ({ id: t.id, kind: t.kind, status: t.status })),
        },
        ...(qcSummary ? { productionQc: qcSummary } : {}),
      },
      status: ready
        ? "Ready for Review"
        : result.productionState === "failed" || qcVerdict === "production_failed"
          ? "Failed"
          : qcVerdict === "production_needs_review"
            ? "Needs Edit"
            : params.production.status,
    };

    const state = this.getFullState();
    const currentProds: Production[] = state.productions || [];
    this.saveFullState({
      productions: currentProds.map((p) => (p.id === updated.id ? updated : p)).concat(
        currentProds.some((p) => p.id === updated.id) ? [] : [updated]
      ),
    });

    return {
      production: updated,
      ok: result.ok && (qcVerdict === undefined || qcVerdict === "production_ready"),
      state: result.productionState,
      assetCount: result.assets.length,
      qcVerdict,
    };
  }

  /**
   * Phase 6 — assemble editorial timeline (+ optional mastering) from ProductionSpec + assets.
   * Does not redesign UI — stores editorial summary on production.reasoning.editorial.
   */
  async assembleEditorialForProduction(params: {
    production: Production;
    brand?: Brand;
    assets?: ProductionAsset[];
    automationMode?: AutomationMode;
    master?: boolean;
    variantId?: string;
  }): Promise<{
    production: Production;
    ok: boolean;
    timelineId?: string;
    decision?: string;
    masterUrl?: string;
  }> {
    const reasoning =
      typeof params.production.reasoning === "object" && params.production.reasoning
        ? params.production.reasoning
        : {};
    const spec = (reasoning as any).productionSpec as ProductionSpec | undefined;
    if (!spec) {
      throw new Error("ProductionSpec missing — run planning first");
    }

    const qcVerdict = (reasoning as any).productionQc?.verdict as
      | "production_ready"
      | "production_needs_review"
      | "production_failed"
      | undefined;

    const assets = params.assets || resultAssetsFromExecution(reasoning) || [];

    const pipeline = await runEditorialPipeline(spec, {
      assets,
      qcVerdict,
      automationMode: (params.automationMode ||
        params.brand?.automation_mode ||
        "balanced") as SparkAutomationMode,
      master: params.master === true,
      variantId: params.variantId,
      brandId: params.brand?.id || params.production.brandId,
    });

    const updated: Production = {
      ...params.production,
      reasoning: {
        ...reasoning,
        productionSpec: spec,
        editorial: {
          timelineId: pipeline.timeline.id,
          status: pipeline.timeline.status,
          durationFrames: pipeline.timeline.durationFrames,
          frameRate: pipeline.timeline.frameRate,
          aspectRatio: pipeline.timeline.aspectRatio,
          validationStatus: pipeline.validation.status,
          validationScore: pipeline.validation.score,
          decision: pipeline.decision.action,
          allowMaster: pipeline.decision.allowMaster,
          userMessage: pipeline.decision.userMessage || pipeline.timeline.userMessage,
          unresolvedCount: pipeline.timeline.unresolvedDependencies.length,
          variantIds: pipeline.timeline.variants.map((v) => v.id),
          mastering: pipeline.mastering
            ? {
                ok: pipeline.mastering.ok,
                jobId: pipeline.mastering.job.id,
                jobStatus: pipeline.mastering.job.status,
                deferred: pipeline.mastering.deferred,
                masterId: pipeline.mastering.output?.masterId,
                mediaUrl: pipeline.mastering.output?.mediaUrl,
                userMessage: pipeline.mastering.userMessage,
              }
            : undefined,
        },
      },
      status:
        pipeline.mastering?.ok
          ? "Ready for Review"
          : pipeline.decision.requireReview
            ? "Needs Edit"
            : params.production.status,
    };

    const state = this.getFullState();
    const currentProds: Production[] = state.productions || [];
    this.saveFullState({
      productions: currentProds.map((p) => (p.id === updated.id ? updated : p)).concat(
        currentProds.some((p) => p.id === updated.id) ? [] : [updated]
      ),
    });

    return {
      production: updated,
      ok: pipeline.ok,
      timelineId: pipeline.timeline.id,
      decision: pipeline.decision.action,
      masterUrl: pipeline.mastering?.output?.mediaUrl,
    };
  }

  /** Planned editorial preview from spec only (no assets) — for existing surfaces */
  previewEditorialTimeline(production: Production) {
    const reasoning =
      typeof production.reasoning === "object" && production.reasoning ? production.reasoning : {};
    const spec = (reasoning as any).productionSpec as ProductionSpec | undefined;
    if (!spec) return null;
    return assembleEditorialTimeline(spec, { allowPlannedWithoutAssets: true });
  }
}

function resultAssetsFromExecution(reasoning: Record<string, unknown>): ProductionAsset[] {
  // Assets are typically persisted separately; execution summary does not embed blobs.
  void reasoning;
  return [];
}

export const productionService = new ProductionService();
