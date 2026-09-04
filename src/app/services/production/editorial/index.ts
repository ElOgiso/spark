export { buildEditorialTimeline, planTransitions } from "./timelineService";
export type { EditorialTimeline, TimelineTrack, TimelineClip, TimelineTrackKind } from "./timelineService";

/** Placeholder mix notes — real DSP stays in existing compilers until server master lands */
export function buildAudioMixPlan(timeline: { durationSec: number }): { duckNarrationUnderDb: number; musicBedGain: number; durationSec: number } {
  return { duckNarrationUnderDb: -8, musicBedGain: 0.35, durationSec: timeline.durationSec };
}

export function describeMasterRenderStrategy(): string {
  return "Prefer /api/runtime/video mux provider for authoritative master; fall back to sceneVideoMerger canvas path for preview.";
}
