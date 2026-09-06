/**
 * Generation Frame Strategy — capability-driven bridge from storyboard frames
 * to provider execution. Not a new engine / router / orchestrator.
 *
 * StoryboardFrame = planned visual state
 * GeneratedStateFrame = observed terminal state from a prior video
 * Sheet overview is NEVER selected as default video input.
 */

import type { StoryboardFrameAsset } from "../preproduction/storyboardFrame";

export type GenerationFrameStrategyMode =
  | "REFERENCE_ONLY"
  | "FIRST_FRAME"
  | "FIRST_LAST_FRAME"
  | "START_END"
  | "CONTINUATION"
  | "REFERENCE_PLUS_FIRST_FRAME"
  | "REFERENCE_PLUS_CONTINUATION"
  | "NONE";

/** Minimal capability surface required from EffectiveCapabilityProfile / adapters. */
export interface FrameStrategyCapabilities {
  supportsReferenceImages?: boolean;
  supportsStartFrame?: boolean;
  supportsEndFrame?: boolean;
  supportsStartAndEndFrame?: boolean;
  supportsVideoContinuation?: boolean;
  supportsLastFrameContinuation?: boolean;
}

export interface GeneratedStateFrameRef {
  id: string;
  url: string;
  position: "FIRST" | "LAST" | "MIDDLE" | "TIMECODE";
  sourceVideoAssetId: string;
  sourceShotId: string;
  sourceGenerationTaskId?: string;
  timestampSec?: number;
}

export interface FrameStrategyInput {
  /** Planned storyboard frame for this shot (preferred visual plan) */
  storyboardFrame?: StoryboardFrameAsset | null;
  /** Optional planned end frame (another panel / end-state board) */
  storyboardEndFrame?: StoryboardFrameAsset | null;
  /** Observed terminal state from previous generated shot */
  previousGeneratedState?: GeneratedStateFrameRef | null;
  /** Extra identity / style / location refs */
  referenceUrls?: string[];
  /** Hard requirements from shot/intent */
  preferContinuation?: boolean;
  preferFirstLast?: boolean;
  /** Provider effective capabilities — strategy cannot claim unsupported modes */
  capabilities: FrameStrategyCapabilities;
}

export interface ResolvedFrameStrategy {
  mode: GenerationFrameStrategyMode;
  firstFrameUrl?: string;
  lastFrameUrl?: string;
  continuationSourceUrl?: string;
  referenceUrls: string[];
  /** Storyboard plan remains authoritative for narrative/composition even under continuation */
  storyboardFrameId?: string;
  storyboardEndFrameId?: string;
  previousGeneratedStateId?: string;
  /** Why this mode was chosen */
  rationale: string[];
  /** Capabilities requested but unavailable — never silently sent to adapter */
  unsupportedRequested: string[];
  /** Confidence that provider can honor the strategy */
  confidence: number;
}

function urlOf(frame?: StoryboardFrameAsset | null): string | undefined {
  return frame?.url && frame.url.trim() ? frame.url : undefined;
}

/**
 * Resolve how frames should be supplied to the selected video model.
 * Capability-first: never emits unsupported conditioning fields.
 */
