/**
 * Normalized QC failure taxonomy — context-sensitive application only.
 */

import type {
  QcFailureCode,
  QcRequirementStrength,
  QcSeverity,
  QcRepairStrategy,
  QcRootCause,
} from "./types";

export const QC_FAILURE_CODES: readonly QcFailureCode[] = [
  "identity_drift",
  "wardrobe_drift",
  "prop_drift",
  "location_drift",
  "lighting_drift",
  "time_drift",
  "composition_mismatch",
  "camera_mismatch",
  "motion_mismatch",
  "action_missing",
  "subject_missing",
  "style_mismatch",
  "prompt_mismatch",
  "duration_mismatch",
  "aspect_ratio_mismatch",
  "dialogue_missing",
  "lip_sync_failure",
  "audio_missing",
  "continuity_break",
  "quality_degradation",
  "technical_failure",
  "spatial_continuity_break",
  "screen_direction_break",
  "insufficient_visual_evidence",
  "coverage_gap",
  "narrative_incoherence",
  "asset_missing",
  "asset_unreadable",
  "resolution_mismatch",
  "orientation_mismatch",
  "product_mismatch",
  "wardrobe_mismatch",
  "prop_missing",
  "prop_state_mismatch",
  "eyeline_mismatch",
  "axis_violation",
  "screen_direction_violation",
  "blocking_mismatch",
  "action_mismatch",
  "start_state_mismatch",
  "end_state_mismatch",
  "handoff_failure",
  "camera_intent_mismatch",
  "framing_mismatch",
  "coverage_role_mismatch",
  "cinematic_purpose_mismatch",
  "visual_treatment_mismatch",
  "sync_failure",
  "repair_exhausted",
  "not_evaluated",
] as const;

/** Failures that are generally retryable via regeneration / repair */
export function isRetryableFailureCode(code: QcFailureCode): boolean {
  switch (code) {
    case "repair_exhausted":
    case "not_evaluated":
      return false;
    default:
      return true;
  }
}

/** Failures that should prefer provider change over same-provider retry */
export function prefersProviderChange(code: QcFailureCode): boolean {
  return (
    code === "motion_mismatch" ||
    code === "identity_drift" ||
    code === "quality_degradation" ||
    code === "action_missing" ||
    code === "action_mismatch" ||
    code === "technical_failure" ||
    code === "sync_failure"
  );
}

/** Failures that should strengthen character / reference inputs */
export function prefersReferenceStrengthening(code: QcFailureCode): boolean {
  return (
    code === "identity_drift" ||
    code === "wardrobe_drift" ||
    code === "wardrobe_mismatch" ||
    code === "continuity_break" ||
    code === "prop_drift" ||
    code === "prop_missing" ||
    code === "prop_state_mismatch" ||
    code === "product_mismatch" ||
    code === "location_drift"
  );
}

/** Phase 9 — severity for gate decisions */
export function failureSeverity(code: QcFailureCode): QcSeverity {
  switch (code) {
    case "asset_missing":
    case "asset_unreadable":
    case "identity_drift":
    case "product_mismatch":
    case "subject_missing":
    case "repair_exhausted":
      return "critical";
    case "wardrobe_mismatch":
    case "wardrobe_drift":
    case "prop_missing":
    case "prop_state_mismatch":
    case "prop_drift":
    case "start_state_mismatch":
    case "end_state_mismatch":
    case "handoff_failure":
    case "action_mismatch":
    case "action_missing":
    case "blocking_mismatch":
    case "screen_direction_violation":
    case "screen_direction_break":
    case "axis_violation":
    case "eyeline_mismatch":
    case "cinematic_purpose_mismatch":
    case "coverage_role_mismatch":
    case "camera_intent_mismatch":
    case "duration_mismatch":
    case "resolution_mismatch":
    case "technical_failure":
    case "continuity_break":
      return "fail";
    case "framing_mismatch":
    case "composition_mismatch":
    case "visual_treatment_mismatch":
    case "style_mismatch":
    case "lighting_drift":
    case "quality_degradation":
      return "warning";
    case "not_evaluated":
    case "insufficient_visual_evidence":
      return "unknown";
    default:
      return "fail";
  }
}

/** Phase 9 — hard vs soft production requirements */
export function requirementStrength(code: QcFailureCode): QcRequirementStrength {
  switch (code) {
    case "style_mismatch":
    case "visual_treatment_mismatch":
    case "lighting_drift":
    case "quality_degradation":
    case "composition_mismatch":
    case "framing_mismatch":
    case "time_drift":
    case "not_evaluated":
    case "insufficient_visual_evidence":
      return "soft";
    default:
      return "hard";
  }
}

/** Probable root cause for a failure — does not mutate production truth */
export function inferRootCause(code: QcFailureCode): QcRootCause {
  if (prefersReferenceStrengthening(code)) {
    return {
      observedFailure: code,
      probableCause: "Reference package incomplete, omitted, or weakly weighted",
      confidence: 0.7,
      category: "reference",
    };
  }
  if (code === "start_state_mismatch" || code === "end_state_mismatch" || code === "handoff_failure") {
    return {
      observedFailure: code,
      probableCause: "Continuity state / handoff constraint not enforced in generation",
      confidence: 0.75,
      category: "continuity_state",
    };
  }
  if (
    code === "camera_intent_mismatch" ||
    code === "cinematic_purpose_mismatch" ||
    code === "framing_mismatch" ||
    code === "coverage_role_mismatch"
  ) {
    return {
      observedFailure: code,
      probableCause: "Prompt / intent compilation did not preserve cinematic requirement",
      confidence: 0.65,
      category: "prompt",
    };
  }
  if (code === "action_mismatch" || code === "blocking_mismatch" || code === "motion_mismatch") {
    return {
      observedFailure: code,
      probableCause: "Generation strategy may not support required motion/continuity",
      confidence: 0.6,
      category: "strategy",
    };
  }
  if (prefersProviderChange(code)) {
    return {
      observedFailure: code,
      probableCause: "Provider/model unsuitable for this capability requirement",
      confidence: 0.55,
      category: "provider",
    };
  }
  if (
    code === "asset_missing" ||
    code === "asset_unreadable" ||
    code === "duration_mismatch" ||
    code === "resolution_mismatch" ||
    code === "technical_failure"
  ) {
    return {
      observedFailure: code,
      probableCause: "Technical / delivery failure before semantic evaluation",
      confidence: 0.9,
      category: "technical",
    };
  }
  return {
    observedFailure: code,
    probableCause: "Cause uncertain — needs review",
    confidence: 0.35,
    category: "unknown",
  };
}

export function suggestedRepairStrategy(code: QcFailureCode): QcRepairStrategy {
  if (code === "repair_exhausted") return "escalate_human_review";
  if (prefersReferenceStrengthening(code)) return "change_reference_set";
  if (code === "start_state_mismatch") return "change_start_frame";
  if (code === "end_state_mismatch" || code === "handoff_failure") return "change_end_frame";
  if (code === "camera_intent_mismatch" || code === "cinematic_purpose_mismatch") return "change_camera_intent";
  if (code === "motion_mismatch" || code === "action_mismatch" || code === "blocking_mismatch") {
    return "change_motion_intent";
  }
  if (prefersProviderChange(code)) return "change_provider";
  if (
    code === "continuity_break" ||
    code === "screen_direction_violation" ||
    code === "axis_violation" ||
    code === "eyeline_mismatch"
  ) {
    return "strengthen_continuity_constraints";
  }
  return "regenerate_same_intent";
}
