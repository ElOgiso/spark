/**
 * Controlled exponential backoff with jitter and optional Retry-After.
 */

export interface BackoffPolicy {
  baseDelayMs: number;
  maxDelayMs: number;
  jitterRatio: number;
  maxAttempts: number;
}

export const DEFAULT_BACKOFF_POLICY: BackoffPolicy = {
  baseDelayMs: 1000,
  maxDelayMs: 60_000,
  jitterRatio: 0.2,
  maxAttempts: 3,
};

export function computeBackoffDelayMs(
  attempt: number,
  policy: BackoffPolicy = DEFAULT_BACKOFF_POLICY,
  retryAfterMs?: number
): number {
  if (typeof retryAfterMs === "number" && retryAfterMs > 0) {
    return Math.min(policy.maxDelayMs, retryAfterMs);
  }
  const exp = Math.min(policy.maxDelayMs, policy.baseDelayMs * Math.pow(2, Math.max(0, attempt - 1)));
  const jitter = exp * policy.jitterRatio * (Math.random() * 2 - 1);
  return Math.max(0, Math.round(exp + jitter));
}

export async function sleepMs(ms: number): Promise<void> {
  if (ms <= 0) return;
  await new Promise((r) => setTimeout(r, ms));
}
