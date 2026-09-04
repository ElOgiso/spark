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
  persistNormalizedOutput,
  type AssetPersistPort,
} from "./outputNormalization";
import {
  buildTaskInputHash,
  createMemoryIdempotencyStore,
  findReusableExecution,
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

export interface ExecutionEngineOptions {
  ports?: AdapterPorts;
  adapters?: Map<string, MediaProviderAdapter>;
  persistPort?: AssetPersistPort;
  idempotencyStore?: IdempotencyStore;
  logger?: ExecutionLogger;
  scheduler?: SchedulerConfig;
  backoff?: BackoffPolicy;
  brandId?: string;
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
    this.adapters = opts.adapters || createDefaultAdapterRegistry(opts.ports || {});
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
      if (this.cancelled.has(t.id)) return { ...t, status: "skipped", lastError: "cancelled" };
      return { ...t, status: t.dependsOn.length ? "blocked" : "queued" };
    });

    let guard = 0;
    const maxIterations = Math.max(50, tasks.length * 8);

    while (guard++ < maxIterations) {
      // Mark blocked→queued when deps succeeded
      tasks = tasks.map((t) => {
        if (t.status !== "blocked" && t.status !== "planned") return t;
        if (this.cancelled.has(t.id)) return { ...t, status: "skipped", lastError: "cancelled" };
        if (t.dependsOn.some((d) => tasks.find((x) => x.id === d)?.status === "failed")) {
          return { ...t, status: "skipped", lastError: "dependency_failed" };
        }
        if (t.dependsOn.every((d) => {
          const dep = tasks.find((x) => x.id === d);
          return dep?.status === "succeeded" || dep?.status === "skipped";
        })) {
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

            this.executions.push(result.execution);
            if (result.asset) this.assets.push(result.asset);

            if (result.execution.status === "succeeded") {
              tasks[idx] = {
                ...tasks[idx],
                status: "succeeded",
                productionAssetId: result.asset?.id,
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
    const i = this.executions.findIndex((e) => e.id === next.id);
    if (i >= 0) this.executions[i] = next;
    else this.executions.push(next);
    this.opts.onExecutionUpdate?.(next);
  }

  private async executeSingleTask(params: {
    spec: ProductionSpec;
    task: GenerationTask;
    priorOutputs: Record<string, string>;
  }): Promise<{ execution: GenerationExecution; asset?: ProductionAsset }> {
    const { spec, task, priorOutputs } = params;
    const prepared = prepareTaskInputs({ spec, task, priorOutputs });
    const inputHash = buildTaskInputHash(
      task,
      prepared.prompt,
      prepared.inputs.map((i) => i.url || i.assetRef || "")
    );

    const reusable = findReusableExecution(
      this.idempotency,
      task.productionId,
      task.id,
      inputHash
    );
    if (reusable?.status === "succeeded") {
      return { execution: { ...reusable, metadata: { ...reusable.metadata, idempotentReuse: true } } };
    }
    if (reusable && (reusable.status === "running" || reusable.status === "polling" || reusable.status === "queued")) {
      return {
        execution: {
          ...reusable,
          error: makeExecutionError("idempotent_reuse", "Execution already in flight", {
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

    while (attempt <= maxAttempts && guard++ < maxAttempts + 2) {
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
        execution = applyTransition(execution, "running");
        logExecutionTransition(this.logger, execution);

        // Video I2V requires first frame
        if (task.kind === "video" && !prepared.inputs.some((i) => i.role === "first_frame" && i.url)) {
          throw makeExecutionError(
            "invalid_request",
            "Video task missing first_frame input",
            { retryable: false, reasons: ["missing_first_frame"] }
          );
        }

        const request: ProviderGenerationRequest = {
          providerId: provider,
          model: prepared.model,
          modality: task.strategy.modality,
          prompt: prepared.prompt,
          negativePrompt: prepared.negativePrompt,
          aspectRatio: prepared.aspectRatio,
          durationSec: prepared.durationSec,
          resolution: prepared.resolution,
          productionId: task.productionId,
          brandId: this.opts.brandId,
          taskId: task.id,
          executionId: execution.id,
          inputs: prepared.inputs,
        };

        const job = await adapter.submit(request);
        execution.providerJobId = job.providerJobId;

        let status = await adapter.getStatus(job.providerJobId);
        if (status.status === "running" || status.status === "queued") {
          execution = applyTransition(execution, "polling");
          logExecutionTransition(this.logger, execution);
          // Bounded poll loop
          let polls = 0;
          while ((status.status === "running" || status.status === "queued") && polls++ < 30) {
            if (this.cancelled.has(task.id)) {
              await adapter.cancel?.(job.providerJobId);
              execution = applyTransition(execution, "cancelled");
              execution.completedAt = new Date().toISOString();
              execution.error = makeExecutionError("cancelled", "Cancelled during polling", {
                retryable: false,
              });
              return { execution };
            }
            await (this.opts.sleep || sleepMs)(computeBackoffDelayMs(polls, this.opts.backoff));
            status = await adapter.getStatus(job.providerJobId);
          }
        }

        if (status.status !== "succeeded") {
          throw makeExecutionError(
            classifyProviderFailure(status.errorMessage || "generation_failed"),
            status.errorMessage || "Provider job failed",
            { diagnostics: { providerJobId: job.providerJobId } }
          );
        }

        let output = await adapter.normalizeOutput(status);
        if (this.opts.measureOutput && output.sourceUrl) {
          const measured = await this.opts.measureOutput(output.sourceUrl, output.mediaType);
          output = enrichOutputMetadata(output, measured);
        } else {
          output = enrichOutputMetadata(output, {
            // Default optimistic sizes for sync adapters that already returned media;
            // real finalize paths supply measured metadata.
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
        execution.usage = output.usage;
        execution.metadata = {
          ...execution.metadata,
          lastFrameDataUrl: output.metadata?.lastFrameDataUrl,
        };
        this.idempotency.set(idempotencyKey(task.productionId, task.id, inputHash), execution);
        logExecutionTransition(this.logger, execution, { assetProduced: asset.id });
        return { execution, asset };
      } catch (err: any) {
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

        // Force failed without nested transition puzzles
        execution = {
          ...execution,
          status: "failed",
          error,
          completedAt: new Date().toISOString(),
        };
        lastExecution = execution;
        logExecutionTransition(this.logger, execution);

        // Auth failures: do not loop
        if (error.code === "authentication_failed" || error.code === "unsupported_capability") {
          execution = { ...execution, status: "exhausted" };
          return { execution };
        }

        if (!error.retryable || attempt >= maxAttempts) {
          if (fallbackIndex < fallbacks.length) {
            const nextProvider = fallbacks[fallbackIndex++];
            execution = { ...execution, status: "retrying" };
            logExecutionTransition(this.logger, execution, { fallbackUsed: nextProvider });
            provider = nextProvider;
            attempt++;
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
