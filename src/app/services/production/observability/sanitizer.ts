/**
 * Canonical Secret Sanitizer for Production Telemetry and Observability.
 * Permanent Rule: Sensitive credentials must NEVER reach logs or durable persistence.
 */

const SECRET_KEY_PATTERN =
  /(api[_-]?key|authorization|bearer|access[_-]?token|refresh[_-]?token|secret|password|credential|token|service[_-]?role)/i;

const SECRET_VALUE_PATTERN =
  /(bearer\s+[a-zA-Z0-9_\-\.]{8,}|sbp_[a-zA-Z0-9_]{16,}|sk-[a-zA-Z0-9_\-]{16,}|[a-zA-Z0-9_-]{24,}\.[a-zA-Z0-9_-]{24,}\.[a-zA-Z0-9_-]{24,})/i;

export const REDACTED_MARKER = "[REDACTED]";

/**
 * Deeply sanitizes any payload, redacting secret keys and values recursively.
 * Handles cycles safely.
 */
export function sanitizeEvidence<T>(input: T, seen = new WeakSet<object>()): T {
  if (input === null || input === undefined) {
    return input;
  }

  if (typeof input === "string") {
    if (SECRET_KEY_PATTERN.test(input) || SECRET_VALUE_PATTERN.test(input)) {
      // Check if it's an authorization header like "Bearer secret..."
      if (/^bearer\s+/i.test(input)) {
        return "Bearer [REDACTED]" as unknown as T;
      }
      return REDACTED_MARKER as unknown as T;
    }
    return input;
  }

  if (typeof input !== "object") {
    return input;
  }

  if (seen.has(input as object)) {
    return "[CIRCULAR]" as unknown as T;
  }
  seen.add(input as object);

  if (Array.isArray(input)) {
    return input.map((item) => sanitizeEvidence(item, seen)) as unknown as T;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (SECRET_KEY_PATTERN.test(key)) {
      if (typeof value === "string" && /^bearer\s+/i.test(value)) {
        result[key] = "Bearer [REDACTED]";
      } else {
        result[key] = REDACTED_MARKER;
      }
    } else {
      result[key] = sanitizeEvidence(value, seen);
    }
  }

  return result as T;
}
