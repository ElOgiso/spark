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

export function redactSecrets(str: string): string {
  if (!str) return str;
  return str
    .replace(/bearer\s+[^\s,;]+/gi, "Bearer [redacted]")
    .replace(/(api[_-]?key[:= ]+)[^\s,;]+/gi, "$1[redacted]")
    .replace(/sk-[a-zA-Z0-9_-]+/gi, "[redacted]")
    .replace(/(token|secret|password|credential)[:= ]+[^\s,;]+/gi, "$1 [redacted]")
    .replace(/secret-[a-zA-Z0-9_-]+/gi, "[redacted]");
}

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
    case "unknown_submission":
    case "authentication_failed":
    case "unsupported_capability":
    case "invalid_request":
    case "cancelled":
    case "dependency_failed":
    case "insufficient_credits":
    case "reconciliation_failed":
      return false;
    default:
      return false;
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
  if (/unknown_submission|ambiguous|connection reset|transmission lost|econnreset|socket hang up/.test(t)) return "unknown_submission";
  if (/unauthor|forbidden|api.?key|credential|auth/.test(t)) return "authentication_failed";
  if (/rate.?limit|429|quota|too many/.test(t)) return "rate_limited";
  if (/timeout|timed.?out|deadline/.test(t)) return "timeout";
  if (/unavailable|offline|503|502/.test(t)) return "provider_unavailable";
  if (/unsupported|not supported|capability/.test(t)) return "unsupported_capability";
  if (/invalid|bad request|400|422|validation|missing required/.test(t)) return "invalid_request";
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

/**
 * Phase 11 Canonical Provider Error Normalization.
 * Transforms raw provider errors/exceptions into sanitized, categorized ProviderError objects.
 * Guarantees zero credential leakage.
 */
export function normalizeProviderError(
  rawError: unknown,
  providerId: string,
  extraDiagnostics?: Record<string, unknown>
): import("./adapters/types").ProviderError {
  const errObj = (typeof rawError === "object" && rawError !== null ? rawError : {}) as any;
  const rawMessage = String(errObj.message || errObj.error?.message || errObj.errorMessage || rawError || "Unknown error");
  const httpStatus = Number(errObj.status || errObj.statusCode || errObj.response?.status || 0) || undefined;
  const providerCode = String(errObj.code || errObj.error?.code || errObj.providerCode || "");

  let code: ExecutionErrorCode = "generation_failed";
  let category: ProviderExecutionCategory = "PROVIDER";
  let retryable = false;
  let retryability: RetryClassification = "DO_NOT_RETRY";

  const lower = (rawMessage + " " + providerCode).toLowerCase();

  // 1. Content moderation / safety policy
  if (/content.?policy|safety.?filter|moderation|nsfw|sensitive content|prohibited|rejected by safety/i.test(lower)) {
    code = "invalid_request";
    category = "VALIDATION";
    retryable = false;
    retryability = "DO_NOT_RETRY";
  }
  // 2. Auth / permissions
  else if (httpStatus === 401 || httpStatus === 403 || /unauthorized|forbidden|api.?key|invalid key|authentication|credentials/i.test(lower)) {
    code = "authentication_failed";
    category = "AUTH";
    retryable = false;
    retryability = "DO_NOT_RETRY";
  }
  // 3. Rate limiting / 429
  else if (httpStatus === 429 || /rate.?limit|quota|too many requests|throttled/i.test(lower)) {
    code = "rate_limited";
    category = "RATE_LIMIT";
    retryable = true;
    retryability = "SAFE_TO_RETRY";
  }
  // 4. Invalid request / validation (400, 422)
  else if (httpStatus === 400 || httpStatus === 422 || /invalid.?request|bad request|parameter|validation failed|unsupported format|missing required/i.test(lower)) {
    code = "invalid_request";
    category = "VALIDATION";
    retryable = false;
    retryability = "DO_NOT_RETRY";
  }
  // 5. Capability mismatch
  else if (/unsupported.?capability|model does not support|capability mismatch/i.test(lower)) {
    code = "unsupported_capability";
    category = "CAPABILITY";
    retryable = false;
    retryability = "DO_NOT_RETRY";
  }
  // 6. Ambiguous transmission / Network timeout
  else if (
    httpStatus === 504 ||
    /econnreset|socket hang up|deadline exceeded|unknown_submission|ambiguous|connection reset/i.test(lower)
  ) {
    code = "unknown_submission";
    category = "UNKNOWN_SUBMISSION";
    retryable = false;
    retryability = "RECONCILE_FIRST";
  }
  // 7. Timeout (polling or request timeout)
  else if (httpStatus === 408 || /timed.?out|timeout/i.test(lower)) {
    code = "timeout";
    category = "TIMEOUT";
    retryable = true;
    retryability = "SAFE_TO_RETRY";
  }
  // 8. Provider unavailable / 502 / 503
  else if (httpStatus === 502 || httpStatus === 503 || /unavailable|service unavailable|bad gateway|backend error/i.test(lower)) {
    code = "provider_unavailable";
    category = "PROVIDER";
    retryable = true;
    retryability = "SAFE_TO_RETRY";
  }
  // 9. Generic 5xx server error
  else if (httpStatus && httpStatus >= 500) {
    code = "generation_failed";
    category = "PROVIDER";
    retryable = true;
    retryability = "SAFE_TO_RETRY";
  } else {
    code = classifyProviderFailure(rawMessage);
    category = classifyCategory(code);
    retryable = isRetryableCode(code);
    retryability = classifyRetryability({ code, message: rawMessage, retryable, category });
  }

  const cleanMessage = redactSecrets(rawMessage);
  const diagnostics: Record<string, unknown> = {
    provider: providerId,
    ...(httpStatus ? { httpStatus } : {}),
    ...(providerCode ? { providerCode } : {}),
    ...extraDiagnostics,
  };

  return {
    code,
    message: cleanMessage,
    retryable,
    category,
    retryability,
    provider: providerId,
    providerErrorCode: providerCode || undefined,
    rawStatus: httpStatus ? String(httpStatus) : undefined,
    providerDiagnostics: sanitizeDiagnostics(diagnostics),
    raw: errObj,
  };
}
