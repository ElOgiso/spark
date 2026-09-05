/**
 * Classify generation planning/execution failures into actionable resolutions.
 */

import type {
  GenerationFailureClass,
  GenerationFailurePlan,
  GenerationFailureResolution,
} from "./generationIntent";

export function classifyGenerationFailure(params: {
  errorCode?: string;
  message?: string;
  httpStatus?: number;
}): GenerationFailurePlan {
  const blob = `${params.errorCode || ""} ${params.message || ""}`.toLowerCase();

  const hit = (
    classification: GenerationFailureClass,
    resolution: GenerationFailureResolution,
    retryable: boolean,
    message: string
  ): GenerationFailurePlan => ({
    classification,
    resolution,
    retryable,
    message,
    metadata: {
      errorCode: params.errorCode || "",
      httpStatus: params.httpStatus != null ? String(params.httpStatus) : "",
    },
  });

  if (/reference_conflict|conflicting.?reference/.test(blob)) {
    return hit(
      "reference_conflict",
      "repair_intent",
      false,
      "Reference conflict must be resolved before generation"
    );
  }
  if (/missing.?reference|reference.?required|no.?reference/.test(blob)) {
    return hit(
      "missing_reference",
      "request_missing_prerequisite",
      false,
      "Required reference asset is missing"
    );
  }
  if (/unsupported.?capability|capability.?not.?supported|missing.?capability/.test(blob)) {
    return hit(
      "unsupported_capability",
      "fallback_provider",
      true,
      "Provider lacks a required capability — try fallback or repair intent"
    );
  }
  if (/invalid.?duration|duration.?out.?of.?range/.test(blob)) {
    return hit("invalid_duration", "repair_intent", false, "Duration is invalid for selected provider");
  }
  if (/aspect.?ratio|invalid.?aspect/.test(blob)) {
    return hit(
      "invalid_aspect_ratio",
      "repair_intent",
      false,
      "Aspect ratio is invalid for selected provider"
    );
  }
  if (/rate.?limit|429/.test(blob) || params.httpStatus === 429) {
    return hit("provider_rate_limit", "retry", true, "Provider rate-limited — retry with backoff");
  }
  if (/timeout|timed.?out|etimedout/.test(blob)) {
    return hit("provider_timeout", "retry", true, "Provider timed out — retry or fallback");
  }
  if (/unavailable|503|econnrefused|provider.?down/.test(blob) || params.httpStatus === 503) {
    return hit(
      "provider_unavailable",
      "fallback_provider",
      true,
      "Provider unavailable — use fallback provider"
    );
  }
  if (/continuity.?depend|previous.?shot.?missing|handoff.?unavailable/.test(blob)) {
    return hit(
      "continuity_dependency_unavailable",
      "request_missing_prerequisite",
      false,
      "Continuity dependency (prior shot / last frame) is unavailable"
    );
  }
  if (/invalid.?request|400|validation/.test(blob) || params.httpStatus === 400) {
    return hit("invalid_request", "repair_intent", false, "Generation request failed validation");
  }
  if (/generation.?fail|render.?fail|provider.?error|500/.test(blob) || params.httpStatus === 500) {
    return hit(
      "generation_failure",
      "fallback_generation_strategy",
      true,
      "Generation failed — retry with alternate strategy/provider"
    );
  }

  return hit("unknown", "retry", true, params.message || "Unclassified generation failure");
}
