/**
 * Normalized QC failure taxonomy — context-sensitive application only.
 */

import type { QcFailureCode } from "./types";

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
] as const;

/** Failures that are generally retryable via regeneration / repair */
export function isRetryableFailureCode(code: QcFailureCode): boolean {
  switch (code) {
    case "technical_failure":
    case "quality_degradation":
    case "insufficient_visual_evidence":
      return true;
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
    code === "action_missing"
  );
}

/** Failures that should strengthen character / reference inputs */
export function prefersReferenceStrengthening(code: QcFailureCode): boolean {
  return (
    code === "identity_drift" ||
    code === "wardrobe_drift" ||
    code === "continuity_break" ||
    code === "prop_drift"
  );
}
