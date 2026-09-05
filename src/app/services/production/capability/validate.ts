/**
 * Validate capability requirements against an effective profile.
 * Hard mismatches reject; soft gaps become warnings.
 */

import type {
  CapabilityRequirements,
  CapabilityMatchResult,
  CapabilityMismatch,
  CapabilityMatchItem,
  CapabilityWarning,
  MediaCapabilityProfile,
  RoutingReasonCode,
  CameraControlLevel,
  MotionControlLevel,
} from "./types";

const CONTROL_RANK: Record<CameraControlLevel | MotionControlLevel, number> = {
  none: 0,
  prompt_only: 1,
  structured: 2,
};

function durationSupported(profile: MediaCapabilityProfile, seconds?: number): boolean {
  if (seconds == null) return true;
  const d = profile.output.duration;
  if (!d) return true;
  if (d.maxSeconds != null && seconds > d.maxSeconds) return false;
  if (d.minSeconds != null && seconds < d.minSeconds) return false;
  if (d.supportedValues?.length) {
    if (
      d.supportedValues.includes(seconds) ||
      d.supportedValues.some((v) => Math.abs(v - seconds) < 0.01)
    ) {
      return true;
    }
    // Within the supported span — runtime may snap to a native value
    const minV = Math.min(...d.supportedValues);
    const maxV = Math.max(...d.supportedValues);
    return seconds >= minV && seconds <= maxV;
  }
  return true;
}

function aspectSupported(profile: MediaCapabilityProfile, aspect?: string): boolean {
  if (!aspect) return true;
  const list = profile.output.aspectRatios;
  if (!list?.length) return true;
  const norm = aspect.replace(/\s/g, "");
  return list.some((a) => a.replace(/\s/g, "") === norm);
}