export function resolveGenerationFrameStrategy(
  input: FrameStrategyInput
): ResolvedFrameStrategy {
  const caps = input.capabilities || {};
  const rationale: string[] = [];
  const unsupportedRequested: string[] = [];
  const storyUrl = urlOf(input.storyboardFrame);
  const endUrl = urlOf(input.storyboardEndFrame);
  const prevUrl = input.previousGeneratedState?.url;
  const refs = (input.referenceUrls || []).filter(Boolean);

  const canStart = Boolean(caps.supportsStartFrame);
  const canEnd = Boolean(caps.supportsEndFrame || caps.supportsStartAndEndFrame);
  const canStartEnd = Boolean(caps.supportsStartAndEndFrame) || (canStart && canEnd);
  const canContinue = Boolean(
    caps.supportsVideoContinuation || caps.supportsLastFrameContinuation
  );
  const canRef = caps.supportsReferenceImages !== false; // default allow soft refs

  // Continuation takes temporal precedence when required AND supported.
  if (input.preferContinuation && prevUrl) {
    if (canContinue || canStart) {
      const mode: GenerationFrameStrategyMode =
        canContinue && storyUrl && canRef
          ? "REFERENCE_PLUS_CONTINUATION"
          : "CONTINUATION";
      rationale.push(
        "Previous generated LAST state takes temporal precedence for continuity"
      );
      if (storyUrl) {
        rationale.push(
          "Approved storyboard frame retained as narrative/composition reference"
        );
      }
      return {
        mode,
        firstFrameUrl: canStart || canContinue ? prevUrl : undefined,
        continuationSourceUrl: prevUrl,
        referenceUrls:
          mode === "REFERENCE_PLUS_CONTINUATION"
            ? Array.from(new Set([storyUrl!, ...refs].filter(Boolean)))
            : refs,
        storyboardFrameId: input.storyboardFrame?.id,
        previousGeneratedStateId: input.previousGeneratedState?.id,
        rationale,
        unsupportedRequested,
        confidence: canContinue ? 0.9 : 0.75,
      };
    }
    unsupportedRequested.push("CONTINUATION");
    rationale.push("Continuation requested but provider lacks continuation/start-frame support");
  }

  // Explicit first+last when planned end exists and provider supports it.
  if ((input.preferFirstLast || endUrl) && storyUrl && endUrl) {
    if (canStartEnd) {
      rationale.push("Provider supports first+last frame conditioning");
      return {
        mode: "FIRST_LAST_FRAME",
        firstFrameUrl: storyUrl,
        lastFrameUrl: endUrl,
        referenceUrls: refs,
        storyboardFrameId: input.storyboardFrame?.id,
        storyboardEndFrameId: input.storyboardEndFrame?.id,
        rationale,
        unsupportedRequested,
        confidence: 0.92,
      };
    }
    unsupportedRequested.push("FIRST_LAST_FRAME");
    rationale.push("First+last requested but unsupported — falling back");
  }

  // First-frame from storyboard panel frame.
  if (storyUrl && canStart) {
    const mode: GenerationFrameStrategyMode =
      refs.length && canRef ? "REFERENCE_PLUS_FIRST_FRAME" : "FIRST_FRAME";
    rationale.push("Individual storyboard frame used as FIRST_FRAME (not sheet)");
    return {
      mode,
      firstFrameUrl: storyUrl,
      referenceUrls: mode === "REFERENCE_PLUS_FIRST_FRAME" ? refs : [],
      storyboardFrameId: input.storyboardFrame?.id,
      rationale,
      unsupportedRequested,
      confidence: 0.88,
    };
  }

  // Soft reference-only guidance.
  if (storyUrl && canRef) {
    rationale.push("Provider lacks first-frame conditioning — REFERENCE_ONLY");
    return {
      mode: "REFERENCE_ONLY",
      referenceUrls: Array.from(new Set([storyUrl, ...refs])),
      storyboardFrameId: input.storyboardFrame?.id,
      rationale,
      unsupportedRequested,
      confidence: 0.65,
    };
  }

  if (storyUrl && !canStart && !canRef) {
    unsupportedRequested.push("FIRST_FRAME", "REFERENCE_ONLY");
    rationale.push("Storyboard frame available but provider cannot accept image conditioning");
  }

  rationale.push("No frame conditioning — text/motion intent only");
  return {
    mode: "NONE",
    referenceUrls: refs,
    storyboardFrameId: input.storyboardFrame?.id,
    rationale,
    unsupportedRequested,
    confidence: 0.4,
  };
}

/** Map resolved strategy → normalized ProductionVideoRequest frame fields. */
export function frameStrategyToVideoRequestFields(strategy: ResolvedFrameStrategy): {
  firstFrameUrl?: string;
  endFrameUrl?: string;
  referenceImageUrls: string[];
  continuationSourceUrl?: string;
  frameStrategyMode: GenerationFrameStrategyMode;
} {
  return {
    firstFrameUrl: strategy.firstFrameUrl,
    endFrameUrl: strategy.lastFrameUrl,
    referenceImageUrls: strategy.referenceUrls,
    continuationSourceUrl: strategy.continuationSourceUrl,
    frameStrategyMode: strategy.mode,
  };
}

/**
 * Capability requirements implied by a desired strategy mode —
 * for the unified capability router (not a new router).
 */
export function capabilityNeedsForFrameStrategy(
  mode: GenerationFrameStrategyMode
): string[] {
  switch (mode) {
    case "FIRST_FRAME":
      return ["image_to_video", "first_frame_conditioning"];
    case "FIRST_LAST_FRAME":
    case "START_END":
      return ["image_to_video", "first_frame_conditioning", "last_frame_conditioning"];
    case "CONTINUATION":
      return ["image_to_video", "video_continuation"];
    case "REFERENCE_PLUS_CONTINUATION":
      return ["image_to_video", "video_continuation", "multi_reference"];
    case "REFERENCE_PLUS_FIRST_FRAME":
      return ["image_to_video", "first_frame_conditioning", "multi_reference"];
    case "REFERENCE_ONLY":
      return ["image_to_video", "reference_images"];
    case "NONE":
    default:
      return ["text_to_video"];
  }
}
