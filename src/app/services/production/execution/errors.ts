/**
 * Normalized execution errors — sanitize before frontend.
 */

import type {
  ExecutionError,
  ExecutionErrorCode,
  ProviderExecutionCategory,
  RetryClassification,
} from "./types";

const SECRET_PATTERN = /(api[_-]?key|authorization|bearer|token|secret|password|credential)/i;

export function sanitizeDiagnostics(raw: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (SECRET_PATTERN.test(k)) continue;
    if (typeof v === "string" && SECRET_PATTERN.test(v)) continue;
    if (typeof v === "string" && v.length > 500) out[k] = `${v.slice(0, 500)}…`;
    else out[k] = v;
  }
  return out;
}

export function isRetryableCode(code: ExecutionErrorCode): boolean {
  switch (code) {
    case "rate_limited":
    case "timeout":
    case "provider_unavailable":
    case "generation_failed":
    case "output_unavailable":
    case "output_mismatch":
      return true;
    case "authentication_failed":
    case "unsupported_capability":
    case "invalid_request":
    case "cancelled":
    case "dependency_failed":
      return false;
    default:
      return true;
  }
}

export function classifyCategory(code: ExecutionErrorCode): ProviderExecutionCategory {
  switch (code) {
    case "invalid_request":
    case "output_invalid":
    case "output_mismatch":
      return "VALIDATION";
    case "authentication_failed":
      return "AUTH";
    case "rate_limited":
      return "RATE_LIMIT";
    case "unsupported_capability":
      return "CAPABILITY";
    case "provider_unavailable":
      return "PROVIDER";
    case "timeout":
      return "TIMEOUT";
    case "unknown_submission":
      return "UNKNOWN_SUBMISSION";
    case "generation_failed":
    case "output_unavailable":
      return "PROVIDER";
    default:
      return "UNKNOWN";
  }
}

export function classifyRetryability(err: ExecutionError): RetryClassification {
  if (err.category === "UNKNOWN_SUBMISSION" || err.code === "unknown_submission") {
    return "RECONCILE_FIRST";
  }
  if (
    err.code === "timeout" &&
    err.providerDiagnostics?.stage === "network_transmission"
  ) {
    return "RECONCILE_FIRST";
  }

  switch (err.code) {
    case "authentication_failed":
    case "unsupported_capability":
    case "invalid_request":
    case "cancelled":
    case "dependency_failed":
    case "reconciliation_failed":
    case "insufficient_credits":
      return "DO_NOT_RETRY";
    case "rate_limited":
    case "provider_unavailable":
    case "generation_failed":
    case "output_unavailable":
    case "output_mismatch":
    case "storage_failed":
      return "SAFE_TO_RETRY";
    case "timeout":
      return err.providerDiagnostics?.submitted === true ? "RECONCILE_FIRST" : "SAFE_TO_RETRY";
    default:
      return err.retryable ? "SAFE_TO_RETRY" : "DO_NOT_RETRY";
  }
}

export function makeExecutionError(
  code: ExecutionErrorCode,
  message: string,
  opts?: {
    retryable?: boolean;
    category?: ProviderExecutionCategory;
    retryability?: RetryClassification;
    reasons?: string[];
    diagnostics?: Record<string, unknown>;
    providerCode?: string;
    raw?: unknown;
  }
): ExecutionError {
  const category = opts?.category ?? classifyCategory(code);
  const baseError: ExecutionError = {
    code,
    category,
    message: message.replace(SECRET_PATTERN, "[redacted]"),
    retryable: opts?.retryable ?? isRetryableCode(code),
    reasons: opts?.reasons,
    providerCode: opts?.providerCode,
    providerDiagnostics: sanitizeDiagnostics(opts?.diagnostics),
    raw: opts?.raw,
  };
  baseError.retryability = opts?.retryability ?? classifyRetryability(baseError);
  return baseError;
}

export function classifyProviderFailure(raw: string): ExecutionErrorCode {
  const t = (raw || "").toLowerCase();
  if (/unknown_submission|ambiguous|connection reset after send|transmission lost/.test(t)) return "unknown_submission";
  if (/unauthor|forbidden|api.?key|credential|auth/.test(t)) return "authentication_failed";
  if (/rate.?limit|429|quota|too many/.test(t)) return "rate_limited";
  if (/timeout|timed.?out|deadline/.test(t)) return "timeout";
  if (/unavailable|offline|503|502/.test(t)) return "provider_unavailable";
  if (/unsupported|not supported|capability/.test(t)) return "unsupported_capability";
  if (/invalid|bad request|400|422/.test(t)) return "invalid_request";
  if (/cancel/.test(t)) return "cancelled";
  if (/storage|upload|persist/.test(t)) return "storage_failed";
  if (/output|empty|no video|no image|missing url/.test(t)) return "output_unavailable";
  return "generation_failed";
}

/** User-facing copy — never expose provider internals */
export function userFacingExecutionMessage(status: string, code?: ExecutionErrorCode): string {
  if (status === "running" || status === "polling" || status === "queued") {
    return "SPARK is generating";
  }
  if (status === "retrying") return "SPARK is retrying this";
  if (code === "output_invalid" || code === "output_mismatch") return "SPARK is checking this";
  if (status === "failed" || status === "exhausted") return "SPARK could not finish this step";
  if (status === "succeeded") return "SPARK finished this step";
  if (status === "cancelled") return "SPARK stopped this step";
  return "SPARK is processing";
}
