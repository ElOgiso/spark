import { IProductionService } from "../domain/contracts";
import { Production, Asset, ViralSpark, Brand, Character, MemoryItem, ReviewItem, ProductionBrief, getEffectiveFormatSettings, AutomationMode, ProductionAsset } from "../domain/types";
import { loadPersistedState, savePersistedState } from "../state/persistence";
import { ProductionBriefService } from "./production/productionBriefService";
import { ProductionAssetService, isDurableMasterVideoReady } from "./production/productionAssetService";
import { canStartAssetGeneration } from "./production/characterSheetGate";
import { ProductionGenerationGuard } from "./production/ProductionGenerationGuard";
import { isProductionTombstoned } from "./production/productionTombstone";
import { generateUuid } from "../backend/mappers/workspaceMappers";
import { createProductionPlan } from "./production/intelligence/productionOrchestrator";
import {
  buildProductionSettingsSnapshot,
  attachProductionSettingsSnapshot,
} from "./production/productionSettingsSnapshot";
import { executeProduction } from "./production/execution/productionExecutor";
import {
  resolveProductionSpec,
  createLiveAssetExecuteAdapter,
  runProductionLifecycle,
  type ProductionLifecycleReport,
  type RunProductionLifecycleOptions,
} from "./production/execution";
import { createRuntimeAdapterPorts } from "./production/execution/runtimePorts";
import {
  runQcWithRepairLoop,
  type ShotObservationInput,
} from "./production/qc";
import type { SparkAutomationMode } from "./production/qc/types";
import {
  runEditorialPipeline,
  assembleEditorialTimeline,
  createExistingMasterPassthroughAdapter,
} from "./production/editorial";
import type { ProductionSpec } from "./production/specification/productionSpec";
import {
  runLearningUpdatePipeline,
  buildOutcomeFromLifecycle,
  type CreativeLearning,
  type LearningUpdateInput,
  type PerformanceSnapshot,
} from "./production/intelligence";
import {
  mergeSpecBeatsWithBriefBeats,
  mergeSpecStoryboardWithBriefScript,
} from "./production/directorScriptAuthority";

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
    return ProductionGenerationGuard.isEnabled();
  }

  setProductionGenerationEnabled(enabled: boolean): void {
    ProductionGenerationGuard.setEnabled(enabled);
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
    /** Optional series linkage and story canon context */
    seriesContext?: {
      series?: import("../domain/types").ProductionSeries;
      canon?: import("../domain/types").StoryCanon;
      episodeNumber?: number;
    };
    /** Phase 11 — optional prior learnings for Creative Director (soft influence only). */
    creativeLearnings?: CreativeLearning[];
  }): Promise<{ production: Production; reviewItem: ReviewItem; brief: ProductionBrief }> {
    ProductionGenerationGuard.assertEnabled("createProductionFromSpark", params.brand?.id);
    const prodId = params.productionId || generateUuid();
    const reviewId = params.reviewId || generateUuid();
    const dateStr = new Date().toISOString().split("T")[0];

    const effectiveFormat = getEffectiveFormatSettings({
      formatSettings: (params.brand as any)?.formatSettings,
      brand: params.brand,
    });
    const resolvedMode = (params.productionMode as any) || "standard";
    const aspectRatio = effectiveFormat.aspectMode === "landscape" ? "16:9" : "9:16";

    // Brief polish FIRST so Spec shot prompts inherit cleaned beats (not raw research meta).
    const llmBrief = await ProductionBriefService.generateBrief(params);

    const polishedSpark: ViralSpark = {
      ...params.spark,
      title: llmBrief.title || params.spark.title,
      hook: llmBrief.hook || params.spark.hook,
      whyNow: llmBrief.whyThisWorks || params.spark.whyNow,
      angle: params.spark.angle,
      suggestedFormat: llmBrief.platformRecommendation || params.spark.suggestedFormat,
      suggestedProductionMode:
        (llmBrief.productionMode as string) || params.spark.suggestedProductionMode,
      status: "ready",
    };

    // Phase 2: Creative Director planning uses polished brief/spark — never raw meta hooks.
    const plan = createProductionPlan({
      idea: polishedSpark.hook || polishedSpark.title || polishedSpark.angle || "",
      productionId: prodId,
      brand: params.brand,
      character: params.character || params.characters?.[0],
      spark: polishedSpark,
      memoryItems: params.memoryItems,
      productionMode: resolvedMode,
      automationMode: params.brand?.automation_mode,
      preferredAspectRatio: aspectRatio as "9:16" | "16:9",
      targetDurationSec:
        typeof params.targetDurationSec === "number"
          ? params.targetDurationSec
          : typeof llmBrief.targetDurationSec === "number"
            ? llmBrief.targetDurationSec
            : params.brand.formatSettings?.targetDurationSec,
      creativeLearnings: params.creativeLearnings,
    });

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
            // Spec owns structure/camera; LLM brief owns spoken script authority
            storyboard: mergeSpecStoryboardWithBriefScript({
              specStoryboard: plan.brief.storyboard,
              briefStoryboard: llmBrief.storyboard,
              briefBeats: llmBrief.beats,
              hook: llmBrief.hook || params.spark.hook,
            }),
            beats: mergeSpecBeatsWithBriefBeats({
              specBeats: plan.brief.beats,
              briefBeats: llmBrief.beats,
              hook: llmBrief.hook || params.spark.hook,
            }),
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

    // Phase C: never mark Ready for Review before media truth exists.
    // Generation ON → Generating; Generation OFF → Drafting (brief/plan only).
    const createStatus: Production["status"] = ProductionGenerationGuard.isEnabled(params.brand?.id)
      ? "Generating"
      : "Drafting";

    let production: Production = {
      id: prodId,
      title: brief.title || params.spark.title,
      sparkId: params.spark.id,
      status: createStatus,
      isGeneratingAssets: ProductionGenerationGuard.isEnabled(params.brand?.id),
      mode: resolvedMode,
      productionMode: resolvedMode,
      targetDurationSec,
      formatSettings: { ...effectiveFormat, targetDurationSec },
      dateCreated: dateStr,
      aspectRatio,
      formats,
      seriesId: params.seriesContext?.series?.id,
      seasonNumber: params.seriesContext?.series?.currentSeason,
      episodeNumber: params.seriesContext?.episodeNumber || params.seriesContext?.series?.currentEpisode,
      canonState: params.seriesContext?.canon || params.seriesContext?.series?.storyCanon,
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
        // Phase 7 — concise creative strategy for existing REVIEW/production surfaces
        creativeStrategy: plan.directed.strategy
          ? {
              id: plan.directed.strategy.id,
              format: plan.directed.strategy.format,
              objective: plan.directed.strategy.objective.objective,
              hookType: plan.directed.strategy.hook.type,
              complexity: plan.directed.strategy.complexity.level,
              optimizationProfile: plan.directed.strategy.optimizationProfile,
              preflightStatus: plan.directed.preflight?.status,
              preflightScore: plan.directed.preflight?.score,
              userMessage: plan.directed.strategy.userFacingSummary,
              confidence: plan.directed.strategy.confidence,
            }
          : undefined,
      },
    };

    
    const settingsSnapshot = buildProductionSettingsSnapshot({
      brand: params.brand,
      spark: params.spark,
      character: params.character || params.characters?.[0],
      characters: params.characters,
      memoryItems: params.memoryItems,
      formatSettings: { ...effectiveFormat, targetDurationSec },
      creditSettings: (params.brand as any)?.creditSettings,
      productionMode: resolvedMode,
      automationMode: params.brand?.automation_mode,
    });
    production = attachProductionSettingsSnapshot(production, settingsSnapshot);

    const reviewItem: ReviewItem = {
      id: reviewId,
      productionId: prodId,
      title: brief.title || params.spark.title,
      account: formats[0] || "YouTube Shorts",
      series: params.seriesContext?.series?.title || (brief as any)?.series || "Viral Concept Series",
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
   * Executive Trigger: full Production OS lifecycle for live generate.
   * Conductor: preflight → AssetService (via Spec bridge) → QC → editorial.
   * AssetService remains the sole media executor — no dual spenders.
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
    automationMode?: AutomationMode | SparkAutomationMode;
  }): Promise<{ production: Production; brief: ProductionBrief }> {
    const {
      production,
      brand,
      character,
      characters,
      memoryItems = [],
      creditSettings,
      onProgress,
      forceRegenerate,
      signal,
      automationMode,
    } = params;
    ProductionGenerationGuard.assertEnabled("generateAssetsForProduction", brand?.id);
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
      if (signal?.aborted) return;
      if (isProductionTombstoned(production.id)) return;
      if (!ProductionGenerationGuard.isEnabled(brand?.id)) return;
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

    // Always resolve a ProductionSpec (legacy rows rebuild via adapter).
    const resolvedSpec = resolveProductionSpec(production, brand, character);
    const liveExecute = createLiveAssetExecuteAdapter({
      production,
      brand,
      character,
      characters,
      memoryItems,
      creditSettings,
      onProgress: handleProgress,
      forceRegenerate,
      signal,
    });

    const report = await runProductionLifecycle({
      spec: resolvedSpec,
      options: {
        brandId: brand.id || production.brandId,
        automationMode: (automationMode as SparkAutomationMode) || "balanced",
        enableQc: true,
        enableEditorial: true,
        enableMaster: true,
        // AssetService already produces the durable master; editorial reuses it.
        allowCompleteWithoutMaster: true,
        signal,
        masteringAdapter: createExistingMasterPassthroughAdapter(
          () =>
            liveExecute.getLastBridgeResult()?.assetResult.videoUrl ||
            liveExecute.getLastBridgeResult()?.production.videoUrl ||
            production.videoUrl
        ),
        deps: {
          executeProduction: liveExecute.executeProduction,
        },
      },
    });

    const bridge = liveExecute.getLastBridgeResult();
    const result = bridge?.assetResult;
    const briefFromBridge = result?.brief || production.brief;
    const videoUrl =
      report.editorial?.mastering?.output?.mediaUrl ||
      result?.videoUrl ||
      production.videoUrl;
    const audioUrl = result?.audioUrl || production.audioUrl;
    const isVideoSuccess = Boolean(videoUrl && isDurableMasterVideoReady(videoUrl));
    const generationFailed =
      report.phase === "blocked" ||
      report.phase === "failed" ||
      report.phase === "cancelled" ||
      (bridge && !result?.videoUrl && report.execution && !report.execution.ok);

    // Review is the human surface: generation success → Ready for Review even when QC wants eyes.
    const finalProdStatus = generationFailed
      ? "Failed"
      : isVideoSuccess || report.completed || report.phase === "awaiting_review"
        ? report.phase === "awaiting_review" && !isVideoSuccess
          ? "Needs Edit"
          : "Ready for Review"
        : "Failed";

    const priorReasoning =
      typeof production.reasoning === "object" && production.reasoning
        ? (production.reasoning as Record<string, unknown>)
        : {};

    const updatedWithSpine: Production = {
      ...(bridge?.production || production),
      id: production.id,
      status: finalProdStatus,
      brief: briefFromBridge,
      scenes: result?.scenes || bridge?.production.scenes || production.scenes,
      productionScenes:
        result?.productionScenes ||
        bridge?.production.productionScenes ||
        production.productionScenes,
      audioUrl,
      videoUrl,
      isGeneratingAssets: false,
      generationProgress:
        briefFromBridge.generationProgress ||
        bridge?.production.generationProgress ||
        production.generationProgress,
      targetDurationSec:
        briefFromBridge.targetDurationSec ||
        production.targetDurationSec ||
        resolvedSpec.project.targetDurationSec,
      productionMode: (briefFromBridge.productionMode ||
        production.productionMode ||
        production.mode ||
        "standard") as any,
      formatSettings: briefFromBridge.formatSettings || production.formatSettings,
      lastError: generationFailed
        ? report.summary ||
          briefFromBridge.lastError ||
          report.errors.join("; ") ||
          "Production lifecycle failed"
        : undefined,
      reasoning: {
        ...priorReasoning,
        ...(typeof bridge?.production.reasoning === "object" && bridge.production.reasoning
          ? bridge.production.reasoning
          : {}),
        productionSpec: report.spec,
        generationSpine: {
          bridge: "productionExecutionBridge",
          conductor: "runProductionLifecycle",
          usedSpecBridge: Boolean(bridge),
          usedFullPipeline: true,
          taskStatuses:
            bridge?.tasks.map((t) => ({
              id: t.id,
              kind: t.kind,
              shotId: t.shotId,
              sceneId: t.sceneId,
              status: t.status,
              lastError: t.lastError,
            })) || [],
          shotCount: report.spec.scenes.reduce((n, s) => n + s.shots.length, 0),
          masterVideo: Boolean(videoUrl),
        },
        lifecycle: {
          phase: report.phase,
          ok: report.ok,
          completed: report.completed,
          deliverableReady: report.deliverableReady,
          summary: report.summary,
          errors: report.errors,
          warnings: report.warnings,
          eventCount: report.events.length,
          cost: report.cost,
          timing: report.timing,
          preflightSummary: report.preflight?.summary,
          qcVerdict: report.qcReport?.verdict,
          editorialDecision: report.editorial?.decision?.action,
          masterOk: report.editorial?.mastering?.ok,
          masterUrl: report.editorial?.mastering?.output?.mediaUrl || videoUrl,
          checkpointId: report.checkpoint?.id,
        },
        productionQc: report.qcReport
          ? {
              verdict: report.qcReport.verdict,
              status: report.qcReport.productionResult?.status,
              score: report.qcReport.productionResult?.score,
              stoppedReason: report.qc?.stoppedReason,
              userMessage: report.qcReport.productionResult?.userMessage,
            }
          : undefined,
      },
    };

    const state = this.getFullState();
    const currentProds: Production[] = state.productions || [];
    const currentReviews: ReviewItem[] = state.reviewItems || [];

    this.saveFullState({
      productions: currentProds.map((p) => (p.id === production.id ? updatedWithSpine : p)),
      reviewItems: currentReviews.map((r) =>
        r.productionId === production.id
          ? {
              ...r,
              brief: briefFromBridge,
              videoUrl: videoUrl || r.videoUrl,
              openingMoment: briefFromBridge.storyboard?.[0]?.visualDescription || r.openingMoment,
            }
          : r
      ),
    });

    return { production: updatedWithSpine, brief: briefFromBridge };
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

    // Production Generation ON/OFF is enforced inside executeProduction for live runs.
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

  /**
   * Phase 10 — run the full production lifecycle against an existing ProductionSpec.
   * Conductor only: reuses executeProduction, QC repair loop, and editorial/mastering.
   * Persists a structured lifecycle report on production.reasoning.lifecycle.
   */
  async runFullProductionLifecycle(params: {
    production: Production;
    brand?: Brand;
    options?: RunProductionLifecycleOptions & {
      /** Phase 11 — when provided, run observe→learn after lifecycle (never fabricates metrics). */
      learningUpdate?: Omit<LearningUpdateInput, "productionId" | "snapshots"> & {
        snapshots?: PerformanceSnapshot[];
        run?: boolean;
      };
    };
  }): Promise<{
    production: Production;
    report: ProductionLifecycleReport;
    learningUpdate?: ReturnType<typeof runLearningUpdatePipeline>;
  }> {
    const reasoning =
      typeof params.production.reasoning === "object" && params.production.reasoning
        ? params.production.reasoning
        : {};
    const spec = (reasoning as any).productionSpec as ProductionSpec | undefined;
    if (!spec) {
      throw new Error("ProductionSpec missing — run createProductionFromSpark / planning first");
    }

    const report = await runProductionLifecycle({
      spec,
      options: {
        brandId: params.brand?.id || params.production.brandId,
        automationMode: params.options?.automationMode || "balanced",
        ...params.options,
      },
    });

    let learningUpdate: ReturnType<typeof runLearningUpdatePipeline> | undefined;
    const learningOpts = params.options?.learningUpdate;
    if (learningOpts?.run) {
      const snapshots = learningOpts.snapshots || [];
      learningUpdate = runLearningUpdatePipeline({
        ...learningOpts,
        productionId: params.production.id,
        snapshots,
        productionQualityScore:
          learningOpts.productionQualityScore ??
          (typeof report.qcReport?.productionResult?.score === "number" ? report.qcReport.productionResult.score : undefined),
        outcome: {
          ...buildOutcomeFromLifecycle({
            productionId: params.production.id,
            lifecycle: {
              ok: report.ok,
              completed: report.completed,
              deliverableReady: report.deliverableReady,
              cost: report.cost,
              timing: report.timing,
            },
            qualityScore:
              learningOpts.productionQualityScore ??
              (typeof report.qcReport?.productionResult?.score === "number" ? report.qcReport.productionResult.score : undefined),
            audiencePerformanceScore: learningOpts.outcome?.audiencePerformanceScore,
            platform: learningOpts.platform,
          }),
          ...(learningOpts.outcome || {}),
        },
      });
    }

    const updated: Production = {
      ...params.production,
      reasoning: {
        ...reasoning,
        productionSpec: report.spec,
        lifecycle: {
          phase: report.phase,
          ok: report.ok,
          completed: report.completed,
          deliverableReady: report.deliverableReady,
          summary: report.summary,
          errors: report.errors,
          warnings: report.warnings,
          eventCount: report.events.length,
          cost: report.cost,
          timing: report.timing,
          preflightSummary: report.preflight?.summary,
          qcVerdict: report.qcReport?.verdict,
          editorialDecision: report.editorial?.decision?.action,
          masterOk: report.editorial?.mastering?.ok,
          masterUrl: report.editorial?.mastering?.output?.mediaUrl,
          checkpointId: report.checkpoint?.id,
        },
        ...(learningUpdate
          ? {
              learning: {
                snapshotId: learningUpdate.snapshot.id,
                snapshotVersion: learningUpdate.snapshot.version,
                learningIds: learningUpdate.learnings.map((l) => l.id),
                quarantinedIds: learningUpdate.quarantined.map((l) => l.id),
                advice: learningUpdate.advice,
                outcome: learningUpdate.outcome,
                decisions: learningUpdate.decisions,
                providerPreferences: learningUpdate.providerPreferences,
                repairPreferences: learningUpdate.repairPreferences,
                // Structured memory only — never raw analytics dumps
                memoryItemIds: learningUpdate.memoryItems.map((m) => m.id),
              },
            }
          : {}),
      },
      status: report.completed
        ? "Ready for Review"
        : report.phase === "failed" || report.phase === "blocked"
          ? "Failed"
          : report.phase === "awaiting_review"
            ? "Needs Edit"
            : params.production.status,
    };

    const state = this.getFullState();
    const currentProds: Production[] = state.productions || [];
    this.saveFullState({
      productions: currentProds
        .map((p) => (p.id === updated.id ? updated : p))
        .concat(currentProds.some((p) => p.id === updated.id) ? [] : [updated]),
    });

    return { production: updated, report, learningUpdate };
  }
}

function resultAssetsFromExecution(reasoning: Record<string, unknown>): ProductionAsset[] {
  // Assets are typically persisted separately; execution summary does not embed blobs.
  void reasoning;
  return [];
}

export const productionService = new ProductionService();
