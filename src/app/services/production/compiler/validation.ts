/**
 * Multi-layer validation for Provider Payload Compilation.
 */

import type { MediaCapabilityProfile } from "../capability/types";
import type { CompiledMediaInput, CompilationValidation } from "./types";

export function validateCompilation(params: {
  providerId: string;
  modelId: string;
  operation: string;
  mediaInputs: CompiledMediaInput[];
  profile: MediaCapabilityProfile;
  rawPayload: Record<string, unknown>;
  initialErrors?: string[];
  initialWarnings?: string[];
  initialDegradations?: string[];
}): CompilationValidation {
  const {
    providerId,
    modelId,
    operation,
    mediaInputs,
    profile,
    rawPayload,
    initialErrors = [],
    initialWarnings = [],
    initialDegradations = [],
  } = params;

  const errors: string[] = [...initialErrors];
  const warnings: string[] = [...initialWarnings];
  const degradedFeatures: string[] = [...initialDegradations];

  // 1. Validate required frames for I2V
  if (operation === "image_to_video") {
    const hasFirstFrame = mediaInputs.some((m) => m.role === "first_frame" && Boolean(m.url));
    if (!hasFirstFrame) {
      errors.push("MISSING_REQUIRED_START_FRAME: Image-to-video operation requires a start frame (keyframe).");
    }
  }

  // 2. Validate End Frame capability
  const hasEndFrame = mediaInputs.some((m) => m.role === "last_frame" && Boolean(m.url));
  if (hasEndFrame && !profile.temporal.supportsEndFrame) {
    errors.push(`UNSUPPORTED_TEMPORAL_REQUIREMENT: Model ${modelId} does not support end-frame conditioning.`);
  }

  // 3. Validate reference limits
  const refImages = mediaInputs.filter((m) => m.role === "reference_image" || m.role === "character_reference");
  const maxRefs = profile.limits.maxReferenceCount ?? (profile.references.maxReferences ?? 7);
  if (refImages.length > maxRefs) {
    errors.push(`REFERENCE_LIMIT_EXCEEDED: Provided ${refImages.length} references, maximum allowed is ${maxRefs}.`);
  }

  // 4. Validate credentials never leak into payload
  const serialized = JSON.stringify(rawPayload).toLowerCase();
  const secretKeywords = ["api_key", "secret_key", "authorization", "bearer ", "private_key"];
  for (const keyword of secretKeywords) {
    if (serialized.includes(keyword)) {
      errors.push(`SECURITY_VIOLATION: Payload contains forbidden credential token '${keyword}'`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    degradedFeatures,
  };
}
