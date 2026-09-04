/**
 * Deterministic audio mix instructions — authoritative representation, not a DSP engine.
 */

import type { EditorialTimeline, AudioMixInstruction, EditorialTrack } from "./types";
import { secToFrames } from "./timebase";

export function buildAudioMixInstructions(params: {
  timeline: Pick<EditorialTimeline, "tracks" | "durationFrames" | "frameRate">;
  hasMusic: boolean;
  duckNarrationUnderDb?: number;
  musicBedGainDb?: number;
}): AudioMixInstruction[] {
  const { timeline, hasMusic } = params;
  const duckDb = params.duckNarrationUnderDb ?? -8;
  const musicGain = params.musicBedGainDb ?? -9;
  const instructions: AudioMixInstruction[] = [];

  const music = timeline.tracks.find((t) => t.kind === "music");
  const dialogue = timeline.tracks.find((t) => t.kind === "dialogue");
  const narration = timeline.tracks.find((t) => t.kind === "narration");
  const ambience = timeline.tracks.find((t) => t.kind === "ambience");

  if (music && hasMusic) {
    instructions.push({
      id: "mix_music_gain",
      kind: "gain",
      targetTrackId: music.id,
      startFrames: 0,
      endFrames: timeline.durationFrames,
      gainDb: musicGain,
      priority: 10,
    });
    instructions.push({
      id: "mix_music_fade_in",
      kind: "fade_in",
      targetTrackId: music.id,
      startFrames: 0,
      endFrames: secToFrames(1.2, timeline.frameRate),
      gainDb: musicGain,
      priority: 20,
    });
    instructions.push({
      id: "mix_music_fade_out",
      kind: "fade_out",
      targetTrackId: music.id,
      startFrames: Math.max(0, timeline.durationFrames - secToFrames(1.5, timeline.frameRate)),
      endFrames: timeline.durationFrames,
      gainDb: musicGain,
      priority: 20,
    });
  }

  // Dialogue-over-music ducking
  if (music && dialogue && dialogue.clips.length) {
    for (const clip of dialogue.clips) {
      instructions.push({
        id: `duck_dlg_${clip.id}`,
        kind: "duck",
        targetTrackId: music.id,
        triggerTrackId: dialogue.id,
        startFrames: clip.timelineStartFrames,
        endFrames: clip.timelineEndFrames,
        gainDb: musicGain,
        duckDb,
        priority: 50,
      });
    }
  }

  // Narration priority over music
  if (music && narration && narration.clips.length) {
    for (const clip of narration.clips) {
      instructions.push({
        id: `duck_nar_${clip.id}`,
        kind: "duck",
        targetTrackId: music.id,
        triggerTrackId: narration.id,
        startFrames: clip.timelineStartFrames,
        endFrames: clip.timelineEndFrames,
        gainDb: musicGain,
        duckDb: duckDb - 2,
        priority: 60,
      });
    }
  }

  if (ambience && ambience.clips.length) {
    instructions.push({
      id: "mix_ambience_gain",
      kind: "gain",
      targetTrackId: ambience.id,
      startFrames: 0,
      endFrames: timeline.durationFrames,
      gainDb: -14,
      priority: 5,
    });
  }

  return instructions;
}

export function trackHasAudio(tracks: EditorialTrack[], kind: EditorialTrack["kind"]): boolean {
  return tracks.some((t) => t.kind === kind && t.clips.length > 0);
}
