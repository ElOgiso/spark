/**
 * Legacy-compatible timeline helpers — wraps Phase 6 canonical model.
 * Existing imports of buildEditorialTimeline / planTransitions keep working.
 */

import type { ProductionSpec } from "../specification/productionSpec";
import type { EditorialTimeline as CanonicalTimeline } from "./types";
import { assembleEditorialTimeline } from "./assembly";
import { framesToSec } from "./timebase";

export type { TimelineTrackKind } from "./types";

/** Legacy clip shape */
export interface TimelineClip {
  id: string;
  trackId: string;
  shotId?: string;
  sceneId?: string;
  startSec: number;
  endSec: number;
  sourceUrl?: string;
  label: string;
  transitionIn?: string;
  transitionOut?: string;
}

export interface TimelineTrack {
  id: string;
  kind: import("./types").TimelineTrackKind;
  name: string;
  clips: TimelineClip[];
}

/** Legacy EditorialTimeline — seconds-based view over the canonical model */
export interface EditorialTimeline {
  productionId: string;
  durationSec: number;
  tracks: TimelineTrack[];
  masterNotes: string;
  /** Phase 6 canonical timeline when available */
  canonical?: CanonicalTimeline;
}

const KIND_MAP: Record<string, import("./types").TimelineTrackKind> = {
  video: "video_primary",
  dialogue: "audio_dialogue",
  narration: "audio_narration",
  ambience: "audio_ambience",
  music: "audio_music",
  sfx: "audio_sfx",
  text: "gfx_captions",
  vfx: "gfx_vfx",
};

/**
 * Build a planned editorial timeline from ProductionSpec (no assets required).
 * Preserves prior API; uses Phase 6 assembler under the hood.
 */
export function buildEditorialTimeline(spec: ProductionSpec): EditorialTimeline {
  const canonical = assembleEditorialTimeline(spec, {
    allowPlannedWithoutAssets: true,
    policy: { allowProvisional: true, allowManualException: true },
  });
  return toLegacyTimeline(canonical);
}

export function toLegacyTimeline(canonical: CanonicalTimeline): EditorialTimeline {
  const tracks: TimelineTrack[] = canonical.tracks.map((t) => ({
    id: t.id,
    kind: KIND_MAP[t.kind] || "video_primary",
    name: t.name,
    clips: t.clips.map((c) => ({
      id: c.id,
      trackId: c.trackId,
      shotId: c.shotId,
      sceneId: c.sceneId,
      startSec: framesToSec(c.timelineStartFrames, canonical.frameRate),
      endSec: framesToSec(c.timelineEndFrames, canonical.frameRate),
      sourceUrl: c.sourceUrl,
      label: c.label,
      transitionIn: c.transitionIn,
      transitionOut: c.transitionOut,
    })),
  }));

  return {
    productionId: canonical.productionId,
    durationSec: framesToSec(canonical.durationFrames, canonical.frameRate),
    tracks,
    masterNotes:
      "Server-side FFmpeg/mux remains authoritative mastering path; client MediaRecorder is preview/fallback only.",
    canonical,
  };
}

export function planTransitions(
  timeline: EditorialTimeline
): Array<{ atSec: number; type: string; fromClipId: string; toClipId: string }> {
  if (timeline.canonical?.transitions.length) {
    return timeline.canonical.transitions
      .filter((t) => t.fromClipId && t.toClipId)
      .map((t) => ({
        atSec: framesToSec(t.atFrames, timeline.canonical!.frameRate),
        type: t.type,
        fromClipId: t.fromClipId!,
        toClipId: t.toClipId!,
      }));
  }
  const primary = timeline.tracks.find((t) => t.kind === "video_primary");
  if (!primary) return [];
  const out: Array<{ atSec: number; type: string; fromClipId: string; toClipId: string }> = [];
  for (let i = 0; i < primary.clips.length - 1; i++) {
    const a = primary.clips[i];
    const b = primary.clips[i + 1];
    out.push({
      atSec: a.endSec,
      type: a.transitionOut || "cut",
      fromClipId: a.id,
      toClipId: b.id,
    });
  }
  return out;
}
