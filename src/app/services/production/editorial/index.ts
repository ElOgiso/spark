/**
 * Editorial timeline, assembly & mastering — Phase 6.
 */

export type {
  EditorialTimeline as CanonicalEditorialTimeline,
  EditorialScene,
  EditorialClip,
  EditorialTrack,
  EditorialStatus,
  EditorialClipStatus,
  TrackKind,
  TransitionType,
  CaptionCue,
  CaptionRenderMode,
  AudioMixInstruction,
  DeliveryVariant,
  CropReframe,
  UnresolvedDependency,
  EditorialTransition,
  EditorialProvenance,
  ColorMasteringConfig,
  TimelineTrackKind,
} from "./types";

export { DEFAULT_FRAME_RATE, secToFrames, framesToSec, parseDurationToSec } from "./timebase";
export { createTrack, ensureTrack, defaultAssemblyTracks } from "./tracks";
export {
  SUPPORTED_TRANSITIONS,
  normalizeTransition,
  buildTransitionsFromClips,
  defaultTransitionDurationFrames,
} from "./transitions";
export {
  evaluateShotEligibility,
  selectAssetForShot,
  DEFAULT_ENTRY_POLICY,
  type ShotEligibility,
  type EditorialEntryPolicy,
} from "./eligibility";
export { assembleEditorialTimeline, type AssembleEditorialOptions } from "./assembly";
export {
  validateEditorialTimeline,
  type EditorialValidationResult,
  type EditorialValidationIssue,
  type EditorialValidationStatus,
} from "./validation";
export {
  decideEditorialAction,
  type EditorialDecision,
  type EditorialDecisionAction,
} from "./decisionEngine";
export { buildAudioMixInstructions } from "./audioMix";
export { buildCaptionsFromSpec, captionsToSrtPreview } from "./captions";
export { createDefaultVariants, resolveAspectDimensions } from "./variants";
export { planReframe } from "./reframe";
export { userFacingEditorialStatus, userFacingMasteringMessage } from "./userMessages";
export {
  runEditorialPipeline,
  pickVariant,
  type RunEditorialPipelineOptions,
  type EditorialPipelineResult,
} from "./pipeline";

// Legacy compatibility
export {
  buildEditorialTimeline,
  planTransitions,
  toLegacyTimeline,
  type EditorialTimeline,
  type TimelineTrack,
  type TimelineClip,
} from "./timelineService";

export function buildAudioMixPlan(timeline: { durationSec: number }): {
  duckNarrationUnderDb: number;
  musicBedGain: number;
  durationSec: number;
} {
  return { duckNarrationUnderDb: -8, musicBedGain: 0.35, durationSec: timeline.durationSec };
}

export function describeMasterRenderStrategy(): string {
  return "Prefer /api/runtime/video mux provider for authoritative master; fall back to sceneVideoMerger canvas path for preview.";
}

// Mastering
export type {
  MasteringJob,
  MasteringJobStatus,
  MasteringResult,
  MasterOutput,
  MasteringService,
  MasteringRuntimeAdapter,
  MasteringCreateInput,
} from "./mastering/types";
export {
  canTransitionMastering,
  transitionMastering,
  isTerminalMastering,
} from "./mastering/jobStateMachine";
export {
  createMasteringService,
  masteringIdempotencyKey,
  cancelMasteringJob,
  type MasteringServiceOptions,
} from "./mastering/masteringService";
export {
  createFfmpegAdapter,
  createMockMasteringAdapter,
  buildFfmpegRenderPlan,
  type FfmpegRenderPlan,
  type FfmpegExecutor,
} from "./mastering/ffmpegAdapter";
export { validateMasterOutput, type FinalMasterQcResult } from "./mastering/finalQc";
