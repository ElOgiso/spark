/**
 * Normalized QC failure taxonomy — context-sensitive application only.
 */

import type {
  QcFailureCode,
  QcRequirementStrength,
  QcSeverity,
  QcRepairStrategy,
  QcRootCause,
  QcEvidence,
} from "./types";
import type { CraftOperation } from "../craft/types";
import type { ShotSpec } from "../specification/shotSpec";
import type { MediaCapabilityProfile } from "../capability/types";

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
  "sync_failure",
  "repair_exhausted",
  "not_evaluated",
  // Phase 12 taxonomy additions
  "output_invalid",
  "format_mismatch",
  "dimension_mismatch",
  "reference_failure",
  "continuity_failure",
  "composition_failure",
  "camera_failure",
  "motion_failure",
  "style_failure",
  "lighting_failure",
  "environment_failure",
  "subject_failure",
  "object_failure",
  "temporal_failure",
  "audio_failure",
  "provider_artifact",
  "corrupted_output",
  "semantic_mismatch",
  "unknown_failure",
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

/**
  * Phase 12 — Maps concrete QC failure + evidence + shot intent into targeted CraftOperations.
  * Does NOT use static naive mapping; respects concrete observed vs expected differences.
  */
export function failureToCraftOperations(
  code: QcFailureCode,
  evidence?: QcEvidence,
  shot?: ShotSpec
): CraftOperation[] {
  const text = `${evidence?.expected || ""} ${evidence?.observed || ""} ${evidence?.note || ""} ${shot?.cameraMovement || ""} ${shot?.framing || ""}`.toLowerCase();
  const ops: CraftOperation[] = [];

  // Camera / Framing failures -> targeted CAMERA CraftOperations
  if (
    code === "camera_mismatch" ||
    code === "camera_failure" ||
    code === "framing_mismatch" ||
    code === "camera_intent_mismatch"
  ) {
    if (text.includes("push") || text.includes("zoom in")) {
      ops.push({
        id: `craft_repair_${Date.now()}_push`,
        type: "PUSH_IN",
        category: "CAMERA",
        name: "Push In",
        target: { type: "CAMERA", id: "camera_main" },
        parameters: { speed: 1.2, intensity: 0.8 },
      } as any);
    } else if (text.includes("pull") || text.includes("zoom out")) {
      ops.push({
        id: `craft_repair_${Date.now()}_pull`,
        type: "PULL_BACK",
        category: "CAMERA",
        name: "Pull Back",
        target: { type: "CAMERA", id: "camera_main" },
        parameters: { speed: 1.2, intensity: 0.8 },
      } as any);
    } else if (text.includes("orbit") || text.includes("arc")) {
      ops.push({
        id: `craft_repair_${Date.now()}_orbit`,
        type: "ORBIT",
        category: "CAMERA",
        name: "Orbit",
        target: { type: "CAMERA", id: "camera_main" },
        parameters: { degrees: 45, direction: "clockwise" },
      } as any);
    } else if (text.includes("low_angle") || text.includes("low angle") || text.includes("tilt")) {
      ops.push({
        id: `craft_repair_${Date.now()}_tilt`,
        type: "TILT",
        category: "CAMERA",
        name: "Tilt Up / Low Angle",
        target: { type: "CAMERA", id: "camera_main" },
        parameters: { angleDegrees: 25, direction: "up" },
      } as any);
    } else {
      if (shot?.cameraMovement === "push_in") {
        ops.push({
          id: `craft_repair_${Date.now()}_push`,
          type: "PUSH_IN",
          category: "CAMERA",
          name: "Push In",
          target: { type: "CAMERA", id: "camera_main" },
          parameters: { speed: 1.0 },
        } as any);
      } else if (shot?.cameraMovement === "tracking") {
        ops.push({
          id: `craft_repair_${Date.now()}_track`,
          type: "TRACKING",
          category: "MOTION",
          name: "Tracking",
          target: { type: "SUBJECT", id: "subject_main" },
          parameters: { smoothTracking: true },
        } as any);
      } else {
        ops.push({
          id: `craft_repair_${Date.now()}_pan`,
          type: "PAN",
          category: "CAMERA",
          name: "Pan",
          target: { type: "CAMERA", id: "camera_main" },
          parameters: { degrees: 15 },
        } as any);
      }
    }
  }

  // Motion / Action failures -> targeted MOTION CraftOperations
  if (
    code === "motion_mismatch" ||
    code === "motion_failure" ||
    code === "action_mismatch" ||
    code === "action_missing"
  ) {
    if (text.includes("spin") || text.includes("rotate") || text.includes("product")) {
      ops.push({
        id: `craft_repair_${Date.now()}_spin`,
        type: "PRODUCT_SPIN",
        category: "MOTION",
        name: "Product Spin",
        target: { type: "PRODUCT", id: "product_main" },
        parameters: { revolutions: 1, smooth: true },
      } as any);
    } else if (text.includes("tracking") || text.includes("track")) {
      ops.push({
        id: `craft_repair_${Date.now()}_track`,
        type: "TRACKING",
        category: "MOTION",
        name: "Tracking",
        target: { type: "SUBJECT", id: "subject_main" },
        parameters: { smoothTracking: true },
      } as any);
    } else {
      ops.push({
        id: `craft_repair_${Date.now()}_mot`,
        type: "TRACKING",
        category: "MOTION",
        name: "Tracking Motion",
        target: { type: "SUBJECT", id: "subject_main" },
        parameters: { intensity: 0.8 },
      } as any);
    }
  }

  // Lighting failures -> targeted LIGHTING CraftOperations
  if (code === "lighting_drift" || code === "lighting_failure") {
    if (text.includes("sweep") || text.includes("beam")) {
      ops.push({
        id: `craft_repair_${Date.now()}_sweep`,
        type: "LIGHT_SWEEP",
        category: "LIGHTING",
        name: "Light Sweep",
        target: { type: "SUBJECT", id: "subject_main" },
        parameters: { angle: 45, intensity: 0.8 },
      } as any);
    } else {
      ops.push({
        id: `craft_repair_${Date.now()}_volumetric`,
        type: "LIGHTING_VOLUMETRIC",
        category: "LIGHTING",
        name: "Volumetric Lighting",
        target: { type: "CAMERA", id: "camera_main" },
        parameters: { hazeDensity: 0.4 },
      } as any);
    }
  }

  return ops;
}

