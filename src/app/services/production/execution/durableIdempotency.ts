/**
 * Durable execution checkpoints on the existing idempotency store.
 * Memory is the hot copy. Flush is awaited before provider submit.
 * Hydration folds the latest checkpoint per key from the journal,
 * browser storage, and production_events. No second job system.
 */

import type { GenerationExecution } from "./types";
import type { IdempotencyStore } from "./idempotency";
import { getProductionObserver } from "../observability/observer";
import { getProductionObservabilityRepository } from "../observability/repository";

const STORAGE_KEY = "spark_execution_checkpoints_v1";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface ExecutionCheckpointRecord {
  key: string;
  execution: GenerationExecution;
}

export interface ExecutionCheckpointJournal {
  append(record: ExecutionCheckpointRecord): Promise<void>;
  load(productionId?: string): Promise<ExecutionCheckpointRecord[]>;
}

export function createMemoryCheckpointJournal(): ExecutionCheckpointJournal & {
  records: ExecutionCheckpointRecord[];
} {
  const records: ExecutionCheckpointRecord[] = [];
  return {
    records,
    async append(record) {
      records.push({
        key: record.key,
        execution: JSON.parse(JSON.stringify(record.execution)),
      });
    },
    async load(productionId?: string) {
      return records
        .filter((r) => !productionId || r.execution.productionId === productionId)
        .map((r) => ({
          key: r.key,
          execution: JSON.parse(JSON.stringify(r.execution)),
        }));
    },
  };
}

function checkpointTime(execution: GenerationExecution): number {
  const stamp = execution.metadata?.checkpointAt || execution.completedAt || execution.startedAt;
  const parsed = typeof stamp === "string" ? Date.parse(stamp) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function foldLatest(records: ExecutionCheckpointRecord[]): Map<string, GenerationExecution> {
  const map = new Map<string, GenerationExecution>();
  for (const record of records) {
    if (!record?.key || !record.execution) continue;
    const prev = map.get(record.key);
    if (!prev || checkpointTime(record.execution) >= checkpointTime(prev)) {
      map.set(record.key, record.execution);
    }
  }
  return map;
}

function readStorage(
  storage: Pick<Storage, "getItem" | "setItem"> | null | undefined,
  productionId?: string
): ExecutionCheckpointRecord[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ExecutionCheckpointRecord[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((r) => !productionId || r.execution?.productionId === productionId);
  } catch {
    return [];
  }
}

function writeStorage(
  storage: Pick<Storage, "getItem" | "setItem"> | null | undefined,
  records: ExecutionCheckpointRecord[]
): void {
  if (!storage) return;
  storage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function createDurableIdempotencyStore(opts?: {
  journal?: ExecutionCheckpointJournal;
  storage?: Pick<Storage, "getItem" | "setItem"> | null;
  persistRemote?: boolean;
  userId?: string;
  brandId?: string;
}): IdempotencyStore {
  const map = new Map<string, GenerationExecution>();
  const hydrated = new Set<string>();
  const persistRemote = opts?.persistRemote !== false;
  const storage =
    opts?.storage !== undefined
      ? opts.storage
      : typeof localStorage !== "undefined"
        ? localStorage
        : null;

  const persistRemoteCheckpoint = async (key: string, execution: GenerationExecution) => {
    if (!persistRemote) return;
    const reservationId =
      typeof execution.metadata?.reservationId === "string" ? execution.metadata.reservationId : undefined;
    await getProductionObserver().recordExecution(
      execution.productionId,
      execution.taskId,
      execution.id,
      "execution_checkpoint",
      {
        idempotencyKey: key,
        execution,
        reservationId,
        providerJobId: execution.providerJobId,
        submissionState: execution.status,
      },
      true,
      {
        userId: opts?.userId,
        brandId: opts?.brandId || undefined,
        providerId: execution.provider,
        modelId: execution.model,
        attempt: execution.attempt,
        providerJobId: execution.providerJobId,
        reservationId: reservationId && UUID_RE.test(reservationId) ? reservationId : undefined,
        sceneId: execution.sceneId,
        shotId: execution.shotId,
      }
    );
  };

  return {
    get: (key) => map.get(key),
    set: (key, execution) => {
      map.set(key, execution);
    },
    clear: () => {
      map.clear();
      hydrated.clear();
    },
    async flush(key?: string) {
      const keys = key ? [key] : [...map.keys()];
      const snapshot: ExecutionCheckpointRecord[] = [...map.entries()].map(([k, execution]) => ({
        key: k,
        execution,
      }));
      writeStorage(storage, snapshot);
      for (const k of keys) {
        const execution = map.get(k);
        if (!execution) continue;
        if (opts?.journal) await opts.journal.append({ key: k, execution });
        await persistRemoteCheckpoint(k, execution);
      }
    },
    async hydrate(productionId: string) {
      if (!productionId || hydrated.has(productionId)) return;
      const records: ExecutionCheckpointRecord[] = [
        ...(opts?.journal ? await opts.journal.load(productionId) : []),
        ...readStorage(storage, productionId),
      ];
      if (persistRemote) {
        const events = await getProductionObservabilityRepository().byProduction(productionId);
        for (const event of events) {
          if (event.eventType !== "execution_checkpoint") continue;
          const execution = event.evidence?.execution as GenerationExecution | undefined;
          const key = typeof event.evidence?.idempotencyKey === "string" ? event.evidence.idempotencyKey : "";
          if (execution && key) records.push({ key, execution });
        }
      }
      for (const [key, execution] of foldLatest(records)) {
        const current = map.get(key);
        if (!current || checkpointTime(execution) >= checkpointTime(current)) {
          map.set(key, execution);
        }
      }
      hydrated.add(productionId);
    },
  };
}
