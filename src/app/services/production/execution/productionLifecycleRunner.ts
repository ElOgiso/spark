/**
 * Phase 10 — End-to-end production lifecycle conductor.
 *
 * Wires existing instruments only:
 *   planned ProductionSpec
 *     → runProductionPreflight
 *     → executeProduction
 *     → runQcWithRepairLoop
 *     → runEditorialPipeline (+ optional master)
 */

import type { ProductionSpec } from "../specification/productionSpec";
import type { ProductionAsset } from "../../../domain/types";
import type { SparkAutomationMode } from "../qc/types";
import { executeProduction, type ExecuteProductionResult } from "./productionExecutor";
import {
  runQcWithRepairLoop,
  type ShotObservationInput,
  type QcRepairLoopResult,
} from "../qc/qcOrchestrator";
import { runEditorialPipeline, type EditorialPipelineResult } from "../editorial/pipeline";
import { createMockMasteringAdapter } from "../editorial/mastering/ffmpegAdapter";
import { runProductionPreflight } from "./productionPreflight";
import {
  isTerminalLifecyclePhase,
  projectStatusForPhase,
  transitionLifecycle,
} from "./lifecycleStateMachine";
import type {
  ProductionLifecycleCheckpoint,
  ProductionLifecycleEvent,
  ProductionLifecyclePhase,
  ProductionLifecycleReport,
  RunProductionLifecycleInput,
  RunProductionLifecycleOptions,
} from "./lifecycleTypes";

function nowIso(): string {
  return new Date().toISOString();
}