/**
 * Phase 12 — Determines whether a failure stems from a true provider capability deficiency.
 * Uses MediaCapabilityProfile truth — never assumes failure equals deficiency.
 */
export function isCapabilityDeficiency(
  code: QcFailureCode,
  shot?: ShotSpec,
  profile?: MediaCapabilityProfile
): { deficient: boolean; requiredCapability?: string; reason?: string } {
  if (!profile) return { deficient: false };

  // 1. Duration mismatch: does shot duration exceed provider limit?
  if (code === "duration_mismatch" && shot?.durationSec) {
    const maxDur = profile.limits?.maxDurationSec ?? profile.output?.duration?.maxSeconds ?? 10;
    if (shot.durationSec > maxDur) {
      return {
        deficient: true,
        requiredCapability: `duration_${shot.durationSec}s`,
        reason: `Shot duration ${shot.durationSec}s exceeds provider limit of ${maxDur}s`,
      };
    }
  }

  // 2. Reference / identity failure: does shot require multiple character refs and provider lacks multi-reference?
  if ((code === "reference_failure" || code === "identity_drift") && shot) {
    const refCount = (shot.references?.characterRefs?.length || 0) + (shot.characterIds?.length || 0);
    if (refCount > 1 && !profile.references?.supportsMultipleReferences) {
      return {
        deficient: true,
        requiredCapability: "multi_reference",
        reason: `Shot requires ${refCount} references but provider does not support multiple references`,
      };
    }
  }

  // 3. Start/End frame / temporal continuity: does shot require start and end frames?
  if ((code === "start_state_mismatch" || code === "end_state_mismatch" || code === "handoff_failure") && shot) {
    if (shot.firstFrameUrl && shot.lastFrameUrl && !profile.temporal?.supportsStartAndEndFrame) {
      return {
        deficient: true,
        requiredCapability: "start_and_end_frame",
        reason: "Shot requires start and end frames but provider does not support start+end frame conditioning",
      };
    }
  }

  // 4. Camera control: does shot demand camera motion when provider has none?
  if ((code === "camera_mismatch" || code === "camera_failure") && shot?.cameraMovement) {
    if (profile.camera?.controlLevel === "none") {
      return {
        deficient: true,
        requiredCapability: "camera_control",
        reason: `Shot requires camera movement ${shot.cameraMovement} but provider has no camera control`,
      };
    }
  }

  // 5. Audio generation missing
  if ((code === "audio_missing" || code === "audio_failure") && (shot as any)?.requiresAudio) {
    if (!profile.audio?.nativeAudioGeneration) {
      return {
        deficient: true,
        requiredCapability: "native_audio",
        reason: "Shot requires native audio generation but provider does not support audio",
      };
    }
  }

  return { deficient: false };
}

