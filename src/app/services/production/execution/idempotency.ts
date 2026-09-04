/**
 * Idempotency for generation executions — prevent duplicate expensive submissions.
 */

import type { GenerationTask } from "../specification/generationTask";
import type { GenerationExecution } from "./types";

export function hashExecutionInput(parts: Array<string | number | undefined | null>): string {
  const raw = parts.map((p) => String(p ?? "")).join("|");
  // FNV-1a 32-bit — deterministic, no crypto dependency
  let h = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `fnv_${(h >>> 0).toString(16)}`;
}

export function buildTaskInputHash(task: GenerationTask, prompt?: string, inputUrls?: string[]): string {
  return hashExecutionInput([
    task.id,
    task.kind,
    task.selectedProvider,
    task.selectedModel,
    task.strategy?.modality,
    prompt,
    ...(inputUrls || []),
  ]);
}

export interface IdempotencyStore {
  get(key: string): GenerationExecution | undefined;
  set(key: string, execution: GenerationExecution): void;
  clear?(): void;
}

export function createMemoryIdempotencyStore(): IdempotencyStore {
  const map = new Map<string, GenerationExecution>();
  return {
    get: (k) => map.get(k),
    set: (k, v) => {
      map.set(k, v);
    },
    clear: () => map.clear(),
  };
}

export function idempotencyKey(productionId: string, taskId: string, inputHash: string): string {
  return `${productionId}::${taskId}::${inputHash}`;
}

/**
 * If a succeeded execution already exists for the same input hash, reuse it.
 */
export function findReusableExecution(
  store: IdempotencyStore,
  productionId: string,
  taskId: string,
  inputHash: string
): GenerationExecution | undefined {
  const existing = store.get(idempotencyKey(productionId, taskId, inputHash));
  if (existing?.status === "succeeded" && existing.outputAssets.length > 0) {
    return existing;
  }
  // Also block duplicate in-flight submissions
  if (existing && (existing.status === "running" || existing.status === "polling" || existing.status === "queued")) {
    return existing;
  }
  return undefined;
}
