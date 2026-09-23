/**
 * Authoritative Provider Submission Layer.
 * Normalizes adapter submission outcomes into SUBMITTED, NOT_SUBMITTED, or UNKNOWN_SUBMISSION.
 * Enforces submission idempotency and attempt audit tracking.
 */

import type {
  ExecutionRecord,
  ExecutionError,
  ProviderGenerationRequest,
  ProviderSubmissionResult,
} from "./types";
import type { MediaProviderAdapter } from "./adapters/types";
import { makeExecutionError, classifyProviderFailure } from "./errors";

export interface ProviderSubmissionOptions {
  attempt?: number;
  inputHash?: string;
  timeoutMs?: number;
}

export class ProviderSubmissionRegistry {
  private static records = new Map<string, ExecutionRecord>(); // key: idempotencyKey -> ExecutionRecord

  static recordAttempt(record: ExecutionRecord): void {
    this.records.set(record.idempotencyKey, record);
    // Also index by executionId:attempt
    this.records.set(`${record.executionId}__${record.submissionAttempt}`, record);
  }

  static getByAttempt(executionId: string, attempt: number): ExecutionRecord | undefined {
    return this.records.get(`${executionId}__${attempt}`);
  }

  static getByIdempotencyKey(key: string): ExecutionRecord | undefined {
    return this.records.get(key);
  }

  static clear(): void {
    this.records.clear();
  }
}

/**
 * Builds deterministic idempotency key for provider submission attempt.
 */
export function buildSubmissionIdempotencyKey(
  productionId: string,
  taskId: string,
  attempt: number,
  inputHash?: string
): string {
  return `sub_${productionId}_${taskId}_att${attempt}_${inputHash || "default"}`;
}

/**
 * Executes adapter submission with strict outcome classification.
 */
export async function submitWithReliability(
  adapter: MediaProviderAdapter,
  request: ProviderGenerationRequest,
  options: ProviderSubmissionOptions = {}
): Promise<ProviderSubmissionResult> {
  const attempt = options.attempt || 1;
  const idempotencyKey = buildSubmissionIdempotencyKey(
    request.productionId,
    request.taskId,
    attempt,
    options.inputHash
  );

  // Check if this attempt already succeeded with a provider job ID
  const existing = ProviderSubmissionRegistry.getByIdempotencyKey(idempotencyKey);
  if (existing && existing.providerJobId && existing.status === "submitted") {
    return {
      outcome: "SUBMITTED",
      providerJobId: existing.providerJobId,
      providerRequestId: existing.providerRequestId,
      submittedAt: existing.submittedAt || new Date().toISOString(),
      metadata: { idempotentReplay: true, ...existing.metadata },
    };
  }
  if (existing && (existing.status === "submitting" || existing.status === "unknown_submission" || existing.status === "reconciling")) {
    return {
      outcome: "UNKNOWN_SUBMISSION",
      reconciliationRequired: true,
      error: makeExecutionError("unknown_submission", "Existing submission must be reconciled before resubmission", {
        retryable: false,
        retryability: "RECONCILE_FIRST",
      }),
    };
  }

  const record: ExecutionRecord = {
    executionId: request.executionId,
    generationTaskId: request.taskId,
    providerId: request.providerId,
    modelId: request.model,
    submissionAttempt: attempt,
    idempotencyKey,
    status: "submitting",
    startedAt: new Date().toISOString(),
    metadata: { ...request.metadata },
  };

  ProviderSubmissionRegistry.recordAttempt(record);

  try {
    const job = await adapter.submit(request);

    if (!job?.providerJobId) {
      const err = makeExecutionError("generation_failed", "Provider returned empty job ID", {
        retryable: false,
        diagnostics: { providerId: request.providerId },
      });
      record.status = "failed";
      record.completedAt = new Date().toISOString();
      record.errorMessage = err.message;
      return { outcome: "NOT_SUBMITTED", error: err };
    }

    record.status = "submitted";
    record.providerJobId = job.providerJobId;
    record.submittedAt = new Date().toISOString();
    record.metadata = { ...record.metadata, ...job.raw };
    ProviderSubmissionRegistry.recordAttempt(record);

    return {
      outcome: "SUBMITTED",
      providerJobId: job.providerJobId,
      providerRequestId: (job.raw?.requestId as string) || (job.raw?.providerRequestId as string),
      submittedAt: record.submittedAt,
      metadata: job.raw,
    };
  } catch (rawErr: any) {
    record.completedAt = new Date().toISOString();
    const errMsg = String(rawErr?.message || rawErr || "Submission failed");
    const isExplicitError = Boolean(rawErr?.code);
    const code = isExplicitError ? rawErr.code : classifyProviderFailure(errMsg);

    const isExplicitlyRetryable = rawErr?.retryable === true;

    // Identify UNKNOWN_SUBMISSION:
    // When the network timeout or connection reset occurs during/after request dispatch
    // and was not explicitly marked as safe-to-retry by the adapter.
    const isAmbiguousTimeout =
      !isExplicitlyRetryable &&
      (code === "unknown_submission" ||
        /econnreset|socket hang up|deadline exceeded|504 gateway/i.test(errMsg) ||
        (!isExplicitError && /timeout/i.test(errMsg)));

    const isPreTransmissionFailure =
      code === "invalid_request" ||
      code === "unsupported_capability" ||
      code === "authentication_failed" ||
      /missing required|validation failed|first_frame/i.test(errMsg);

    if (isAmbiguousTimeout && !isPreTransmissionFailure) {
      const err: ExecutionError = makeExecutionError("unknown_submission", errMsg, {
        category: "UNKNOWN_SUBMISSION",
        retryable: false,
        retryability: "RECONCILE_FIRST",
        diagnostics: {
          providerId: request.providerId,
          stage: "network_transmission",
          idempotencyKey,
        },
        raw: rawErr,
      });

      record.status = "unknown_submission";
      record.errorCode = err.code;
      record.errorMessage = err.message;
      ProviderSubmissionRegistry.recordAttempt(record);

      return {
        outcome: "UNKNOWN_SUBMISSION",
        error: err,
        reconciliationRequired: true,
      };
    }

    // Confirmed NOT_SUBMITTED
    const err: ExecutionError = makeExecutionError(code, errMsg, {
      retryable: rawErr?.retryable,
      reasons: rawErr?.reasons,
      diagnostics: { providerId: request.providerId, idempotencyKey },
      raw: rawErr,
    });

    record.status = "failed";
    record.errorCode = err.code;
    record.errorMessage = err.message;
    ProviderSubmissionRegistry.recordAttempt(record);

    return {
      outcome: "NOT_SUBMITTED",
      error: err,
    };
  }
}
