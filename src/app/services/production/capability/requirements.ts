/**
 * Build provider-neutral CapabilityRequirements from shot / generation context.
 * Prepares Phase 5/6 ShotSpec → requirements → router without implementing those phases.
 */

import type { ShotSpec, GenerationStrategy } from "../specification/shotSpec";
import type { GenerationTask } from "../specification/generationTask";
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
  if (shot.generationStrategy === "text_to_image" || shot.generationStrategy === "slideshow_still") {
    const types: ReferenceType[] = [];
    if (shot.references?.firstFrameUrl || shot.references?.lastFrameUrl) types.push("image");
    if (shot.references?.styleRefs?.length) types.push("style");
    return types;
  }
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

/**
 * Derives CapabilityRequirements directly from an executable GenerationTask and prepared inputs.
 * Used by execution engine and validation guards to verify feasibility before remote submission.
 */
export function capabilityRequirementsFromTask(
  task: GenerationTask,
  inputs: { role?: string; url?: string }[] = [],
  extra: { aspectRatio?: string; durationSec?: number; resolution?: string } = {}
): CapabilityRequirements {
  const isImageKind =
    task.kind === "keyframe" ||
    task.strategy.modality === "text_to_image" ||
    task.strategy.modality === "image_to_image" ||
    task.strategy.modality === "slideshow_still";

  const isAudioKind =
    task.kind === "voice" ||
    task.kind === "sfx" ||
    task.kind === "music" ||
    task.strategy.modality === "voice" ||
    task.strategy.modality === "audio";

  const modality: "image" | "video" | "audio" = isImageKind
    ? "image"
    : isAudioKind
      ? "audio"
      : "video";

  const isVideo = modality === "video";

  const generationMode: GenerationMode =
    modality === "image"
      ? (task.strategy.modality === "image_to_image" || task.strategy.modality === "edit")
        ? "image_to_image"
        : "text_to_image"
      : modality === "audio"
        ? "text_to_speech"
        : (task.strategy.modality === "text_to_video")
          ? "text_to_video"
          : (task.strategy.modality === "extend" || task.kind === "extend")
            ? "video_extension"
            : "image_to_video";

  const hasStart = inputs.some((i) => (i.role === "first_frame" || i.role === "start_frame") && i.url);
  const hasEnd = inputs.some((i) => (i.role === "last_frame" || i.role === "end_frame" || i.role === "tail_frame") && i.url);

  const refTypes: ReferenceType[] = [];
  for (const input of inputs) {
    if (!input.url) continue;
    if (input.role === "character") refTypes.push("character");
    else if (input.role === "style") refTypes.push("style");
    else if (input.role === "location" || input.role === "environment") refTypes.push("location");
    else if (input.role === "reference_image" || input.role === "reference") refTypes.push("image");
  }

  const durationSeconds = isVideo || modality === "audio"
    ? (extra.durationSec ?? (task.outputRequirements?.durationSec != null && Number.isFinite(task.outputRequirements?.durationSec) ? Math.round(task.outputRequirements?.durationSec) : undefined))
    : undefined;

  return {
    modality,
    generationMode,
    references: refTypes.length
      ? {
          types: Array.from(new Set(refTypes)),
          minimumCount: refTypes.length,
        }
      : undefined,
    temporal: {
      requiresStartFrame: isVideo && hasStart,
      requiresEndFrame: isVideo && hasEnd,
      requiresStartAndEnd: isVideo && hasStart && hasEnd,
      requiresContinuation: false,
      requiresExtension: task.strategy.modality === "extend" || task.kind === "extend",
    },
    output: {
      durationSeconds,
      aspectRatio: extra.aspectRatio ?? task.outputRequirements?.aspectRatio,
      resolution: extra.resolution ?? task.outputRequirements?.resolutionClass,
    },
    preferences: {
      objective: "balanced",
      preferredProviderId: task.selectedProvider,
      preferredModelId: task.selectedModel,
    },
  };
}


