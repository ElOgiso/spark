/**
 * Normalize production errors into a stable taxonomy.
 * Extends existing execution classifiers — does not replace them.
 */

import { classifyProviderFailure, isRetryableCode } from "../execution/errors";
import type { NormalizedProductionError, ProductionErrorCategory } from "./types";

const CATEGORY_BY_CODE: Record<string, ProductionErrorCategory> = {
  invalid_request: "VALIDATION_ERROR",
  validation_error: "VALIDATION_ERROR",
  contract_error: "CONTRACT_ERROR",
  reference_error: "REFERENCE_ERROR",
  continuity_error: "CONTINUITY_ERROR",
  continuity_break: "CONTINUITY_ERROR",
  unsupported_capability: "CAPABILITY_ERROR",
  capability_error: "CAPABILITY_ERROR",
  routing_error: "ROUTING_ERROR",
  provider_unavailable: "PROVIDER_ERROR",
  generation_failed: "PROVIDER_ERROR",
  provider_error: "PROVIDER_ERROR",
  authentication_failed: "AUTH_ERROR",
  auth_error: "AUTH_ERROR",
  rate_limited: "RATE_LIMIT_ERROR",
  timeout: "TIMEOUT_ERROR",
  media_error: "MEDIA_ERROR",
  output_unavailable: "MEDIA_ERROR",
  output_mismatch: "MEDIA_ERROR",
  storage_failed: "PERSISTENCE_ERROR",
  qc_error: "QC_ERROR",
  quality_degradation: "QC_ERROR",
  repair_error: "REPAIR_ERROR",
  repair_exhausted: "REPAIR_ERROR",
  dag_error: "DAG_ERROR",
  dependency_failed: "DAG_ERROR",
  persistence_error: "PERSISTENCE_ERROR",
  editorial_error: "EDITORIAL_ERROR",
  mastering_error: "MASTERING_ERROR",
  delivery_error: "DELIVERY_ERROR",
  budget_error: "BUDGET_ERROR",
  budget_exceeded: "BUDGET_ERROR",
  policy_error: "POLICY_ERROR",
  learning_error: "LEARNING_ERROR",
  system_error: "SYSTEM_ERROR",
  cancelled: "SYSTEM_ERROR",
};

function recoverabilityFor(
  category: ProductionErrorCategory,
  code: string
): NormalizedProductionError["recoverability"] {
  if (category === "AUTH_ERROR" || category === "POLICY_ERROR" || category === "BUDGET_ERROR") {
    return "escalate";
  }
  if (category === "CAPABILITY_ERROR") return "fallback";
  if (category === "CONTRACT_ERROR" || category === "VALIDATION_ERROR") return "fatal";
  if (isRetryableCode(code as any)) return "retryable";
  if (category === "RATE_LIMIT_ERROR" || category === "TIMEOUT_ERROR" || category === "PROVIDER_ERROR") {
    return "retryable";
  }
  if (category === "QC_ERROR" || category === "REPAIR_ERROR") return "fallback";
  return "escalate";
}

export function normalizeProductionError(input: {
  code?: string;
  message?: string;
  stage?: string;
  entityId?: string;
  taskId?: string;
  cause?: string;
  category?: ProductionErrorCategory;
}): NormalizedProductionError {
  const raw = `${input.code || ""} ${input.message || ""}`.trim() || "system_error";
  const classified = classifyProviderFailure(raw);
  const code = (input.code || classified || "system_error").toLowerCase();
  const category = input.category || CATEGORY_BY_CODE[code] || CATEGORY_BY_CODE[classified] || "SYSTEM_ERROR";
  const recoverability = recoverabilityFor(category, code);
  const severity: NormalizedProductionError["severity"] =
    recoverability === "fatal" || category === "AUTH_ERROR" || category === "BUDGET_ERROR"
      ? "critical"
      : category === "QC_ERROR" || category === "CONTINUITY_ERROR"
        ? "high"
        : "medium";

  return {
    category,
    code,
    message: input.message || code,
    recoverability,
    severity,
    stage: input.stage,
    entityId: input.entityId,
    taskId: input.taskId,
    cause: input.cause,
    recommendedAction:
      recoverability === "retryable"
        ? "Retry with backoff"
        : recoverability === "fallback"
          ? "Use fallback provider or localized repair"
          : recoverability === "escalate"
            ? "Escalate for human review"
            : "Halt and fix contract/input",
  };
}

/** Missing metrics must stay UNKNOWN — never coerced to 0. */
export function unknownMetric(): undefined {
  return undefined;
}
