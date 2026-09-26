import { usesSourceVisual, renderVisualGraphic } from "../generation/visualMedia";
import type { NormalizedMediaOutput } from "./types";
/**
 * Generation execution engine — dependency-aware task runner.
 * Uses Phase 3 retry planner. Does not contain provider-specific branching.
 */

import type { ProductionSpec } from "../specification/productionSpec";
import type { GenerationTask } from "../specification/generationTask";
import { validateGenerationTask } from "../specification/generationTask";
import type { ProductionDag } from "../dag/productionDag";
import { markNode } from "../dag/productionDag";
import { planShotRetry } from "../generation/retryPlanner";
import type { ShotRoutingDecision } from "../specification/routingSpec";
import { assertExecutableCapability, capabilityRequirementsFromTask } from "../capability";
import {
  createDefaultAdapterRegistry,
  resolveAdapter,
  resolveAdapterForTask,
  type AdapterPorts,
  type MediaProviderAdapter,
} from "./adapters/registry";
import { prepareTaskInputs } from "./inputPreparation";
import {
  expectationsFromPrepared,
  validateNormalizedOutput,
} from "./outputValidation";
import {
  createMemoryAssetPersistPort,
  enrichOutputMetadata,
  normalizedResultToMediaOutput,
  persistNormalizedOutput,
  restoreExecutionAsset,
  checkpointTaskOutput,
  restoreTaskOutput,
  type AssetPersistPort,
} from "./outputNormalization";
import {
  buildTaskInputHash,
  createMemoryIdempotencyStore,
  findReusableExecution,
  executionNeedsReconciliation,
  idempotencyKey,
  type IdempotencyStore,
} from "./idempotency";
import { transitionStatus, isTerminalStatus } from "./jobStateMachine";
import { computeBackoffDelayMs, DEFAULT_BACKOFF_POLICY, sleepMs, type BackoffPolicy } from "./backoff";
import { selectReadyBatch, deriveProductionState, type SchedulerConfig } from "./scheduler";
import {
  createMemoryLogger,
  logExecutionTransition,
  type ExecutionLogger,
} from "./observability";
import { makeExecutionError, classifyProviderFailure, isRetryableCode } from "./errors";
import type {
  GenerationExecution,
  ProviderGenerationRequest,
  ProductionExecutionState,
  ExecutionError,
} from "./types";
import type { ProductionAsset } from "../../../domain/types";

import { CostEngine } from "../economics/costEngine";
import { submitWithReliability, buildSubmissionIdempotencyKey } from "./providerSubmission";
import { ReconciliationEngine } from "./reconciliationEngine";
import { normalizeProviderStatus } from "./adapters/types";
import { classifyRetryability } from "./errors";
import type { CreditService } from "../credits";
import { ProviderPayloadCompiler } from "../compiler/payloadCompiler";
import { getCapabilityProfile } from "../capability/registry";
import { createRuntimeAdapterPorts } from "./runtimePorts";
import { assertVisualPlanExecutable, applyLongFormVisualPlanning } from "../generation/strategyResolver";

export interface ExecutionEngineOptions {
  ports?: AdapterPorts;
  adapters?: Map<string, MediaProviderAdapter>;
  persistPort?: AssetPersistPort;
  idempotencyStore?: IdempotencyStore;
  logger?: ExecutionLogger;
  scheduler?: SchedulerConfig;
  backoff?: BackoffPolicy;
  brandId?: string;
  creditService?: CreditService;
  userId?: string;
  /** Live paid generation must reserve before submit. Tests omit this. */
  requireCredits?: boolean;
  /** Intentional regenerate: do not reuse a succeeded execution for the same input. */
  forceNewExecution?: boolean;
  lookupFn?: (idempotencyKey: string, requestId?: string) => Promise<import("./types").ProviderJobStatus | null>;
  /** Injected delay (tests can set 0) */
  sleep?: (ms: number) => Promise<void>;
  /** Dry-run: validate + schedule without calling adapters */
  dryRun?: boolean;
  /** Enrich output metadata (dimensions/duration) — injectable */
  measureOutput?: (url: string, mediaType: string) => Promise<{
    width?: number;
    height?: number;
    durationSec?: number;
    fileSizeBytes?: number;
  }>;
  onExecutionUpdate?: (execution: GenerationExecution) => void;
}

export interface ExecutionEngineResult {
  ok: boolean;
  state: ProductionExecutionState;
  tasks: GenerationTask[];
  executions: GenerationExecution[];
  assets: ProductionAsset[];
  dag: ProductionDag;
  errors: string[];
}