export function validateCapabilityRequirements(
  requirements: CapabilityRequirements,
  effective: MediaCapabilityProfile
): CapabilityMatchResult {
  const matched: CapabilityMatchItem[] = [];
  const missing: CapabilityMismatch[] = [];
  const unsupported: CapabilityMismatch[] = [];
  const warnings: CapabilityWarning[] = [];
  const conflicts: CapabilityMismatch[] = [];
  const reasonCodes: RoutingReasonCode[] = [];

  const pushHard = (code: RoutingReasonCode, requirement: string, detail: string) => {
    const item: CapabilityMismatch = { code, requirement, detail, hard: true };
    missing.push(item);
    unsupported.push(item);
    reasonCodes.push(code);
  };

  // Adapter gate
  if (!effective.adapterSupported) {
    pushHard(
      "REJECTED_ADAPTER_UNSUPPORTED",
      "adapter",
      `${effective.providerId}/${effective.modelId} has no executable SPARK adapter`
    );
  } else {
    matched.push({ requirement: "adapter", satisfied: true });
    reasonCodes.push("ADAPTER_SUPPORTED");
  }

  // Generation mode
  if (requirements.generationMode) {
    if (!effective.generationModes.includes(requirements.generationMode)) {
      pushHard(
        "REJECTED_UNSUPPORTED_MODE",
        "generationMode",
        `Mode ${requirements.generationMode} not in effective modes [${effective.generationModes.join(", ")}]`
      );
    } else {
      matched.push({ requirement: `mode:${requirements.generationMode}`, satisfied: true });
    }
  }

  // Modality
  if (!effective.modalities.includes(requirements.modality)) {
    pushHard(
      "REJECTED_UNSUPPORTED_MODE",
      "modality",
      `Modality ${requirements.modality} unsupported`
    );
  } else {
    matched.push({ requirement: `modality:${requirements.modality}`, satisfied: true });
  }

  // Temporal hard requirements
  const temporal = requirements.temporal;
  if (temporal?.requiresStartFrame || temporal?.requiresStartAndEnd) {
    if (!effective.temporal.supportsStartFrame) {
      pushHard("REJECTED_MISSING_START_FRAME", "startFrame", "Start frame required but not supported");
    } else {
      matched.push({ requirement: "startFrame", satisfied: true });
    }
  }
  if (temporal?.requiresEndFrame || temporal?.requiresStartAndEnd) {
    if (!effective.temporal.supportsEndFrame) {
      pushHard("REJECTED_MISSING_END_FRAME", "endFrame", "End frame required but not supported");
    } else {
      matched.push({ requirement: "endFrame", satisfied: true });
    }
  }
  if (temporal?.requiresStartAndEnd) {
    if (!effective.temporal.supportsStartAndEndFrame) {
      pushHard(
        "REJECTED_MISSING_START_AND_END",
        "startAndEndFrame",
        "Start+end frame required but not jointly supported"
      );
    } else {
      matched.push({ requirement: "startAndEndFrame", satisfied: true });
    }
  }
  if (temporal?.requiresContinuation && !effective.temporal.supportsVideoContinuation) {
    pushHard(
      "REJECTED_CONTINUATION_UNSUPPORTED",
      "continuation",
      "Video continuation required but not supported"
    );
  }
  if (temporal?.requiresExtension && !effective.temporal.supportsVideoExtension) {
    pushHard(
      "REJECTED_EXTENSION_UNSUPPORTED",
      "extension",
      "Video extension required but not supported"
    );
  }

  // References
  const refs = requirements.references;
  if (refs?.types?.length) {
    const missingTypes = refs.types.filter((t) => !effective.references.supportedTypes.includes(t));
    if (missingTypes.length) {
      pushHard(
        "REJECTED_MISSING_REFERENCE_SUPPORT",
        "references",
        `Missing reference types: ${missingTypes.join(", ")}`
      );
    } else {
      matched.push({ requirement: `references:${refs.types.join("+")}`, satisfied: true });
    }
    const minCount = refs.minimumCount ?? refs.types.length;
    if (minCount > 1 && !effective.references.supportsMultipleReferences) {
      pushHard(
        "REJECTED_INSUFFICIENT_REFERENCES",
        "multiReference",
        `Requires ${minCount} references; multi-reference unsupported`
      );
    }
    if (
      effective.references.maxReferences != null &&
      minCount > effective.references.maxReferences
    ) {
      pushHard(
        "REJECTED_INSUFFICIENT_REFERENCES",
        "maxReferences",
        `Requires ${minCount} refs; max ${effective.references.maxReferences}`
      );
    }
  }

  // Output duration / aspect
  if (requirements.output?.durationSeconds != null) {
    if (!durationSupported(effective, requirements.output.durationSeconds)) {
      pushHard(
        "REJECTED_UNSUPPORTED_DURATION",
        "duration",
        `Duration ${requirements.output.durationSeconds}s unsupported`
      );
    } else {
      matched.push({
        requirement: `duration:${requirements.output.durationSeconds}`,
        satisfied: true,
      });
    }
  }
  if (requirements.output?.aspectRatio) {
    if (!aspectSupported(effective, requirements.output.aspectRatio)) {
      pushHard(
        "REJECTED_UNSUPPORTED_ASPECT_RATIO",
        "aspectRatio",
        `Aspect ${requirements.output.aspectRatio} unsupported`
      );
    } else {
      matched.push({
        requirement: `aspect:${requirements.output.aspectRatio}`,
        satisfied: true,
      });
    }
  }
  if (requirements.output?.requiresNativeAudio && !effective.output.supportsNativeAudio) {
    warnings.push({
      code: "NATIVE_AUDIO_UNAVAILABLE",
      message: "Native audio preferred/required but not available on effective profile",
    });
    if (requirements.audio?.required) {
      pushHard("REJECTED_UNSUPPORTED_MODE", "nativeAudio", "Native audio required");
    }
  }

  // Camera / motion — structured required is hard; prompt_only is soft if profile is none
  if (requirements.camera?.requiresCameraControl) {
    const need = requirements.camera.minimumControlLevel || "prompt_only";
    if (CONTROL_RANK[effective.camera.controlLevel] < CONTROL_RANK[need]) {
      if (need === "structured") {
        pushHard(
          "REJECTED_UNSUPPORTED_MODE",
          "cameraControl",
          `Structured camera control required; have ${effective.camera.controlLevel}`
        );
      } else {
        warnings.push({
          code: "CAMERA_CONTROL_SOFT",
          message: `Camera control level ${effective.camera.controlLevel} below preferred ${need}`,
        });
      }
    } else {
      matched.push({ requirement: "cameraControl", satisfied: true });
    }
  }
  if (requirements.motion?.minimumControlLevel === "structured") {
    if (CONTROL_RANK[effective.motion.controlLevel] < CONTROL_RANK.structured) {
      pushHard(
        "REJECTED_UNSUPPORTED_MODE",
        "motionControl",
        `Structured motion control required; have ${effective.motion.controlLevel}`
      );
    }
  }

  // Manual override preference checked by router (not here)

  const hardRequirementsSatisfied = missing.filter((m) => m.hard).length === 0;
  if (hardRequirementsSatisfied) {
    reasonCodes.push("CAPABILITY_MATCH");
  }

  return {
    compatible: hardRequirementsSatisfied,
    hardRequirementsSatisfied,
    matched,
    missing,
    unsupported,
    warnings,
    conflicts,
    reasonCodes: Array.from(new Set(reasonCodes)),
  };
}
