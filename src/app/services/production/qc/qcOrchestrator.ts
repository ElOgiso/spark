/**
 * Phase 5 QC orchestrator — asset→shot→scene→production hierarchy + repair loop.
 * Regeneration goes through existing Phase 4 executeProduction / retry planner.
 */

import type { ProductionSpec } from "../specification/productionSpec";
import type { ShotSpec } from "../specification/shotSpec";
import type { TechnicalValidationResult } from "../execution/types";
import type { ExecuteProductionOptions, ExecuteProductionResult } from "../execution/productionExecutor";
import { executeProduction } from "../execution/productionExecutor";
import type {
  ObservedVisualState,
  ProductionQCResult,
  ProductionQcVerdict,
  QcBudgetState,
  RepairDecision,
  SparkAutomationMode,
} from "./types";
import type { VisualAnalysisService } from "./visualAnalysis/service";
import { createStructuralVisualAnalyzer } from "./visualAnalysis/service";
import { evaluateShotQc } from "./shotQc";
import { evaluateSceneQc } from "./sceneQc";
import { evaluateProductionQc } from "./productionQc";
import { planRepairFromQc } from "./repairPlanner";
import { applyAutomationPolicy } from "./automationPolicy";
import {
  createBudgetState,
  createDefaultQcBudget,
  recordQcRetry,
  markBudgetExhausted,
  canRetryQc,
} from "./budgets";

export interface ShotObservationInput {
  shotId: string;
  mediaType?: "image" | "video" | "audio";
  sourceUrl?: string;
  assetId?: string;
  taskId?: string;
  technical?: TechnicalValidationResult;
  hasVoiceAsset?: boolean;
  observed?: ObservedVisualState;
  frames?: Array<{ role: "begin" | "middle" | "end" | "representative"; description?: string; url?: string }>;
}

export interface RunProductionQcOptions {
  visualAnalysis?: VisualAnalysisService;
  observations?: ShotObservationInput[];
  /** When true, missing observations still run structural (inconclusive) analysis */
  allowInconclusive?: boolean;
}

export interface ProductionQcReport {
  shotResults: ProductionQCResult[];
  sceneResults: ProductionQCResult[];
  productionResult: ProductionQCResult;
  verdict: ProductionQcVerdict;
}

export async function runProductionQcHierarchy(
  spec: ProductionSpec,
  options: RunProductionQcOptions = {}
): Promise<ProductionQcReport> {
  const analyzer = options.visualAnalysis || createStructuralVisualAnalyzer();
  const obsByShot = new Map((options.observations || []).map((o) => [o.shotId, o]));
  const shotResults: ProductionQCResult[] = [];

  const flatShots: Array<{ shot: ShotSpec; previous?: ShotSpec }> = [];
  for (const scene of spec.scenes) {
    for (let i = 0; i < scene.shots.length; i++) {
      flatShots.push({
        shot: scene.shots[i],
        previous: i > 0 ? scene.shots[i - 1] : undefined,
      });
    }
  }

  for (const { shot, previous } of flatShots) {
    const obs = obsByShot.get(shot.id);
    if (!obs && options.allowInconclusive === false) {
      continue;
    }
    const result = await evaluateShotQc({
      spec,
      shot,
      previousShot: previous,
      mediaType: obs?.mediaType,
      sourceUrl: obs?.sourceUrl || shot.mediaUrl || shot.keyframeUrl,
      assetId: obs?.assetId,
      taskId: obs?.taskId,
      technical: obs?.technical ?? { ok: true, reasons: [], retryable: false },
      hasVoiceAsset: obs?.hasVoiceAsset,
      observedOverride: obs?.observed,
      visualAnalysis: analyzer,
      frames: obs?.frames,
    });
    shotResults.push(result);
  }

  const sceneResults = spec.scenes.map((scene) =>
    evaluateSceneQc({
      spec,
      scene,
      shotResults: shotResults.filter((r) => r.sceneId === scene.id),
    })
  );

  const { result: productionResult, verdict } = evaluateProductionQc({
    spec,
    sceneResults,
    shotResults,
  });

  return { shotResults, sceneResults, productionResult, verdict };
}

