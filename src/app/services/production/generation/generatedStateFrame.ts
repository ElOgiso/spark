/**
 * Generated State Frame — observed visual state from an actual generated video.
 *
 * StoryboardFrame  = "what we planned to see"
 * GeneratedStateFrame = "what generation actually ended on"
 *
 * Continuation uses GeneratedStateFrame for temporal continuity.
 * Storyboard intent remains authoritative for narrative / composition / identity.
 */

export type GeneratedStateFramePosition = "FIRST" | "LAST" | "MIDDLE" | "TIMECODE";

export const GENERATED_STATE_FRAME_CATEGORY = "frame" as const;

export interface GeneratedStateFrame {
  id: string;
  category: typeof GENERATED_STATE_FRAME_CATEGORY;
  kind: "generated_state_frame";
  productionId: string;
  sourceVideoAssetId: string;
  sourceGenerationTaskId?: string;
  sourceShotId: string;
  position: GeneratedStateFramePosition;
  timestampSec?: number;
  url: string;
  /** Optional link back to the planned storyboard frame this was meant to honor */
  plannedStoryboardFrameId?: string;
  createdAt: string;
  metadata?: Record<string, string>;
}

export interface ContinuityFrameHandoff {
  fromShotId: string;
  toShotId: string;
  /** Observed terminal state — temporal precedence for continuation */
  generatedLastFrame?: GeneratedStateFrame;
  /** Planned storyboard frame for the NEXT shot — narrative/composition authority */
  nextStoryboardFrameId?: string;
  /** When generated state conflicts with approved plan, QC should flag — do not silently redefine story */
  preferGeneratedForTemporalContinuity: true;
  preferStoryboardForNarrativeIntent: true;
}

function hashId(prefix: string, seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `${prefix}_${(h >>> 0).toString(16)}`;
}

/** Persist/register a LAST (or other) state frame extracted from a generated video. */
export function buildGeneratedStateFrame(params: {
  productionId: string;
  sourceVideoAssetId: string;
  sourceShotId: string;
  url: string;
  position?: GeneratedStateFramePosition;
  sourceGenerationTaskId?: string;
  timestampSec?: number;
  plannedStoryboardFrameId?: string;
}): GeneratedStateFrame {
  const position = params.position || "LAST";
  return {
    id: hashId(
      "genframe",
      `${params.productionId}:${params.sourceShotId}:${params.sourceVideoAssetId}:${position}`
    ),
    category: GENERATED_STATE_FRAME_CATEGORY,
    kind: "generated_state_frame",
    productionId: params.productionId,
    sourceVideoAssetId: params.sourceVideoAssetId,
    sourceGenerationTaskId: params.sourceGenerationTaskId,
    sourceShotId: params.sourceShotId,
    position,
    timestampSec: params.timestampSec,
    url: params.url,
    plannedStoryboardFrameId: params.plannedStoryboardFrameId,
    createdAt: new Date().toISOString(),
  };
}

/** Build continuity handoff from Shot A → Shot B without erasing storyboard intent. */
export function buildContinuityFrameHandoff(params: {
  fromShotId: string;
  toShotId: string;
  generatedLastFrame?: GeneratedStateFrame;
  nextStoryboardFrameId?: string;
}): ContinuityFrameHandoff {
  return {
    fromShotId: params.fromShotId,
    toShotId: params.toShotId,
    generatedLastFrame: params.generatedLastFrame,
    nextStoryboardFrameId: params.nextStoryboardFrameId,
    preferGeneratedForTemporalContinuity: true,
    preferStoryboardForNarrativeIntent: true,
  };
}

/**
 * Detect obvious conflict signals between planned storyboard intent and observed state.
 * Full visual QC stays in existing QC evaluators — this is a structured handoff hint.
 */
export function flagGeneratedStateVsPlan(params: {
  generatedLastFrame?: GeneratedStateFrame;
  nextStoryboardFrameId?: string;
  qcFailed?: boolean;
}): { conflict: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (params.qcFailed) {
    reasons.push("Prior shot QC failed — do not let bad generation redefine the story");
  }
  if (params.generatedLastFrame && !params.nextStoryboardFrameId) {
    reasons.push("Continuation available without next storyboard frame — narrative intent may be underspecified");
  }
  return { conflict: reasons.length > 0, reasons };
}
