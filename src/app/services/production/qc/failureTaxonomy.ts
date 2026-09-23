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
import type {
  CraftOperation,
  CraftOperationType,
  CraftTargetType,
  CraftOperationParameters,
  CraftPlan,
} from "../craft/types";
import { CreativeOperationRegistry } from "../craft/operationRegistry";
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

function createCanonicalCraftOperation(
  type: CraftOperationType,
  target: { type: CraftTargetType; id?: string; label?: string },
  parameters: CraftOperationParameters,
  purpose: string
): CraftOperation | undefined {
  const reg = CreativeOperationRegistry.getInstance();
  const def = reg.getDefinition(type);
  if (!def) return undefined;

  return {
    id: `craft_repair_${type.toLowerCase()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    category: def.category,
    name: def.name,
    purpose,
    target,
    parameters,
    capabilityRequirements: [...def.capabilityRequirements],
  } as any;
}

/**
 * Phase 12 — Maps concrete QC failure + evidence + shot intent into targeted CraftOperations.
 * Does NOT use static naive mapping; respects concrete observed vs expected differences.
 * If evidence does not identify a concrete repair, returns [] rather than inventing an operation.
 */
export function failureToCraftOperations(
  code: QcFailureCode,
  evidence?: QcEvidence,
  shot?: ShotSpec,
  craftPlan?: CraftPlan,
  operationHistory?: CraftOperation[]
): CraftOperation[] {
  // If confidence is too low or visual evidence was insufficient, no operation is justified
  if (
    code === "insufficient_visual_evidence" ||
    code === "not_evaluated" ||
    (evidence?.confidence !== undefined && evidence.confidence < 0.5)
  ) {
    return [];
  }

  // Combine expected and observed evidence text to detect concrete creative directives
  const expectedText = `${evidence?.expected || ""} ${evidence?.note || ""}`.toLowerCase();
  const observedText = `${evidence?.observed || ""}`.toLowerCase();
  const combined = `${expectedText} ${observedText}`.toLowerCase();

  const ops: CraftOperation[] = [];
  const existingOps = [
    ...(craftPlan?.operations || []),
    ...(operationHistory || []),
  ];

  const canAdd = (type: CraftOperationType): boolean => {
    const reg = CreativeOperationRegistry.getInstance();
    if (existingOps.some((op) => op.type === type)) return false;
    if (existingOps.some((op) => reg.areMutuallyExclusive(type, op.type))) return false;
    return true;
  };

  // 1. Camera / Framing Failures
  if (
    code === "camera_mismatch" ||
    code === "camera_failure" ||
    code === "framing_mismatch" ||
    code === "camera_intent_mismatch" ||
    code === "composition_mismatch"
  ) {
    if (expectedText.includes("push") || expectedText.includes("zoom in")) {
      if (canAdd("PUSH_IN")) {
        const op = createCanonicalCraftOperation(
          "PUSH_IN",
          { type: "CAMERA", id: "camera_main" },
          { direction: "forward", speed: "normal", distance: "moderate" },
          "Repair camera: apply push-in to satisfy expected forward camera movement"
        );
        if (op) ops.push(op);
      }
    } else if (expectedText.includes("pull") || expectedText.includes("zoom out")) {
      if (canAdd("PULL_BACK")) {
        const op = createCanonicalCraftOperation(
          "PULL_BACK",
          { type: "CAMERA", id: "camera_main" },
          { direction: "backward", speed: "normal", distance: "moderate" },
          "Repair camera: apply pull-back to satisfy expected backward camera movement"
        );
        if (op) ops.push(op);
      }
    } else if (expectedText.includes("orbit") || expectedText.includes("arc")) {
      if (canAdd("ORBIT")) {
        const op = createCanonicalCraftOperation(
          "ORBIT",
          { type: "CAMERA", id: "camera_main" },
          { direction: "clockwise", degrees: 45, speed: "normal" },
          "Repair camera: apply orbit to satisfy expected rotational movement"
        );
        if (op) ops.push(op);
      }
    } else if (expectedText.includes("tilt")) {
      if (canAdd("TILT")) {
        const dir = expectedText.includes("down") ? "down" : "up";
        const op = createCanonicalCraftOperation(
          "TILT",
          { type: "CAMERA", id: "camera_main" },
          { direction: dir, angleDegrees: 20, speed: "normal" },
          `Repair camera: apply tilt ${dir} to satisfy expected vertical movement`
        );
        if (op) ops.push(op);
      }
    } else if (expectedText.includes("pan")) {
      if (canAdd("PAN")) {
        const dir = expectedText.includes("right") ? "right" : "left";
        const op = createCanonicalCraftOperation(
          "PAN",
          { type: "CAMERA", id: "camera_main" },
          { direction: dir, angleDegrees: 20, speed: "normal" },
          `Repair camera: apply pan ${dir} to satisfy expected horizontal movement`
        );
        if (op) ops.push(op);
      }
    } else if (expectedText.includes("track") || expectedText.includes("dolly")) {
      if (canAdd("TRACK")) {
        const op = createCanonicalCraftOperation(
          "TRACK",
          { type: "CAMERA", id: "camera_main" },
          { axis: "forward" },
          "Repair camera: apply tracking movement to follow action"
        );
        if (op) ops.push(op);
      }
    } else if (code === "composition_mismatch" || code === "framing_mismatch") {
      if (expectedText.includes("close") && canAdd("CLOSE_UP")) {
        const op = createCanonicalCraftOperation(
          "CLOSE_UP",
          { type: "SUBJECT", id: shot?.subject || "subject_main" },
          {},
          "Repair framing: apply close-up composition to satisfy expected shot scale"
        );
        if (op) ops.push(op);
      } else if (expectedText.includes("wide") && canAdd("WIDE_ESTABLISHING")) {
        const op = createCanonicalCraftOperation(
          "WIDE_ESTABLISHING",
          { type: "ENVIRONMENT", id: "environment_main" },
          {},
          "Repair framing: apply wide establishing composition to satisfy expected spatial context"
        );
        if (op) ops.push(op);
      }
    }
    // If evidence lacks a concrete camera or framing directive, we intentionally return []
    // rather than guessing or defaulting to PAN/TRACK.
  }

  // 2. Motion / Action Failures
  if (
    code === "motion_mismatch" ||
    code === "motion_failure" ||
    code === "action_mismatch" ||
    code === "action_missing"
  ) {
    if (combined.includes("product_spin") || combined.includes("spin") || combined.includes("rotate")) {
      if (canAdd("PRODUCT_SPIN")) {
        const op = createCanonicalCraftOperation(
          "PRODUCT_SPIN",
          { type: "PRODUCT", id: "product_main" },
          { axis: "y_vertical", rotationDegrees: 360, rotationSpeed: "medium" },
          "Repair motion: apply product spin to satisfy expected rotational showcase"
        );
        if (op) ops.push(op);
      }
    } else if (combined.includes("tracking") || combined.includes("follow") || combined.includes("subject_tracking")) {
      if (canAdd("SUBJECT_TRACKING")) {
        const op = createCanonicalCraftOperation(
          "SUBJECT_TRACKING",
          { type: "SUBJECT", id: shot?.subject || "subject_main" },
          { targetSubject: shot?.subject || "subject_main", trackingSmoothness: "smooth" },
          "Repair motion: apply subject tracking to follow subject movement"
        );
        if (op) ops.push(op);
      }
    } else if (combined.includes("slow_motion") || combined.includes("slow motion")) {
      if (canAdd("SLOW_MOTION")) {
        const op = createCanonicalCraftOperation(
          "SLOW_MOTION",
          { type: "SHOT", id: shot?.id || "shot_main" },
          { speedFactor: 0.5 },
          "Repair motion: apply slow motion to satisfy timing intent"
        );
        if (op) ops.push(op);
      }
    }
    // If evidence lacks a concrete motion directive, we intentionally return []
    // rather than defaulting to TRACKING.
  }

  // 3. Lighting Failures
  if (code === "lighting_drift" || code === "lighting_failure") {
    if (combined.includes("sweep") || combined.includes("light_sweep") || combined.includes("beam")) {
      if (canAdd("LIGHT_SWEEP")) {
        const op = createCanonicalCraftOperation(
          "LIGHT_SWEEP",
          { type: "LIGHTING", id: "lighting_main" },
          { lightSource: "spot", direction: "left_to_right", intensity: "soft" },
          "Repair lighting: apply light sweep to accentuate subject contours"
        );
        if (op) ops.push(op);
      }
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
    if (shot.references.firstFrameUrl && shot.references.lastFrameUrl && !profile.temporal?.supportsStartAndEndFrame) {
      return {
        deficient: true,
        requiredCapability: "start_and_end_frame",
        reason: "Shot requires start and end frames but provider does not support start+end frame conditioning",
      };
    }
  }

  // 4. Camera control: does shot demand camera motion when provider has none?
  if ((code === "camera_mismatch" || code === "camera_failure") && shot?.camera?.cameraMovement) {
    if (profile.camera?.controlLevel === "none") {
      return {
        deficient: true,
        requiredCapability: "camera_control",
        reason: `Shot requires camera movement ${shot.camera.cameraMovement} but provider has no camera control`,
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