export interface QcRepairLoopOptions extends RunProductionQcOptions {
  automationMode?: SparkAutomationMode;
  budget?: QcBudgetState;
  /** Optional re-execution for regenerations — inject to avoid real providers in tests */
  reexecute?: (spec: ProductionSpec, repair: RepairDecision) => Promise<{
    spec: ProductionSpec;
    observations?: ShotObservationInput[];
  }>;
  /** Max loop iterations hard cap (in addition to budget) */
  hardMaxLoops?: number;
}

export interface QcRepairLoopResult {
  report: ProductionQcReport;
  budget: QcBudgetState;
  repairsApplied: RepairDecision[];
  automation: ReturnType<typeof applyAutomationPolicy>[];
  stoppedReason: "accepted" | "manual_review" | "budget_exhausted" | "no_auto_repair";
  finalSpec: ProductionSpec;
}

/**
 * QC → classify → repair planner → (optional) re-execute → QC again.
 * Uses Phase 4 execution only via injected reexecute / executeProduction.
 */
export async function runQcWithRepairLoop(
  spec: ProductionSpec,
  options: QcRepairLoopOptions = {}
): Promise<QcRepairLoopResult> {
  const mode = options.automationMode || "balanced";
  let budget = options.budget || createBudgetState(createDefaultQcBudget(spec.quality));
  let currentSpec = spec;
  let observations = options.observations;
  const repairsApplied: RepairDecision[] = [];
  const automationLog: ReturnType<typeof applyAutomationPolicy>[] = [];
  const hardMax = options.hardMaxLoops ?? budget.maxQcRetries + 1;

  let report = await runProductionQcHierarchy(currentSpec, {
    ...options,
    observations,
  });

  for (let i = 0; i < hardMax; i++) {
    if (report.verdict === "production_ready" || report.productionResult.status === "pass") {
      return {
        report,
        budget,
        repairsApplied,
        automation: automationLog,
        stoppedReason: "accepted",
        finalSpec: applyQcStatusesToSpec(currentSpec, report),
      };
    }

    // Pick worst failing shot to repair
    const failing =
      report.shotResults.find((r) => r.status === "fail" || r.status === "retry") ||
      report.shotResults.find((r) => r.status === "warn" && r.failures.length);

    if (!failing?.shotId) {
      return {
        report,
        budget,
        repairsApplied,
        automation: automationLog,
        stoppedReason: "manual_review",
        finalSpec: applyQcStatusesToSpec(currentSpec, report),
      };
    }

    const shot = currentSpec.scenes
      .flatMap((s) => s.shots)
      .find((s) => s.id === failing.shotId);

    const repair = planRepairFromQc({
      qc: failing,
      spec: currentSpec,
      shot,
      budget,
      forceManualReview: !canRetryQc(budget),
    });

    const policy = applyAutomationPolicy({ mode, qc: failing, repair });
    automationLog.push(policy);

    if (!policy.autoRepair || policy.effectiveAction === "manual_review" || !repair.withinBudget) {
      budget = markBudgetExhausted(budget);
      return {
        report: {
          ...report,
          productionResult: {
            ...report.productionResult,
            recommendedAction: "manual_review",
            userMessage: policy.userMessage,
          },
          verdict: "production_needs_review",
        },
        budget,
        repairsApplied,
        automation: automationLog,
        stoppedReason: repair.withinBudget ? "no_auto_repair" : "budget_exhausted",
        finalSpec: applyQcStatusesToSpec(currentSpec, report),
      };
    }

    repairsApplied.push(repair);
    budget = recordQcRetry(budget, repair.providerChange);

    // Apply prompt / reference strengthening hints onto shot before re-exec
    currentSpec = applyRepairToSpec(currentSpec, repair, shot);

    if (options.reexecute) {
      const next = await options.reexecute(currentSpec, repair);
      currentSpec = next.spec;
      if (next.observations) observations = next.observations;
    }

    report = await runProductionQcHierarchy(currentSpec, {
      ...options,
      observations,
    });
  }

  return {
    report,
    budget: markBudgetExhausted(budget),
    repairsApplied,
    automation: automationLog,
    stoppedReason: "budget_exhausted",
    finalSpec: applyQcStatusesToSpec(currentSpec, report),
  };
}