function newExecutionId(): string {
  return `exec_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function mediaTypeForTask(task: GenerationTask): "image" | "video" | "audio" {
  if (task.kind === "keyframe") return "image";
  if (task.kind === "voice" || task.kind === "sfx" || task.kind === "music") return "audio";
  return "video";
}

function applyTransition(
  execution: GenerationExecution,
  to: GenerationExecution["status"]
): GenerationExecution {
  const t = transitionStatus(execution.status, to);
  if (!t.ok) {
    throw makeExecutionError("invalid_request", t.error, { retryable: false });
  }
  return { ...execution, status: t.status };
}

export class GenerationExecutionEngine {
  private adapters: Map<string, MediaProviderAdapter>;
  private persistPort: AssetPersistPort;
  private idempotency: IdempotencyStore;
  private logger: ExecutionLogger;
  private opts: ExecutionEngineOptions;
  private cancelled = new Set<string>();
  private executions: GenerationExecution[] = [];
  private assets: ProductionAsset[] = [];

  constructor(opts: ExecutionEngineOptions = {}) {
    this.opts = opts;
    const defaultPorts = opts.ports !== undefined ? opts.ports : createRuntimeAdapterPorts();
    this.adapters = opts.adapters || createDefaultAdapterRegistry(defaultPorts);
    this.persistPort = opts.persistPort || createMemoryAssetPersistPort();
    this.idempotency = opts.idempotencyStore || createMemoryIdempotencyStore();
    this.logger = opts.logger || createMemoryLogger();
  }

  getExecutions(): GenerationExecution[] {
    return [...this.executions];
  }

  getAssets(): ProductionAsset[] {
    return [...this.assets];
  }

  cancelTask(taskId: string): { ok: boolean; reason: string } {
    this.cancelled.add(taskId);
    const active = this.executions.filter((e) => e.taskId === taskId && !isTerminalStatus(e.status));
    for (const exec of active) {
      try {
        const next = applyTransition(exec, exec.status === "failed" ? "cancelled" : "cancelled");
        next.completedAt = new Date().toISOString();
        next.error = makeExecutionError("cancelled", "Cancellation requested", { retryable: false });
        this.replaceExecution(next);
        logExecutionTransition(this.logger, next);
          const adapter = resolveAdapterForTask(this.adapters, exec.provider, "video");
        if (exec.providerJobId && adapter?.cancel) {
          void adapter.cancel(exec.providerJobId);
        }
      } catch {
        // ignore transition race
      }
    }
    return { ok: true, reason: active.length ? "cancel_recorded" : "queued_cancel_marked" };
  }

  async executePlan(params: {
    spec: ProductionSpec;
    tasks: GenerationTask[];
    dag: ProductionDag;
  }): Promise<ExecutionEngineResult> {
    params = { ...params, spec: applyLongFormVisualPlanning(params.spec) };
    assertVisualPlanExecutable(params.spec);
    let tasks = params.tasks.map((t) => ({ ...t }));
    let dag = params.dag;
    const errors: string[] = [];
    const priorOutputs: Record<string, string> = {};
    const running = new Set<string>();
    const sleep = this.opts.sleep || sleepMs;

    // Validate tasks
    for (const task of tasks) {
      const verr = validateGenerationTask(task);
      if (verr.length) {
        errors.push(`${task.id}: ${verr.join(", ")}`);
        task.status = "failed";
        task.lastError = verr.join(", ");
      }
    }
    for (const task of tasks) {
      if (task.status !== "succeeded" || this.opts.dryRun) continue;
      const shot = params.spec.scenes.flatMap(scene => scene.shots).find(shot => shot.id === task.shotId);
      if (task.kind === "keyframe" && shot && usesSourceVisual(shot) && task.completedOutput?.inputHash !== buildTaskInputHash(task, JSON.stringify(shot.visualPlan), [])) {
        throw new Error(`Source visual changed since completion for ${task.id}; explicitly regenerate the shot before reuse`);
      }
      const restored = restoreTaskOutput(task, this.opts.brandId || params.spec.project.brandId);
      if (!restored) {
        task.status = "failed";
        task.reconciliationRequired = true;
        task.lastError = "Completed task has no valid saved output; recover its asset before retrying";
        errors.push(`${task.id}: ${task.lastError}`);
        dag = markNode(dag, task.id, "failed", task.lastError);
        continue;
      }
      this.replaceExecution(restored.execution);
      if (!this.assets.some(asset => asset.id === restored.asset.id)) this.assets.push(restored.asset);
      priorOutputs[task.id] = restored.asset.publicUrl!;
      if (task.completedOutput?.lastFrameUrl) priorOutputs[`${task.id}__last_frame`] = task.completedOutput.lastFrameUrl;
      dag = markNode(dag, task.id, "done");
    }
    if (tasks.every((t) => t.status === "failed")) {
      return {
        ok: false,
        state: "failed",
        tasks,
        executions: this.executions,
        assets: this.assets,
        dag,
        errors,
      };
    }

    // Queue valid tasks
    tasks = tasks.map((t) => {
      if (t.status === "failed") return t;
      if (t.reconciliationRequired) return { ...t, status: "running" };
      if (this.cancelled.has(t.id)) return { ...t, status: "skipped", lastError: "cancelled" };
      if (t.status === "queued" || t.status === "succeeded" || t.status === "running" || t.status === "skipped") return t;
      const dagNode = dag?.nodes?.find((n) => n.id === t.id);
      const effectiveDeps = dagNode ? dagNode.dependsOn : t.dependsOn;
      return { ...t, status: effectiveDeps.length ? "blocked" : "queued" };
    });

    let guard = 0;
    const maxIterations = Math.max(50, tasks.length * 8);

    while (guard++ < maxIterations) {
      // Mark blocked→queued when deps succeeded
      tasks = tasks.map((t) => {
        if (t.status !== "blocked" && t.status !== "planned") return t;
        if (this.cancelled.has(t.id)) return { ...t, status: "skipped", lastError: "cancelled" };
        const dagNode = dag?.nodes?.find((n) => n.id === t.id);
        const effectiveDeps = dagNode ? dagNode.dependsOn : t.dependsOn;
        if (effectiveDeps.some((d) => tasks.find((x) => x.id === d)?.status === "failed")) {
          return { ...t, status: "skipped", lastError: "dependency_failed" };
        }
        if (
          effectiveDeps.every((d) => {
            const dep = tasks.find((x) => x.id === d);
            if (!dep) {
              const dagDep = dag?.nodes?.find((n) => n.id === d);
              return !dagDep || dagDep.status === "done" || dagDep.status === "ready";
            }
            return dep.status === "succeeded" || dep.status === "skipped";
          })
        ) {
          return { ...t, status: "queued" };
        }
        return t;
      });

      const terminal = tasks.every(
        (t) => t.status === "succeeded" || t.status === "failed" || t.status === "skipped"
      );
      if (terminal && running.size === 0) break;

      const batch = selectReadyBatch({
        dag,
        tasks,
        runningTaskIds: running,
        cancelledTaskIds: this.cancelled,
        config: this.opts.scheduler,
      });

      if (!batch.taskIds.length && running.size === 0) {
        // Deadlock / nothing left
        break;
      }

      const runners = batch.taskIds.map(async (taskId) => {
        running.add(taskId);
        try {
          const idx = tasks.findIndex((t) => t.id === taskId);
          if (idx < 0) return;
          let task = tasks[idx];
          if (this.cancelled.has(taskId)) {
            tasks[idx] = { ...task, status: "skipped", lastError: "cancelled" };
            return;
          }

          tasks[idx] = { ...task, status: "running" };
          dag = markNode(dag, taskId, "running");

          try {
            const result = await this.executeSingleTask({
              spec: params.spec,
              task,
              priorOutputs,
            });

            this.replaceExecution(result.execution);
            if (result.asset && !this.assets.some(asset => asset.id === result.asset!.id)) this.assets.push(result.asset);

            if (result.execution.status === "succeeded") {
              tasks[idx] = {
                ...tasks[idx],
                status: "succeeded",
                reconciliationRequired: false,
                productionAssetId: result.asset?.id,
                completedOutput: checkpointTaskOutput(result.execution, result.asset),
                lastError: undefined,
              };
              dag = markNode(dag, taskId, "done");
              if (result.asset?.publicUrl) {
                priorOutputs[taskId] = result.asset.publicUrl;
                const lastFrame = result.execution.metadata?.lastFrameDataUrl;
                if (typeof lastFrame === "string") {
                  priorOutputs[`${taskId}__last_frame`] = lastFrame;
                }
              }
            } else if (executionNeedsReconciliation(result.execution)) {
              // Unknown/in-flight work is not a failed task eligible for retry.
              tasks[idx] = { ...tasks[idx], status: "running", reconciliationRequired: true, lastError: result.execution.error?.message || "Execution requires reconciliation before resubmission" };
              errors.push(`${taskId}: ${tasks[idx].lastError}`);
            } else if (result.execution.status === "cancelled") {
              tasks[idx] = { ...tasks[idx], status: "skipped", lastError: "cancelled" };
              dag = markNode(dag, taskId, "skipped");
            } else {
              tasks[idx] = {
                ...tasks[idx],
                status: "failed",
                lastError: result.execution.error?.message || "execution_failed",
                retryCount: result.execution.attempt,
              };
              dag = markNode(dag, taskId, "failed", result.execution.error?.message);
              errors.push(`${taskId}: ${tasks[idx].lastError}`);
            }
          } catch (err: any) {
            const msg = String(err?.message || err?.code || err || "execution_throw");
            tasks[idx] = { ...tasks[idx], status: "failed", lastError: msg };
            dag = markNode(dag, taskId, "failed", msg);
            errors.push(`${taskId}: ${msg}`);
          }
        } finally {
          running.delete(taskId);
        }
      });

      await Promise.all(runners);
    }

    const state = deriveProductionState(tasks);
    return {
      ok: state === "completed" || state === "partially_complete",
      state,
      tasks,
      executions: this.executions,
      assets: this.assets,
      dag,
      errors,
    };
  }

  private replaceExecution(next: GenerationExecution): void {
    if (next.inputHash) {
      this.idempotency.set(idempotencyKey(next.productionId, next.taskId, next.inputHash), next);
    }
    const i = this.executions.findIndex((e) => e.id === next.id);
    if (i >= 0) this.executions[i] = next;
    else this.executions.push(next);
    this.opts.onExecutionUpdate?.(next);
  }

  /** Persist in-flight identity before any provider submit. Does not publish a partial result. */
  private async checkpoint(execution: GenerationExecution): Promise<GenerationExecution> {
    const next: GenerationExecution = {
      ...execution,
      metadata: {
        ...(execution.metadata || {}),
        checkpointAt: new Date().toISOString(),
      },
    };
    if (next.inputHash) {
      const key = idempotencyKey(next.productionId, next.taskId, next.inputHash);
      this.idempotency.set(key, next);
      await this.idempotency.flush?.(key);
    }
    return next;
  }

  /**
   * Execute one GenerationTask under canonical semantics.
   * Single task execution boundary for live migration and direct execution.
   */
  public async executeTask(params: {
    spec: ProductionSpec;
    task: GenerationTask;
    priorOutputs?: Record<string, string>;
  }): Promise<{ execution: GenerationExecution; asset?: ProductionAsset; task: GenerationTask }> {
    if (params.task.reconciliationRequired) {
      throw new Error(`Generation requires reconciliation before resubmission: ${params.task.id}`);
    }
    const priorOutputs = params.priorOutputs || {};
    const result = await this.executeSingleTask({
      spec: params.spec,
      task: params.task,
      priorOutputs,
    });
    this.replaceExecution(result.execution);
    if (result.asset) {
      const existingAssetIdx = this.assets.findIndex((a) => a.id === result.asset!.id);
      if (existingAssetIdx >= 0) {
        this.assets[existingAssetIdx] = result.asset;
      } else {
        this.assets.push(result.asset);
      }
    }
    const updatedTask: GenerationTask = {
      ...params.task,
      status: result.execution.status === "succeeded"
        ? "succeeded"
        : executionNeedsReconciliation(result.execution)
          ? "running"
        : result.execution.status === "cancelled"
          ? "skipped"
          : "failed",
      productionAssetId: result.asset?.id || params.task.productionAssetId,
      completedOutput: checkpointTaskOutput(result.execution, result.asset),
      lastError: result.execution.error?.message,
      retryCount: result.execution.attempt,
      reconciliationRequired: executionNeedsReconciliation(result.execution),
    };
    Object.assign(params.task, updatedTask);
    return { ...result, task: updatedTask };
  }

  private async executeSingleTask(params: {
    spec: ProductionSpec;
    task: GenerationTask;
    priorOutputs: Record<string, string>;
  }): Promise<{ execution: GenerationExecution; asset?: ProductionAsset }> {
    const { spec, task, priorOutputs } = params;
    const visualSpec = applyLongFormVisualPlanning(spec);
    assertVisualPlanExecutable(visualSpec);
    const visualShot = visualSpec.scenes.flatMap(scene => scene.shots).find(shot => shot.id === task.shotId);
    const visualKind = visualShot?.visualPlan?.kind;
    const sourceHash = task.kind === "keyframe" && visualShot && usesSourceVisual(visualShot)
      ? buildTaskInputHash(task, JSON.stringify(visualShot.visualPlan), []) : undefined;
    if (task.kind === "video" && visualKind && visualKind !== "VIDEO") {
      throw makeExecutionError("invalid_request", "Visual plan does not authorize AI video for this shot", { retryable: false, retryability: "DO_NOT_RETRY" });
    }
    if (task.status === "succeeded" && !this.opts.dryRun) {
      if (sourceHash && task.completedOutput?.inputHash !== sourceHash) {
        throw makeExecutionError("invalid_request", "Source visual changed since completion; explicitly regenerate the shot before reuse", { retryable: false, retryability: "DO_NOT_RETRY" });
      }
      const restored = restoreTaskOutput(task, this.opts.brandId || spec.project.brandId);
      if (!restored) {
        task.reconciliationRequired = true;
        throw makeExecutionError("output_unavailable", "Completed task has no valid saved output; recover its asset before retrying", { retryable: false, retryability: "DO_NOT_RETRY" });
      }
      return restored;
    }
    if (!this.opts.dryRun && task.kind === "keyframe" && visualShot && usesSourceVisual(visualShot)) {
      const plan = visualShot.visualPlan!;
      const sourceUrl = plan.source?.url || await renderVisualGraphic(visualShot);
      if (this.cancelled.has(task.id)) throw makeExecutionError("cancelled", "Source media execution cancelled", { retryable: false });
      const mediaType = plan.source?.mediaType || "image";
      const now = new Date().toISOString();
      const execution: GenerationExecution = {
        id: newExecutionId(), taskId: task.id, productionId: task.productionId,
        sceneId: task.sceneId, shotId: task.shotId, provider: "source_media", inputHash: sourceHash,
        status: "succeeded", attempt: 1, maxAttempts: 1, startedAt: now, completedAt: now,
        inputAssets: [], outputAssets: [], usage: { actualCost: 0, currency: "USD" },
        metadata: { visualKind: plan.kind, attribution: plan.source?.attribution || plan.graphic?.sourceLabel, sourceAssetId: plan.source?.assetId },
      };
      const asset = await persistNormalizedOutput({
        output: { mediaType, sourceUrl, mimeType: mediaType === "image" ? "image/png" : "video/mp4",
          providerJobId: execution.id, metadata: execution.metadata || {}, durationSec: visualShot.durationSec },
        execution, task, brandId: this.opts.brandId || spec.project.brandId, persistPort: this.persistPort,
      });
      execution.outputAssets = [{ mediaType, sourceUrl, productionAssetId: asset.id, mimeType: asset.mimeType }];
      return { execution, asset };
    }
    if (!this.opts.dryRun && task.kind === "merge" && task.dependsOn.some(dep => !priorOutputs[dep])) {
      throw makeExecutionError("dependency_failed", "Merge is missing a required media output", { retryable: false, retryability: "DO_NOT_RETRY" });
    }
    const prepared = prepareTaskInputs({ spec, task, priorOutputs });
    const inputHash = buildTaskInputHash(
      task,
      prepared.prompt,
      prepared.inputs.map((i) => i.url || i.assetRef || "")
    );

    try {
      await this.idempotency.hydrate?.(task.productionId);
    } catch (hydrateErr: any) {
      const execution: GenerationExecution = {
        id: newExecutionId(),
        taskId: task.id,
        productionId: task.productionId,
        sceneId: task.sceneId,
        shotId: task.shotId,
        provider: prepared.provider,
        model: prepared.model,
        status: "failed",
        attempt: (task.retryCount || 0) + 1,
        maxAttempts: task.maxRetries ?? DEFAULT_BACKOFF_POLICY.maxAttempts,
        inputAssets: prepared.inputs,
        outputAssets: [],
        inputHash,
        completedAt: new Date().toISOString(),
        error: makeExecutionError(
          "unknown",
          `Durable execution state could not be loaded: ${hydrateErr?.message || hydrateErr}`,
          { retryable: false, retryability: "RECONCILE_FIRST" }
        ),
      };
      return { execution };
    }

    const reusable = findReusableExecution(
      this.idempotency,
      task.productionId,
      task.id,
      inputHash
    );
    if (reusable?.status === "succeeded" && !this.opts.forceNewExecution) {
      const asset = restoreExecutionAsset(reusable, task, this.opts.brandId);
      if (!asset && !this.opts.dryRun) {
        task.reconciliationRequired = true;
        throw makeExecutionError("output_unavailable", "Completed execution has no restorable asset; recover its output before retrying", { retryable: false, retryability: "DO_NOT_RETRY" });
      }
      return { execution: { ...reusable, metadata: { ...reusable.metadata, idempotentReuse: true } }, asset };
    }
    if (reusable && executionNeedsReconciliation(reusable)) {
      return {
        execution: {
          ...reusable,
          error: reusable.error || makeExecutionError("idempotent_reuse", "Execution requires reconciliation before resubmission", {
            retryable: false,
          }),
        },
      };
    }

    const maxAttempts = task.maxRetries ?? DEFAULT_BACKOFF_POLICY.maxAttempts;
    let attempt = (task.retryCount || 0) + 1;
    let provider = prepared.provider;
    let fallbackIndex = 0;
    const fallbacks = task.fallbackProviders || [];

    let lastExecution: GenerationExecution | undefined;
    let guard = 0;
    let reservedCredits: { reservationId: string; amount: number } | undefined;
    let accumulatedCostUsd = 0;

    const totalMaxGuard = (fallbacks.length + 1) * (maxAttempts + 2);
    while (guard++ < totalMaxGuard) {
      if (this.cancelled.has(task.id)) {
        const cancelled: GenerationExecution = {
          id: newExecutionId(),
          taskId: task.id,
          productionId: task.productionId,
          sceneId: task.sceneId,
          shotId: task.shotId,
          provider,
          model: prepared.model,
          status: "cancelled",
          attempt,
          maxAttempts,
          inputAssets: prepared.inputs,
          outputAssets: [],
          inputHash,
          completedAt: new Date().toISOString(),
          error: makeExecutionError("cancelled", "Cancelled before submit", { retryable: false }),
        };
        this.idempotency.set(idempotencyKey(task.productionId, task.id, inputHash), cancelled);
        return { execution: cancelled };
      }

      let execution: GenerationExecution = {
        id: newExecutionId(),
        taskId: task.id,
        productionId: task.productionId,
        sceneId: task.sceneId,
        shotId: task.shotId,
        provider,
        model: prepared.model,
        status: "pending",
        attempt,
        maxAttempts,
        inputAssets: prepared.inputs,
        outputAssets: [],
        inputHash,
        metadata: { prompt: prepared.prompt },
        startedAt: new Date().toISOString(),
      };
      execution = applyTransition(execution, "queued");
      this.idempotency.set(idempotencyKey(task.productionId, task.id, inputHash), execution);
      logExecutionTransition(this.logger, execution);

      if (this.opts.dryRun) {
        execution = applyTransition(execution, "running");
        execution = applyTransition(execution, "succeeded");
        execution.completedAt = new Date().toISOString();
        execution.outputAssets = [
          {
            mediaType: mediaTypeForTask(task),
            sourceUrl: `dryrun://${task.id}`,
            mimeType: mediaTypeForTask(task) === "audio" ? "audio/mpeg" : mediaTypeForTask(task) === "image" ? "image/png" : "video/mp4",
          },
        ];
        logExecutionTransition(this.logger, execution);
        return { execution };
      }

      // Phase 5 Pre-Execution Capability Guard (only for generative AI tasks)
      if (task.kind !== "merge" && task.kind !== "short_cut") {
        const capRequirements = capabilityRequirementsFromTask(task, prepared.inputs, {
          aspectRatio: prepared.aspectRatio,
          durationSec: prepared.durationSec,
          resolution: prepared.resolution,
        });
        const capCheck = assertExecutableCapability(capRequirements, provider, prepared.model);
        if (!capCheck.ok) {
          const rejectCodes = capCheck.decision.reasonCodes.filter((r) => r.startsWith("REJECTED"));
          const err = makeExecutionError(
            "unsupported_capability",
            `Capability validation failed for provider "${provider}": ${rejectCodes.join(", ") || "unsupported_capability"}`,
            { retryable: false, reasons: rejectCodes }
          );
          execution = applyTransition(execution, "running");
          execution = applyTransition(execution, "failed");
          execution.error = err;
          execution.completedAt = new Date().toISOString();
          lastExecution = execution;
          // try fallback
          if (fallbackIndex < fallbacks.length) {
            provider = fallbacks[fallbackIndex++];
            attempt++;
            execution = applyTransition(execution, "retrying");
            logExecutionTransition(this.logger, execution, { fallbackUsed: provider });
            continue;
          }
          execution = applyTransition(execution, "exhausted");
          return { execution };
        }
      }


      const adapter = resolveAdapterForTask(this.adapters, provider, task.kind);
      if (!adapter) {
        const err = makeExecutionError(
          "unsupported_capability",
          `No adapter registered for provider ${provider}`,
          { retryable: false }
        );
        execution = applyTransition(execution, "running");
        execution = applyTransition(execution, "failed");
        execution.error = err;
        execution.completedAt = new Date().toISOString();
        lastExecution = execution;
        // try fallback
        if (fallbackIndex < fallbacks.length) {
          provider = fallbacks[fallbackIndex++];
          attempt++;
          execution = applyTransition(execution, "retrying");
          logExecutionTransition(this.logger, execution, { fallbackUsed: provider });
          continue;
        }
        execution = applyTransition(execution, "exhausted");
        return { execution };
      }

      try {
        execution = applyTransition(execution, "preparing");
        logExecutionTransition(this.logger, execution);

        // Video I2V requires first frame
        if (task.kind === "video" && !prepared.inputs.some((i) => i.role === "first_frame" && i.url)) {
          throw makeExecutionError(
            "invalid_request",
            "Video task missing first_frame input",
            { retryable: false, reasons: ["missing_first_frame"] }
          );
        }

        const costModality: "video" | "image" | "audio" =
          task.kind === "keyframe"
            ? "image"
            : task.kind === "voice" || task.kind === "sfx" || task.kind === "music"
            ? "audio"
            : "video";

        // Cost estimation (Phase 7 CostEngine)
        const est = CostEngine.estimateCost({
          providerId: provider,
          modelId: prepared.model || "",
          modality: costModality,
          durationSeconds: prepared.durationSec,
          resolution: prepared.resolution,
        });
        const estCostUsd = est.amount ?? 0;
        const paidGenerative =
          task.kind === "keyframe" ||
          task.kind === "video" ||
          task.kind === "voice" ||
          task.kind === "sfx" ||
          task.kind === "music";

        if (this.opts.requireCredits && paidGenerative) {
          if (!this.opts.creditService || !this.opts.userId) {
            const err = makeExecutionError(
              "insufficient_credits",
              "Live generation requires CreditService and userId before provider submit",
              { retryable: false }
            );
            execution = applyTransition(execution, "failed");
            execution.error = err;
            execution.completedAt = new Date().toISOString();
            return { execution: await this.checkpoint(execution) };
          }
          if (est.status === "UNKNOWN") {
            const err = makeExecutionError(
              "invalid_request",
              "Unknown provider cost — refusing to reserve zero or submit as free",
              { retryable: false }
            );
            execution = applyTransition(execution, "failed");
            execution.error = err;
            execution.completedAt = new Date().toISOString();
            return { execution: await this.checkpoint(execution) };
          }
        }

        // Credit reservation (Phase 8 CreditService)
        if (this.opts.creditService && this.opts.userId && est.status !== "UNKNOWN" && estCostUsd > 0 && !reservedCredits) {
          try {
            const quote = this.opts.creditService.quote({
              estimatedCostUsd: estCostUsd,
              generationId: task.id,
            });
            const res = await this.opts.creditService.reserve({
              quote,
              userId: this.opts.userId,
              idempotencyKey: `res_${task.productionId}_${task.id}`,
              metadata: { provider, model: prepared.model, taskId: task.id },
            });
            reservedCredits = {
              reservationId: res.reservation.id,
              amount: res.reservation.amount,
            };
            execution.metadata = {
              ...(execution.metadata || {}),
              reservationId: res.reservation.id,
            };
            execution = applyTransition(execution, "credit_reserved");
            logExecutionTransition(this.logger, execution);
          } catch (creditErr: any) {
            const err = makeExecutionError("insufficient_credits", creditErr?.message || "Insufficient credits", {
              retryable: false,
            });
            execution = applyTransition(execution, "failed");
            execution.error = err;
            execution.completedAt = new Date().toISOString();
            return { execution };
          }
        }

        // Phase 10 — Provider Payload Compilation
        let compiledRequest: import("../compiler/types").CompiledProviderRequest | undefined;
        let shotForTask: import("../specification/shotSpec").ShotSpec | undefined;
        for (const scene of spec.scenes || []) {
          const s = scene.shots?.find((sh) => sh.id === task.shotId);
          if (s) {
            shotForTask = s;
            break;
          }
        }

        const profile = getCapabilityProfile(provider, prepared.model);
        if (shotForTask && profile) {
          compiledRequest = ProviderPayloadCompiler.compile({
            shot: shotForTask,
            craftPlan: shotForTask.craftPlan,
            referenceGraph: spec.referenceGraph,
            styleBible: spec.styleBible,
            capabilityProfile: profile,
            providerId: provider,
            modelId: prepared.model || profile.modelId,
            productionId: task.productionId,
            sceneId: task.sceneId,
          });

          if (!compiledRequest.validation.valid) {
            const err = makeExecutionError(
              "invalid_request",
              `Provider payload compilation failed: ${compiledRequest.validation.errors.join("; ")}`,
              {
                retryable: false,
                reasons: compiledRequest.validation.errors,
              }
            );

            // Release credit reservation safely on compilation failure (NOT_SUBMITTED)
            if (reservedCredits && this.opts.creditService && this.opts.userId) {
              await this.opts.creditService.release({
                reservationId: reservedCredits.reservationId,
                userId: this.opts.userId,
                reason: err.message,
              });
              reservedCredits = undefined;
            }

            execution = applyTransition(execution, "failed");
            execution.error = err;
            execution.completedAt = new Date().toISOString();
            execution = applyTransition(execution, "exhausted");
            return { execution };
          }
        }

        const request: ProviderGenerationRequest = {
          providerId: provider,
          model: prepared.model,
          modality: task.strategy.modality,
          prompt: compiledRequest ? compiledRequest.prompt : prepared.prompt,
          negativePrompt: compiledRequest ? compiledRequest.negativePrompt : prepared.negativePrompt,
          aspectRatio: (compiledRequest?.parameters?.aspectRatio as string) || prepared.aspectRatio,
          durationSec: (compiledRequest?.parameters?.durationSec as number) || prepared.durationSec,
          resolution: (compiledRequest?.parameters?.resolution as string) || prepared.resolution,
          productionId: task.productionId,
          brandId: this.opts.brandId,
          taskId: task.id,
          executionId: execution.id,
          inputs: prepared.inputs,
          compiledRequest,
        };

        execution = applyTransition(execution, "submitting");
        if (reservedCredits) {
          execution.metadata = {
            ...(execution.metadata || {}),
            reservationId: reservedCredits.reservationId,
          };
        }
        logExecutionTransition(this.logger, execution);
        execution = await this.checkpoint(execution);

        const subResult = await submitWithReliability(adapter, request, {
          attempt,
          inputHash,
        });

        if (subResult.outcome === "NOT_SUBMITTED") {
          if (reservedCredits && this.opts.creditService && this.opts.userId) {
            await this.opts.creditService.release({
              reservationId: reservedCredits.reservationId,
              userId: this.opts.userId,
              reason: subResult.error.message,
            });
            reservedCredits = undefined;
          }

          const retryability = subResult.error.retryability || classifyRetryability(subResult.error);
          execution = applyTransition(execution, "failed");
          execution.error = subResult.error;
          execution.completedAt = new Date().toISOString();
          lastExecution = execution;

          if (retryability === "DO_NOT_RETRY") {
            execution = applyTransition(execution, "exhausted");
            return { execution: await this.checkpoint(execution) };
          }

          if (retryability === "SAFE_TO_RETRY" && attempt < maxAttempts) {
            attempt++;
            execution = applyTransition(execution, "retrying");
            logExecutionTransition(this.logger, execution);
            await (this.opts.sleep || sleepMs)(computeBackoffDelayMs(attempt, this.opts.backoff));
            continue;
          }

          if (fallbackIndex < fallbacks.length) {
            provider = fallbacks[fallbackIndex++];
            attempt = 1;
            execution = applyTransition(execution, "retrying");
            logExecutionTransition(this.logger, execution, { fallbackUsed: provider });
            continue;
          }

          execution = applyTransition(execution, "exhausted");
          return { execution: await this.checkpoint(execution) };
        }

        if (subResult.outcome === "UNKNOWN_SUBMISSION") {
          if (reservedCredits && this.opts.creditService && this.opts.userId) {
            await this.opts.creditService.markPendingUnknown({
              reservationId: reservedCredits.reservationId,
              userId: this.opts.userId,
              reason: subResult.error.message,
            });
          }

          execution = applyTransition(execution, "unknown_submission");
          execution.error = subResult.error;
          if (reservedCredits) {
            execution.metadata = {
              ...(execution.metadata || {}),
              reservationId: reservedCredits.reservationId,
            };
          }
          logExecutionTransition(this.logger, execution);
          execution = await this.checkpoint(execution);

          // Reconcile
          execution = applyTransition(execution, "reconciling");
          const rec = await ReconciliationEngine.reconcile({
            adapter,
            executionId: execution.id,
            generationTaskId: task.id,
            attempt,
            idempotencyKey: buildSubmissionIdempotencyKey(task.productionId, task.id, attempt, inputHash),
            providerRequestId: (subResult.error.providerDiagnostics as any)?.providerRequestId,
            lookupFn: this.opts.lookupFn,
          });

          if (rec.status === "FOUND") {
            execution.providerJobId = rec.providerJobId;
            execution = applyTransition(execution, "submitted");
            logExecutionTransition(this.logger, execution);
            execution = await this.checkpoint(execution);
          } else if (rec.status === "CONFIRMED_NOT_SUBMITTED") {
            if (reservedCredits && this.opts.creditService && this.opts.userId) {
              await this.opts.creditService.release({
                reservationId: reservedCredits.reservationId,
                userId: this.opts.userId,
                reason: "reconciled_confirmed_not_submitted",
              });
              reservedCredits = undefined;
            }
            execution = applyTransition(execution, "failed");
            if (fallbackIndex < fallbacks.length) {
              provider = fallbacks[fallbackIndex++];
              attempt++;
              execution = applyTransition(execution, "retrying");
              continue;
            }
            execution = applyTransition(execution, "exhausted");
            return { execution: await this.checkpoint(execution) };
          } else {
            // STILL_UNKNOWN: preserve hold, do not retry
            execution.error = makeExecutionError(
              "unknown_submission",
              `Submission remains unknown after reconciliation: ${rec.reason}`,
              { retryable: false, retryability: "RECONCILE_FIRST" }
            );
            return { execution: await this.checkpoint(execution) };
          }
        }

        if (subResult.outcome === "SUBMITTED") {
          execution.providerJobId = subResult.providerJobId;
          execution = applyTransition(execution, "submitted");
          logExecutionTransition(this.logger, execution);
          execution = await this.checkpoint(execution);
        }

        execution = applyTransition(execution, "running");
        let status = await adapter.getStatus(execution.providerJobId!);
        let normStatus = adapter.normalizeStatus
          ? adapter.normalizeStatus(status.status)
          : normalizeProviderStatus(provider, status.status);

        if (normStatus === "RUNNING" || normStatus === "QUEUED") {
          execution = applyTransition(execution, "polling");
          logExecutionTransition(this.logger, execution);
          let polls = 0;
          while ((normStatus === "RUNNING" || normStatus === "QUEUED") && polls++ < 30) {
            if (this.cancelled.has(task.id)) {
              await adapter.cancel?.(execution.providerJobId!);
              execution = applyTransition(execution, "cancelled");
              execution.completedAt = new Date().toISOString();
              execution.error = makeExecutionError("cancelled", "Cancelled during polling", {
                retryable: false,
              });
              if (reservedCredits && this.opts.creditService && this.opts.userId) {
                await this.opts.creditService.release({
                  reservationId: reservedCredits.reservationId,
                  userId: this.opts.userId,
                  reason: "cancelled_during_polling",
                });
              }
              return { execution };
            }
            await (this.opts.sleep || sleepMs)(computeBackoffDelayMs(polls, this.opts.backoff));
            try {
              status = await adapter.getStatus(execution.providerJobId!);
              normStatus = adapter.normalizeStatus
                ? adapter.normalizeStatus(status.status)
                : normalizeProviderStatus(provider, status.status);
            } catch (pollErr: any) {
              logExecutionTransition(this.logger, execution);
            }
          }
        }

        if (normStatus !== "SUCCEEDED") {
          const attemptCost = CostEngine.calculateActualCost({
            providerId: provider,
            modelId: prepared.model || "",
            modality: costModality,
            requestConfig: {
              providerId: provider,
              modelId: prepared.model || "",
              modality: costModality,
              durationSeconds: prepared.durationSec,
              resolution: prepared.resolution,
            },
          });
          const attemptCostUsd = attemptCost.amount ?? 0;
          if (attemptCost.status !== "UNKNOWN" && attemptCostUsd > 0) {
            accumulatedCostUsd += attemptCostUsd;
          }

          if (reservedCredits && this.opts.creditService && this.opts.userId) {
            if (attempt >= maxAttempts && fallbackIndex >= fallbacks.length) {
              if (accumulatedCostUsd > 0) {
                await this.opts.creditService.settle({
                  reservationId: reservedCredits.reservationId,
                  userId: this.opts.userId,
                  actualProviderCostUsd: accumulatedCostUsd,
                });
              } else {
                await this.opts.creditService.release({
                  reservationId: reservedCredits.reservationId,
                  userId: this.opts.userId,
                  reason: "provider_job_failed_unbilled",
                });
              }
            }
          }

          throw makeExecutionError(
            classifyProviderFailure(status.errorMessage || "generation_failed"),
            status.errorMessage || "Provider job failed",
            { diagnostics: { providerJobId: execution.providerJobId } }
          );
        }

        let output: NormalizedMediaOutput;
        if (adapter.normalizeResult) {
          const normResult = await adapter.normalizeResult(status);
          output = normalizedResultToMediaOutput(normResult);
        } else {
          output = await adapter.normalizeOutput(status);
        }

        if (this.opts.measureOutput && output.sourceUrl) {
          const measured = await this.opts.measureOutput(output.sourceUrl, output.mediaType);
          output = enrichOutputMetadata(output, measured);
        } else {
          output = enrichOutputMetadata(output, {
            fileSizeBytes: output.fileSizeBytes ?? 2048,
            durationSec: output.durationSec ?? prepared.durationSec,
            width: output.width,
            height: output.height,
          });
        }

        const validation = validateNormalizedOutput(
          output,
          expectationsFromPrepared(prepared, output.mediaType)
        );
        if (!validation.ok) {
          throw makeExecutionError(validation.code || "output_invalid", "Technical validation failed", {
            retryable: validation.retryable,
            reasons: validation.reasons,
          });
        }

        const asset = await persistNormalizedOutput({
          output,
          execution,
          task,
          brandId: this.opts.brandId,
          persistPort: this.persistPort,
        });

        // Compute actual cost and settle credits (reporting usage facts from adapter to CostEngine)
        const usageFacts = adapter.extractUsage ? adapter.extractUsage(status) : undefined;
        const actual = CostEngine.calculateActualCost({
          providerId: provider,
          modelId: prepared.model || "",
          modality: costModality,
          usage: usageFacts || {
            durationSeconds: output.durationSec ?? prepared.durationSec,
            resolution: prepared.resolution,
          },
          requestConfig: {
            providerId: provider,
            modelId: prepared.model || "",
            modality: costModality,
            durationSeconds: output.durationSec ?? prepared.durationSec,
            resolution: prepared.resolution,
          },
        });
        const actualCostUsd = actual.amount ?? 0;
        accumulatedCostUsd += actualCostUsd;

        if (reservedCredits && this.opts.creditService && this.opts.userId) {
          await this.opts.creditService.settle({
            reservationId: reservedCredits.reservationId,
            userId: this.opts.userId,
            actualProviderCostUsd: accumulatedCostUsd,
          });
        }

        execution = applyTransition(execution, "succeeded");
        execution.completedAt = new Date().toISOString();
        execution.outputAssets = [
          {
            mediaType: output.mediaType,
            productionAssetId: asset.id,
            sourceUrl: output.sourceUrl,
            persistentUrl: asset.publicUrl,
            mimeType: output.mimeType,
            width: output.width,
            height: output.height,
            durationSec: output.durationSec,
          },
        ];
        execution.usage = {
          estimatedCost: estCostUsd,
          actualCost: accumulatedCostUsd,
          currency: "USD",
        };
        execution.metadata = {
          ...execution.metadata,
          lastFrameDataUrl: output.metadata?.lastFrameDataUrl,
        };
        this.idempotency.set(idempotencyKey(task.productionId, task.id, inputHash), execution);
        logExecutionTransition(this.logger, execution, { assetProduced: asset.id });
        execution = await this.checkpoint(execution);
        return { execution, asset };
      } catch (err: any) {
        if (reservedCredits && this.opts.creditService && this.opts.userId && attempt >= maxAttempts && fallbackIndex >= fallbacks.length) {
          if (accumulatedCostUsd > 0) {
            await this.opts.creditService.settle({
              reservationId: reservedCredits.reservationId,
              userId: this.opts.userId,
              actualProviderCostUsd: accumulatedCostUsd,
            }).catch(() => {});
          } else {
            await this.opts.creditService.release({
              reservationId: reservedCredits.reservationId,
              userId: this.opts.userId,
              reason: "execution_error_unbilled",
            }).catch(() => {});
          }
        }

        const error: ExecutionError =
          err?.code && err?.message
            ? {
                code: err.code,
                message: String(err.message),
                retryable: typeof err.retryable === "boolean" ? err.retryable : isRetryableCode(err.code),
                reasons: err.reasons,
                providerDiagnostics: err.providerDiagnostics,
              }
            : makeExecutionError(classifyProviderFailure(String(err?.message || err)), String(err?.message || err));

        execution = {
          ...execution,
          status: "failed",
          error,
          completedAt: new Date().toISOString(),
        };
        lastExecution = execution;
        logExecutionTransition(this.logger, execution);

        // Auth or capability failures: do not loop
        if (error.code === "authentication_failed" || error.code === "unsupported_capability" || error.code === "insufficient_credits") {
          execution = { ...execution, status: "exhausted" };
          return { execution };
        }

        if (!error.retryable || attempt >= maxAttempts) {
          if (fallbackIndex < fallbacks.length) {
            const nextProvider = fallbacks[fallbackIndex++];
            execution = { ...execution, status: "retrying" };
            logExecutionTransition(this.logger, execution, { fallbackUsed: nextProvider });
            provider = nextProvider;
            attempt = 1;
            await (this.opts.sleep || sleepMs)(computeBackoffDelayMs(attempt, this.opts.backoff));
            continue;
          }
          execution = { ...execution, status: "exhausted" };
          return { execution };
        }

        const decision: ShotRoutingDecision | undefined = spec.routing.shotDecisions.find(
          (d) => d.shotId === task.shotId
        );
        const shot = task.shotId
          ? spec.scenes.flatMap((s) => s.shots).find((s) => s.id === task.shotId)
          : undefined;
        if (shot && decision) {
          const retry = planShotRetry({
            shot: { ...shot, retry: { attempt, maxAttempts, lastFailureReasons: [error.code] } },
            failures: [error.code, ...(error.reasons || [])],
            routingDecision: decision,
            maxAttempts,
          });
          if (retry.providerChange && retry.nextProvider) {
            provider = retry.nextProvider;
          }
        }

        execution = { ...execution, status: "retrying" };
        logExecutionTransition(this.logger, execution);
        attempt++;
        const delay = computeBackoffDelayMs(
          attempt,
          this.opts.backoff,
          typeof error.providerDiagnostics?.retryAfterMs === "number"
            ? (error.providerDiagnostics.retryAfterMs as number)
            : undefined
        );
        await (this.opts.sleep || sleepMs)(delay);
      }
    }

    return {
      execution:
        lastExecution ||
        ({
          id: newExecutionId(),
          taskId: task.id,
          productionId: task.productionId,
          provider,
          status: "exhausted",
          attempt,
          maxAttempts,
          inputAssets: prepared.inputs,
          outputAssets: [],
          error: makeExecutionError("generation_failed", "Retry exhausted"),
        } as GenerationExecution),
    };
  }
}

/**
 * Canonical task execution entry point.
 * Executes one GenerationTask through the canonical engine.
 */
export async function executeGenerationTask(params: {
  spec: ProductionSpec;
  task: GenerationTask;
  engine?: GenerationExecutionEngine;
  options?: ExecutionEngineOptions;
  priorOutputs?: Record<string, string>;
}): Promise<{ execution: GenerationExecution; asset?: ProductionAsset; task: GenerationTask }> {
  const engine = params.engine || new GenerationExecutionEngine(params.options || {});
  return engine.executeTask(params);
}
