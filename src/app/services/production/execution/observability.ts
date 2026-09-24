import type { GenerationExecution, ExecutionStatus } from "./types";
import { userFacingExecutionMessage } from "./errors";
import { sanitizeEvidence } from "../observability/sanitizer";
import { getProductionObserver } from "../observability/observer";
import type { ProductionEventType } from "../observability/types";

const SECRET = /(api[_-]?key|authorization|bearer|token|secret|password|credential)/i;

export interface ExecutionLogEvent {
  at: string;
  executionId: string;
  taskId: string;
  productionId: string;
  provider: string;
  model?: string;
  attempt: number;
  state: ExecutionStatus;
  durationMs?: number;
  failureCategory?: string;
  fallbackUsed?: string;
  assetProduced?: string;
  userMessage: string;
}

export type ExecutionLogger = (event: ExecutionLogEvent) => void;

export function createMemoryLogger(): ExecutionLogger & { events: ExecutionLogEvent[] } {
  const events: ExecutionLogEvent[] = [];
  const logger = ((event: ExecutionLogEvent) => {
    let safe = sanitizeEvidence({ ...event }) as ExecutionLogEvent;
    // belt-and-suspenders
    if (SECRET.test(JSON.stringify(safe))) {
      safe.userMessage = "SPARK is processing";
    }
    events.push(safe);
  }) as ExecutionLogger & { events: ExecutionLogEvent[] };
  logger.events = events;
  return logger;
}

export function logExecutionTransition(
  logger: ExecutionLogger,
  execution: GenerationExecution,
  extras?: Partial<ExecutionLogEvent>
): void {
  const started = execution.startedAt ? Date.parse(execution.startedAt) : undefined;
  const completed = execution.completedAt ? Date.parse(execution.completedAt) : undefined;
  const event: ExecutionLogEvent = {
    at: new Date().toISOString(),
    executionId: execution.id,
    taskId: execution.taskId,
    productionId: execution.productionId,
    provider: execution.provider,
    model: execution.model,
    attempt: execution.attempt,
    state: execution.status,
    durationMs:
      started != null && completed != null && Number.isFinite(completed - started)
        ? completed - started
        : undefined,
    failureCategory: execution.error?.code,
    assetProduced: execution.outputAssets[0]?.productionAssetId,
    userMessage: userFacingExecutionMessage(execution.status, execution.error?.code),
    ...extras,
  };
  logger(event);

  // Wire into canonical ProductionObserver
  try {
    const observer = getProductionObserver();
    let eventType: ProductionEventType = "execution_running";
    if (
      execution.error?.code === "unknown_submission" ||
      execution.error?.category === "UNKNOWN_SUBMISSION" ||
      (execution.error?.code as string) === "UNKNOWN_SUBMISSION"
    ) {
      eventType = "execution_unknown_submission";
    } else {
      switch (execution.status) {
        case "queued":
          eventType = "execution_queued";
          break;
        case "submitting":
          eventType = "execution_submitting";
          break;
        case "submitted":
          eventType = "execution_submitted";
          break;
        case "running":
          eventType = "execution_running";
          break;
        case "succeeded":
          eventType = "execution_succeeded";
          break;
        case "failed":
          eventType = "execution_failed";
          break;
        case "cancelled":
          eventType = "execution_cancelled";
          break;
      }
    }

    const isCritical =
      eventType === "execution_unknown_submission" ||
      eventType === "execution_submitted";

    void observer.recordExecution(
      execution.productionId,
      execution.taskId,
      execution.id,
      eventType,
      {
        provider: execution.provider,
        model: execution.model,
        attempt: execution.attempt,
        status: execution.status,
        failureCategory: execution.error?.code,
        assetProducedId: execution.outputAssets[0]?.productionAssetId,
        durationMs: event.durationMs,
        ...extras,
      },
      isCritical,
      {
        providerId: execution.provider,
        modelId: execution.model,
        attempt: execution.attempt,
        assetId: execution.outputAssets[0]?.productionAssetId,
        occurredAt: event.at,
      }
    );
  } catch {
    // Observer recording failure shouldn't crash caller unless critical
  }
}