function newCheckpointId(): string {
  return `ckpt_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function withProjectStatus(spec: ProductionSpec, phase: ProductionLifecyclePhase): ProductionSpec {
  return {
    ...spec,
    project: {
      ...spec.project,
      status: projectStatusForPhase(phase),
      updatedAt: nowIso(),
    },
  };
}

function isExpressLike(spec: ProductionSpec): boolean {
  const mode = String(spec.project.productionMode || "").toLowerCase();
  return mode.includes("express") || mode.includes("previs") || mode.includes("preview");
}

function estimateCost(spec: ProductionSpec): number {
  const shots = spec.scenes.reduce((n, s) => n + s.shots.length, 0);
  const mode = String(spec.project.productionMode || "standard").toLowerCase();
  const weight =
    mode.includes("express") || mode.includes("previs")
      ? 0.4
      : mode.includes("deep") || mode.includes("final")
        ? 1.4
        : 1;
  return Number((shots * 0.35 * weight).toFixed(2));
}

function mapAutomationMode(
  mode: RunProductionLifecycleOptions["automationMode"]
): SparkAutomationMode {
  if (mode === "manual" || mode === "balanced" || mode === "autonomous") return mode;
  return "balanced";
}

function observationsFromAssets(
  spec: ProductionSpec,
  assets: ProductionAsset[]
): ShotObservationInput[] {
  const observations: ShotObservationInput[] = [];
  for (const asset of assets) {
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
  for (const scene of spec.scenes) {
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
  return observations;
}

export async function runProductionLifecycle(
  input: RunProductionLifecycleInput
): Promise<ProductionLifecycleReport> {
  const options: RunProductionLifecycleOptions = input.options || {};
  const enableQc = options.enableQc !== false;
  const enableEditorial = options.enableEditorial !== false;
  const enableMaster = options.enableMaster !== false;
  const allowCompleteWithoutMaster =
    options.allowCompleteWithoutMaster === true || isExpressLike(input.spec);

  const executeFn = options.deps?.executeProduction ?? executeProduction;
  const runQcFn = options.deps?.runQcWithRepairLoop ?? runQcWithRepairLoop;
  const runEditorialFn = options.deps?.runEditorialPipeline ?? runEditorialPipeline;

  const startedAt = nowIso();
  const phaseStartedAt = new Map<ProductionLifecyclePhase, number>();
  const phaseDurationsMs: ProductionLifecycleReport["timing"]["phaseDurationsMs"] = {};
  const events: ProductionLifecycleEvent[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  let phase: ProductionLifecyclePhase = options.checkpoint?.phase || "planned";
  let spec = withProjectStatus(options.checkpoint?.snapshot.spec || input.spec, phase);
  let assets: ProductionAsset[] = [...(options.checkpoint?.snapshot.assets || [])];
  let checkpoint: ProductionLifecycleCheckpoint | undefined = options.checkpoint;
  let execution: ExecuteProductionResult | undefined;
  let qc: QcRepairLoopResult | undefined;
  let editorial: EditorialPipelineResult | undefined;
  let preflight: ProductionLifecycleReport["preflight"];
  const productionId = spec.project.id;

  // Idempotent resume of an already-finished production
  if (options.checkpoint && isTerminalLifecyclePhase(options.checkpoint.phase)) {
    if (options.checkpoint.phase === "completed") {
      warnings.push("Lifecycle already completed — resume is a no-op");
      return {
        productionId,
        phase: "completed",
        ok: true,
        completed: true,
        deliverableReady: true,
        summary: "Already completed — resume skipped regeneration",
        events: [
          {
            type: "lifecycle_resumed",
            at: nowIso(),
            phase: "completed",
            message: "Resume no-op for completed production",
          },
        ],
        preflight: undefined,
        execution: undefined,
        qc: undefined,
        qcReport: undefined,
        editorial: undefined,
        checkpoint: options.checkpoint,
        cost: {
          estimated: estimateCost(spec),
          actual: 0,
          currency: "USD",
          byProvider: {},
          notes: ["resume no-op"],
        },
        timing: { startedAt, finishedAt: nowIso(), durationMs: 0, phaseDurationsMs: {} },
        warnings,
        errors,
        spec,
      };
    }
  }

  const emit = (
    type: ProductionLifecycleEvent["type"],
    message: string,
    extra?: Partial<ProductionLifecycleEvent>
  ) => {
    const event: ProductionLifecycleEvent = { type, at: nowIso(), phase, message, ...extra };
    events.push(event);
    options.onEvent?.(event);
  };

  const enter = (next: ProductionLifecyclePhase, message: string): boolean => {
    const result = transitionLifecycle(phase, next);
    if (!result.ok) {
      errors.push(result.error);
      emit("warning", result.error, { code: "INVALID_TRANSITION" });
      phase = "failed";
      spec = withProjectStatus(spec, phase);
      return false;
    }
    const prev = phase;
    const started = phaseStartedAt.get(prev);
    if (started != null) {
      phaseDurationsMs[prev] = (phaseDurationsMs[prev] || 0) + (Date.now() - started);
    }
    phase = result.phase;
    phaseStartedAt.set(phase, Date.now());
    spec = withProjectStatus(spec, phase);
    emit("phase_entered", message, { details: { from: prev, to: phase } });
    return true;
  };

  const saveCheckpoint = (): ProductionLifecycleCheckpoint => {
    const executions = execution?.executions || [];
    checkpoint = {
      id: newCheckpointId(),
      savedAt: nowIso(),
      phase,
      productionId,
      snapshot: {
        spec,
        assets,
        executionState: execution?.productionState,
        qcVerdict: qc?.report.verdict,
        editorialTimelineId: editorial?.timeline.id,
        masterAssetId: editorial?.mastering?.output?.masterId,
        masterUrl: editorial?.mastering?.output?.mediaUrl,
        completedTaskIds: executions.filter((e) => e.status === "succeeded").map((e) => e.taskId),
        failedTaskIds: executions.filter((e) => e.status === "failed").map((e) => e.taskId),
      },
    };
    emit("checkpoint_saved", `Checkpoint ${checkpoint.id} at ${phase}`, {
      code: checkpoint.id,
      details: { phase },
    });
    return checkpoint;
  };

  const buildReport = (
    partial: Pick<ProductionLifecycleReport, "ok" | "completed" | "deliverableReady" | "summary">
  ): ProductionLifecycleReport => {
    const started = phaseStartedAt.get(phase);
    if (started != null) {
      phaseDurationsMs[phase] = (phaseDurationsMs[phase] || 0) + (Date.now() - started);
      phaseStartedAt.delete(phase);
    }
    const finishedAt = nowIso();
    const byProvider: Record<string, number> = {};
    for (const asset of assets) {
      const p = asset.provider || "unknown";
      byProvider[p] = (byProvider[p] || 0) + 0;
    }
    return {
      productionId,
      phase,
      events,
      warnings,
      errors,
      spec,
      preflight,
      execution,
      qc,
      qcReport: qc?.report,
      editorial,
      checkpoint,
      cost: {
        estimated: estimateCost(spec),
        actual: 0,
        currency: "USD",
        byProvider,
        notes: ["estimated only — providers did not report billable usage in this run"],
      },
      timing: {
        startedAt,
        finishedAt,
        durationMs: Math.max(0, Date.parse(finishedAt) - Date.parse(startedAt)),
        phaseDurationsMs,
      },
      ...partial,
    };
  };

  const failClosed = (summary: string): ProductionLifecycleReport => {
    if (!isTerminalLifecyclePhase(phase)) {
      phase = "failed";
      spec = withProjectStatus(spec, phase);
    }
    emit("lifecycle_failed", summary);
    return buildReport({
      ok: false,
      completed: false,
      deliverableReady: false,
      summary,
    });
  };

  emit("lifecycle_started", "Production lifecycle started", {
    details: { productionId, dryRun: Boolean(options.dryRun) },
  });
  phaseStartedAt.set(phase, Date.now());

  if (options.signal?.aborted) {
    enter("cancelled", "Cancelled before start");
    emit("lifecycle_cancelled", "AbortSignal already aborted");
    errors.push("aborted");
    return buildReport({
      ok: false,
      completed: false,
      deliverableReady: false,
      summary: "Cancelled before start",
    });
  }

  // PREFLIGHT
  if (!enter("preflight", "Running production preflight")) {
    return failClosed("Lifecycle failed entering preflight");
  }
  emit("preflight_started", "Preflight started");
  preflight = runProductionPreflight(spec);
  if (!preflight.ok) {
    enter("blocked", preflight.summary);
    emit("preflight_failed", preflight.summary, {
      code: "PREFLIGHT_BLOCKED",
      details: { blockers: preflight.blockers.map((b) => b.code) },
    });
    errors.push(...preflight.blockers.map((b) => `${b.code}: ${b.message}`));
    warnings.push(...preflight.warnings.map((w) => w.message));
    saveCheckpoint();
    return buildReport({
      ok: false,
      completed: false,
      deliverableReady: false,
      summary: preflight.summary,
    });
  }
  emit("preflight_passed", preflight.summary);
  warnings.push(...preflight.warnings.map((w) => w.message));
  if (!enter("ready", "Preflight passed — ready to generate")) {
    return failClosed("Lifecycle failed entering ready");
  }

  // GENERATION
  if (!enter("generating", "Starting generation")) {
    return failClosed("Lifecycle failed entering generating");
  }
  emit("generation_started", options.dryRun ? "Dry-run generation" : "Generation started");

  try {
    execution = await executeFn(spec, {
      dryRun: options.dryRun === true,
      preferExistingTasks: Boolean(options.checkpoint),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation threw";
    enter("failed", message);
    emit("generation_failed", message, { code: "GENERATION_EXCEPTION" });
    errors.push(message);
    saveCheckpoint();
    return buildReport({
      ok: false,
      completed: false,
      deliverableReady: false,
      summary: `Generation failed: ${message}`,
    });
  }

  spec = withProjectStatus(execution.spec || spec, phase);
  assets = execution.assets || assets;
  emit("generation_progress", `Generation state=${execution.state}`, {
    details: {
      ok: execution.ok,
      taskCount: execution.tasks?.length,
      assetCount: assets.length,
      errors: execution.errors,
    },
  });

  if (options.signal?.aborted) {
    enter("cancelled", "Cancelled during generation");
    emit("lifecycle_cancelled", "AbortSignal aborted during generation");
    errors.push("aborted");
    saveCheckpoint();
    return buildReport({
      ok: false,
      completed: false,
      deliverableReady: false,
      summary: "Cancelled during generation",
    });
  }

  if (!execution.ok || execution.state === "failed") {
    enter("failed", "Generation failed");
    emit("generation_failed", "Generation engine reported failure", {
      code: "GENERATION_FAILED",
      details: { errors: execution.errors },
    });
    errors.push(...(execution.errors || ["generation_failed"]));
    saveCheckpoint();
    return buildReport({
      ok: false,
      completed: false,
      deliverableReady: false,
      summary: `Generation failed: ${(execution.errors || []).join("; ") || "unknown"}`,
    });
  }

  emit("generation_completed", "Generation completed");
  saveCheckpoint();

  // QC + REPAIR
  if (enableQc) {
    if (!enter("validating", "Running QC")) {
      return failClosed("Lifecycle failed entering validating");
    }
    emit("qc_started", "QC hierarchy started");

    qc = await runQcFn(spec, {
      automationMode: mapAutomationMode(options.automationMode),
      observations: observationsFromAssets(spec, assets),
      reexecute: options.dryRun
        ? undefined
        : async (nextSpec) => {
            emit("repair_started", "Re-executing after QC repair");
            enter("repairing", "Repair re-execution");
            const repaired = await executeFn(nextSpec, {
              dryRun: false,
              preferExistingTasks: false,
            });
            assets = repaired.assets || assets;
            enter("validating", "Re-validating after repair");
            return {
              spec: repaired.spec,
              observations: observationsFromAssets(repaired.spec, repaired.assets || []),
            };
          },
    });

    spec = withProjectStatus(qc.finalSpec || spec, phase);
    emit("qc_completed", `QC stopped: ${qc.stoppedReason}`, {
      details: {
        verdict: qc.report.verdict,
        repairs: qc.repairsApplied.length,
        stoppedReason: qc.stoppedReason,
      },
    });

    if (qc.repairsApplied.length) {
      emit("repair_completed", `Applied ${qc.repairsApplied.length} repair(s)`);
    }
    if (qc.stoppedReason === "budget_exhausted") {
      emit("repair_exhausted", "Repair budget exhausted");
    }

    if (qc.report.verdict === "production_failed") {
      enter("failed", "QC failed production");
      emit("lifecycle_failed", "QC verdict production_failed");
      errors.push("qc_production_failed");
      saveCheckpoint();
      return buildReport({
        ok: false,
        completed: false,
        deliverableReady: false,
        summary: "QC failed — production not deliverable",
      });
    }

    if (
      qc.report.verdict === "production_needs_review" ||
      qc.stoppedReason === "manual_review" ||
      qc.stoppedReason === "no_auto_repair"
    ) {
      enter("awaiting_review", "QC requires human review");
      emit("approval_blocked", "Awaiting review after QC", { code: "AWAITING_REVIEW" });
      saveCheckpoint();
      return buildReport({
        ok: false,
        completed: false,
        deliverableReady: false,
        summary: "QC requires human review before editorial",
      });
    }

    if (!enter("approved", "QC approved production assets")) {
      return failClosed("Lifecycle failed entering approved");
    }
    emit("approval_granted", "Assets approved for editorial");
  } else {
    if (!enter("approved", "QC skipped by policy — treating generation as approved")) {
      return failClosed("Lifecycle failed entering approved (qc skipped)");
    }
    warnings.push("QC skipped by policy");
    emit("approval_granted", "QC skipped — approved by policy");
  }

  saveCheckpoint();

  // EDITORIAL + MASTER
  if (enableEditorial) {
    if (!enter("assembling", "Assembling editorial timeline")) {
      return failClosed("Lifecycle failed entering assembling");
    }
    emit("assembly_started", "Editorial assembly started");

    if (enableMaster) {
      enter("mastering", "Mastering enabled for this run");
      emit("mastering_started", "Mastering started");
    }

    editorial = await runEditorialFn(spec, {
      assets,
      qcVerdict: qc?.report.verdict ?? (enableQc ? undefined : "production_ready"),
      allowPlannedWithoutAssets: options.dryRun === true,
      automationMode: mapAutomationMode(options.automationMode),
      master: enableMaster,
      brandId: options.brandId,
      mastering: enableMaster ? { adapter: createMockMasteringAdapter() } : undefined,
    });

    emit("assembly_completed", `Editorial decision=${editorial.decision.action}`, {
      details: {
        validation: editorial.validation.status,
        allowMaster: editorial.decision.allowMaster,
      },
    });

    const masterOk = Boolean(editorial.mastering?.ok);
    const assemblyOk =
      editorial.ok ||
      editorial.decision.allowMaster ||
      editorial.validation.status !== "invalid";

    if (enableMaster) {
      if (masterOk) {
        emit("mastering_completed", "Master created", {
          details: {
            masterId: editorial.mastering?.output?.masterId,
            mediaUrl: editorial.mastering?.output?.mediaUrl,
          },
        });
      } else if (editorial.mastering && !editorial.mastering.deferred) {
        enter("failed", "Mastering failed");
        emit("mastering_failed", editorial.mastering.userMessage || "Mastering failed", {
          code: "MASTERING_FAILED",
        });
        errors.push(editorial.mastering.userMessage || "mastering_failed");
        saveCheckpoint();
        return buildReport({
          ok: false,
          completed: false,
          deliverableReady: false,
          summary: "Mastering failed — production not complete",
        });
      } else if (editorial.mastering?.deferred) {
        warnings.push("Mastering deferred by adapter");
        emit("warning", "Mastering deferred", { code: "MASTERING_DEFERRED" });
      }
    }

    if (masterOk || (allowCompleteWithoutMaster && assemblyOk && !enableMaster)) {
      enter("completed", "Production lifecycle completed");
      emit("lifecycle_completed", "Production completed with deliverable");
      saveCheckpoint();
      return buildReport({
        ok: true,
        completed: true,
        deliverableReady: true,
        summary: masterOk
          ? "Production completed with master"
          : "Production completed (assembly-only / PREVIS policy)",
      });
    }

    if (allowCompleteWithoutMaster && assemblyOk) {
      enter("completed", "Completed without durable master (policy)");
      emit("lifecycle_completed", "Completed under allowCompleteWithoutMaster policy");
      warnings.push("Completed without durable master");
      saveCheckpoint();
      return buildReport({
        ok: true,
        completed: true,
        deliverableReady: true,
        summary: "Production completed without master (explicit policy)",
      });
    }

    enter("awaiting_review", "Editorial incomplete — review required");
    emit("approval_blocked", "Editorial did not produce a complete deliverable");
    saveCheckpoint();
    return buildReport({
      ok: false,
      completed: false,
      deliverableReady: false,
      summary: "Editorial/mastering incomplete — not marked complete",
    });
  }

  enter("completed", "Lifecycle complete without editorial (policy)");
  emit("lifecycle_completed", "Completed without editorial by policy");
  warnings.push("Editorial skipped by policy");
  saveCheckpoint();
  return buildReport({
    ok: true,
    completed: true,
    deliverableReady: allowCompleteWithoutMaster,
    summary: "Generation/QC complete — editorial skipped by policy",
  });
}

export function resumeProductionLifecycle(
  checkpoint: ProductionLifecycleCheckpoint,
  options: RunProductionLifecycleOptions = {}
): Promise<ProductionLifecycleReport> {
  return runProductionLifecycle({
    spec: checkpoint.snapshot.spec,
    options: {
      ...options,
      checkpoint,
    },
  });
}
