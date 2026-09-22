/**
 * Authoritative Reconciliation Engine for ambiguous provider submissions.
 * Resolves UNKNOWN_SUBMISSION before any retry or credit release.
 */

import type { MediaProviderAdapter } from "./adapters/types";
import type { ProviderJobStatus } from "./types";
import { ProviderSubmissionRegistry } from "./providerSubmission";

export type ReconciliationOutcome =
  | {
      status: "FOUND";
      providerJobId: string;
      jobStatus: ProviderJobStatus;
    }
  | {
      status: "CONFIRMED_NOT_SUBMITTED";
      reason: string;
    }
  | {
      status: "STILL_UNKNOWN";
      reason: string;
    };

export interface ReconciliationOptions {
  adapter: MediaProviderAdapter;
  executionId: string;
  generationTaskId: string;
  attempt: number;
  idempotencyKey: string;
  providerJobId?: string;
  providerRequestId?: string;
  lookupFn?: (idempotencyKey: string, requestId?: string) => Promise<ProviderJobStatus | null>;
}

export class ReconciliationEngine {
  /**
   * Attempts to reconcile an unknown provider submission.
   */
  static async reconcile(options: ReconciliationOptions): Promise<ReconciliationOutcome> {
    const { adapter, idempotencyKey, providerJobId, providerRequestId, lookupFn } = options;

    // 1. If we have a providerJobId, query getStatus directly
    if (providerJobId) {
      try {
        const status = await adapter.getStatus(providerJobId);
        if (status && status.status !== "failed" && status.errorMessage !== "unknown_job") {
          return { status: "FOUND", providerJobId, jobStatus: status };
        }
      } catch {
        // Fall through to lookup
      }
    }

    // 2. Query custom/injected lookup port if provided
    if (lookupFn) {
      try {
        const status = await lookupFn(idempotencyKey, providerRequestId);
        if (status?.providerJobId) {
          return {
            status: "FOUND",
            providerJobId: status.providerJobId,
            jobStatus: status,
          };
        }
        if (status === null) {
          return {
            status: "CONFIRMED_NOT_SUBMITTED",
            reason: "Provider confirmed no job exists for this idempotency key / request ID",
          };
        }
      } catch (lookupErr: any) {
        return {
          status: "STILL_UNKNOWN",
          reason: `Reconciliation lookup failed: ${lookupErr?.message || lookupErr}`,
        };
      }
    }

    // 3. Adapter-level native reconciliation if supported
    if ((adapter as any).reconcileJob) {
      try {
        const status = await (adapter as any).reconcileJob(providerRequestId, idempotencyKey);
        if (status?.providerJobId) {
          return {
            status: "FOUND",
            providerJobId: status.providerJobId,
            jobStatus: status,
          };
        }
        if (status === null) {
          return {
            status: "CONFIRMED_NOT_SUBMITTED",
            reason: "Adapter confirmed request was never received",
          };
        }
      } catch (err: any) {
        return {
          status: "STILL_UNKNOWN",
          reason: `Adapter reconciliation call threw: ${err?.message || err}`,
        };
      }
    }

    // 4. Default safe fallback: cannot determine provider state
    return {
      status: "STILL_UNKNOWN",
      reason: "Provider does not support reconciliation lookup; state remains protected",
    };
  }
}
