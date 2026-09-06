/**
 * Production-level idempotent lifecycle execution.
 * Reuses Phase 10 runProductionLifecycle + checkpoints — no second orchestrator.
 */

import {
  runProductionLifecycle,
  resumeProductionLifecycle,
  type ProductionLifecycleReport,
  type ProductionLifecycleCheckpoint,
  type RunProductionLifecycleOptions,
} from "../execution";
import type { ProductionSpec } from "../specification";
import type { IdempotentRunRecord } from "./types";

export interface IdempotentLifecycleStore {
  get(operationKey: string): {
    report: ProductionLifecycleReport;
    checkpoint?: ProductionLifecycleCheckpoint;
    record: IdempotentRunRecord;
  } | undefined;
  set(
    operationKey: string,
    value: {
      report: ProductionLifecycleReport;
      checkpoint?: ProductionLifecycleCheckpoint;
      record: IdempotentRunRecord;
    }
  ): void;
}

export function createMemoryIdempotentLifecycleStore(): IdempotentLifecycleStore {
  const map = new Map<
    string,
    {
      report: ProductionLifecycleReport;
      checkpoint?: ProductionLifecycleCheckpoint;
      record: IdempotentRunRecord;
    }
  >();
  return {
    get: (k) => map.get(k),
    set: (k, v) => {
      map.set(k, v);
    },
  };
}

export function productionOperationKey(productionId: string, operation = "execute"): string {
  return `prod:${productionId}:${operation}`;
}

/**
 * Execute lifecycle idempotently for a production id.
 * Repeated calls with the same operation key reuse the completed report
 * and must not increment billableAttempts after success.
 */
export async function runIdempotentProductionLifecycle(params: {
  spec: ProductionSpec;
  options?: RunProductionLifecycleOptions;
  store: IdempotentLifecycleStore;
  operation?: string;
}): Promise<{
  report: ProductionLifecycleReport;
  record: IdempotentRunRecord;
  reused: boolean;
}> {
  const productionId = params.spec.id || params.spec.project?.id || "unknown";
  const operationKey = productionOperationKey(productionId, params.operation || "execute");
  const existing = params.store.get(operationKey);

  if (existing?.report.completed && existing.report.ok) {
    const record: IdempotentRunRecord = {
      ...existing.record,
      runCount: existing.record.runCount + 1,
      lastReportId: existing.report.productionId,
      // billableAttempts unchanged on successful reuse
    };
    params.store.set(operationKey, { ...existing, record });
    return { report: existing.report, record, reused: true };
  }

  if (existing?.checkpoint && !existing.report.completed) {
    const resumed = await resumeProductionLifecycle(existing.checkpoint, params.options);
    const billableDelta = resumed.completed && resumed.ok ? 0 : 1;
    const record: IdempotentRunRecord = {
      productionId,
      operationKey,
      runCount: (existing.record.runCount || 0) + 1,
      firstReportId: existing.record.firstReportId || resumed.productionId,
      lastReportId: resumed.productionId,
      billableAttempts: existing.record.billableAttempts + billableDelta,
    };
    params.store.set(operationKey, {
      report: resumed,
      checkpoint: resumed.checkpoint || existing.checkpoint,
      record,
    });
    return { report: resumed, record, reused: false };
  }

  const report = await runProductionLifecycle({
    spec: params.spec,
    options: params.options,
  });

  const record: IdempotentRunRecord = {
    productionId,
    operationKey,
    runCount: 1,
    firstReportId: report.productionId,
    lastReportId: report.productionId,
    billableAttempts: 1,
  };
  params.store.set(operationKey, {
    report,
    checkpoint: report.checkpoint,
    record,
  });
  return { report, record, reused: false };
}