export function applyRepairToSpec(
  spec: ProductionSpec,
  repair: RepairDecision,
  shot?: ShotSpec
): ProductionSpec {
  if (!shot) return spec;
  return {
    ...spec,
    scenes: spec.scenes.map((scene) => ({
      ...scene,
      shots: scene.shots.map((s) => {
        if (!repair.regenerateShotIds.includes(s.id) && s.id !== shot.id) return s;
        const prompt = s.compiledPrompt || "";
        const reinforced = repair.modifyPromptHint
          ? `${prompt}\nQC_REPAIR: ${repair.modifyPromptHint}`
          : prompt;
        return {
          ...s,
          compiledPrompt: reinforced,
          provider: repair.nextProvider || s.provider,
          generationStrategy: (repair.strategyChange as ShotSpec["generationStrategy"]) || s.generationStrategy,
          generationStatus: "queued" as const,
          qcStatus: "retry" as const,
          retry: {
            attempt: (s.retry?.attempt || 0) + 1,
            maxAttempts: s.retry?.maxAttempts ?? (repair.regenerateShotIds.length ? 3 : 2),
            lastFailureReasons: [repair.reason],
            remediation: String(repair.remediation),
            providerChanged: repair.providerChange,
          },
          references: repair.strengthenReferences
            ? {
                ...s.references,
                characterRefs: [...s.references.characterRefs, ...s.characterIds],
              }
            : s.references,
        };
      }),
    })),
  };
}

export function applyQcStatusesToSpec(spec: ProductionSpec, report: ProductionQcReport): ProductionSpec {
  const byShot = new Map(report.shotResults.filter((r) => r.shotId).map((r) => [r.shotId!, r]));
  return {
    ...spec,
    project: {
      ...spec.project,
      status:
        report.verdict === "production_ready"
          ? "qc"
          : report.verdict === "production_failed"
            ? "failed"
            : "qc",
      updatedAt: new Date().toISOString(),
    },
    scenes: spec.scenes.map((scene) => ({
      ...scene,
      shots: scene.shots.map((shot) => {
        const qc = byShot.get(shot.id);
        if (!qc) return shot;
        return {
          ...shot,
          qcStatus:
            qc.status === "pass"
              ? "pass"
              : qc.status === "warn"
                ? "pass"
                : qc.status === "retry"
                  ? "retry"
                  : "fail",
          generationStatus:
            qc.status === "pass" || qc.status === "warn"
              ? "approved"
              : qc.status === "retry"
                ? "qc_pending"
                : "qc_failed",
          observability: {
            ...shot.observability,
            qcScore: qc.score,
          },
        };
      }),
    })),
  };
}

/**
 * Convenience: run Phase 4 execution then Phase 5 QC (+ optional repair loop).
 * Does not redesign UI — returns structured report for existing surfaces.
 */
export async function executeProductionWithQc(
  spec: ProductionSpec,
  options: ExecuteProductionOptions & QcRepairLoopOptions & { enableQc?: boolean } = {}
): Promise<{
  execution: ExecuteProductionResult;
  qc?: QcRepairLoopResult;
}> {
  const execution = await executeProduction(spec, options);
  if (options.enableQc === false) {
    return { execution };
  }

  const observations: ShotObservationInput[] = [];
  for (const asset of execution.assets) {
    const shotId = asset.shotId;
    if (!shotId) continue;
    observations.push({
      shotId,
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

  // Also cover shots with mediaUrl even if asset list incomplete
  for (const scene of execution.spec.scenes) {
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

  const qc = await runQcWithRepairLoop(execution.spec, {
    ...options,
    observations: options.observations || observations,
    reexecute: options.reexecute,
  });

  return { execution: { ...execution, spec: qc.finalSpec }, qc };
}
