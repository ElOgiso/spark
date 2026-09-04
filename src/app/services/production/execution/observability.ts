/**
 * Structured execution observability — never log secrets.
 */

import type { GenerationExecution, ExecutionStatus } from "./types";
import { userFacingExecutionMessage } from "./errors";

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
    const safe = { ...event } as ExecutionLogEvent;
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
  logger({
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
  });
}
