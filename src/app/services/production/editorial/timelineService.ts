/**
 * Professional editorial timeline model.
 * Server-side render is authoritative; client Canvas/MediaRecorder remains preview/fallback
 * via existing sceneVideoMerger / narratorVideoCompiler.
 */

import type { ProductionSpec } from "../specification/productionSpec";

export type TimelineTrackKind =
  | "video_primary"
  | "video_broll"
  | "video_overlay"
  | "audio_dialogue"
  | "audio_narration"
  | "audio_ambience"
  | "audio_music"
  | "audio_sfx"
  | "gfx_captions"
  | "gfx_titles"
  | "gfx_lower_thirds"
  | "gfx_vfx";

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
  kind: TimelineTrackKind;
  name: string;
  clips: TimelineClip[];
}

export interface EditorialTimeline {
  productionId: string;
  durationSec: number;
  tracks: TimelineTrack[];
  masterNotes: string;
}

export function buildEditorialTimeline(spec: ProductionSpec): EditorialTimeline {
  const video: TimelineTrack = {
    id: "track_video_primary",
    kind: "video_primary",
    name: "Primary Video",
    clips: [],
  };
  const narration: TimelineTrack = {
    id: "track_narration",
    kind: "audio_narration",
    name: "Narration",
    clips: [],
  };
  const music: TimelineTrack = {
    id: "track_music",
    kind: "audio_music",
    name: "Music",
    clips: [],
  };
  const captions: TimelineTrack = {
    id: "track_captions",
    kind: "gfx_captions",
    name: "Captions",
    clips: [],
  };

  let cursor = 0;
  for (const scene of spec.scenes) {
    for (const shot of scene.shots) {
      const start = cursor;
      const end = cursor + shot.durationSec;
      video.clips.push({
        id: `clip_${shot.id}`,
        trackId: video.id,
        shotId: shot.id,
        sceneId: scene.id,
        startSec: start,
        endSec: end,
        sourceUrl: shot.mediaUrl,
        label: shot.purpose,
        transitionIn: shot.transitionIn || "cut",
        transitionOut: shot.transitionOut || "cut",
      });
      if (shot.narration) {
        narration.clips.push({
          id: `narr_${shot.id}`,
          trackId: narration.id,
          shotId: shot.id,
          sceneId: scene.id,
          startSec: start,
          endSec: end,
          label: shot.narration.slice(0, 80),
        });
      }
      if (scene.onScreenText) {
        captions.clips.push({
          id: `cap_${shot.id}`,
          trackId: captions.id,
          shotId: shot.id,
          startSec: start,
          endSec: Math.min(end, start + Math.min(3, shot.durationSec)),
          label: scene.onScreenText,
        });
      }
      cursor = end;
    }
  }

  if (spec.audio.hasMusic) {
    music.clips.push({
      id: "music_bed_full",
      trackId: music.id,
      startSec: 0,
      endSec: cursor,
      label: spec.audio.musicMood || "Score bed",
    });
  }

  return {
    productionId: spec.project.id,
    durationSec: cursor || spec.project.targetDurationSec,
    tracks: [video, narration, music, captions].filter((t) => t.clips.length > 0 || t.kind === "video_primary"),
    masterNotes:
      "Server-side FFmpeg/mux remains authoritative mastering path; client MediaRecorder is preview/fallback only.",
  };
}

export function planTransitions(timeline: EditorialTimeline): Array<{ atSec: number; type: string; fromClipId: string; toClipId: string }> {
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
