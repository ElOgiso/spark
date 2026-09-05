/**
 * Build provider-neutral CapabilityRequirements from shot / generation context.
 * Prepares Phase 5/6 ShotSpec → requirements → router without implementing those phases.
 */

import type { ShotSpec, GenerationStrategy } from "../specification/shotSpec";
import type { CapabilityRequirements, GenerationMode, ReferenceType, RoutingObjective } from "./types";

function strategyToMode(strategy: GenerationStrategy | string | undefined): GenerationMode | undefined {
  switch (strategy) {
    case "text_to_image":
    case "slideshow_still":
      return "text_to_image";
    case "image_to_image":
    case "edit":
      return "image_to_image";
    case "text_to_video":
      return "text_to_video";
    case "first_last_frame":
    case "image_to_video":
    case "multi_reference":
      return "image_to_video";
    case "extend":
      return "video_extension";
    case "voice":
    case "audio":
      return "text_to_speech";
    default:
      return "image_to_video";
  }
}

function collectReferenceTypes(shot: ShotSpec): ReferenceType[] {
  const types: ReferenceType[] = [];
  const refs = shot.references;
  if (!refs) return types;
  if (refs.characterRefs?.length) types.push("character");
  if (refs.locationRefs?.length) types.push("location", "environment");
  if (refs.styleRefs?.length) types.push("style");
  if (refs.firstFrameUrl || refs.lastFrameUrl) types.push("image");
  return Array.from(new Set(types));
}

export interface RequirementsFromShotOptions {
  aspectRatio?: string;
  objective?: RoutingObjective;
  preferredProviderId?: string;
  preferredModelId?: string;
  manualOverride?: boolean;
}

/**
 * Provider-neutral requirements derived from a shot.
 * Does not select a provider.
 */
export function capabilityRequirementsFromShot(
  shot: ShotSpec,
  opts: RequirementsFromShotOptions = {}
): CapabilityRequirements {
  const mode = strategyToMode(shot.generationStrategy);
  const refTypes = collectReferenceTypes(shot);
  const needsStart =
    Boolean(shot.references?.firstFrameUrl) ||
    mode === "image_to_video" ||
    shot.generationStrategy === "first_last_frame" ||
    shot.generationStrategy === "image_to_video" ||
    shot.generationStrategy === "multi_reference";
  const needsEnd =
    Boolean(shot.references?.lastFrameUrl) || shot.generationStrategy === "first_last_frame";
  const needsExtension = shot.generationStrategy === "extend";
  // previousShotId implies last-frame / start continuity, not full video continuation APIs
  const needsContinuation = false;

  const minimumCount =
    (shot.references?.characterRefs?.length || 0) +
      (shot.references?.locationRefs?.length || 0) +
      (shot.references?.styleRefs?.length || 0) || refTypes.length;

  const modality =
    mode === "text_to_speech"
      ? "audio"
      : mode === "text_to_image" || mode === "image_to_image"
        ? "image"
        : "video";

  const durationSeconds =
    shot.durationSec != null && Number.isFinite(shot.durationSec)
      ? Math.round(shot.durationSec)
      : undefined;

  return {
    modality,
    generationMode: mode,
    references: refTypes.length
      ? {
          types: refTypes,
          minimumCount: Math.max(1, minimumCount),
        }
      : undefined,
    temporal: {
      requiresStartFrame: needsStart,
      requiresEndFrame: needsEnd,
      requiresStartAndEnd: needsStart && needsEnd,
      requiresContinuation: needsContinuation,
      requiresExtension: needsExtension,
    },
    output: {
      durationSeconds,
      aspectRatio: opts.aspectRatio || shot.aspectRatio,
    },
    preferences: {
      objective: opts.objective || "balanced",
      preferredProviderId: opts.preferredProviderId,
      preferredModelId: opts.preferredModelId,
      manualOverride: opts.manualOverride,
    },
  };
}

/** Explicit builder for tests / planners that don't have a ShotSpec yet. */
export function buildCapabilityRequirements(
  partial: CapabilityRequirements
): CapabilityRequirements {
  return {
    ...partial,
    preferences: {
      objective: "balanced",
      ...(partial.preferences || {}),
    },
  };
}
