/**
 * Track factories — arbitrary lanes; not UI-hardcoded.
 */

import type { EditorialTrack, TrackKind } from "./types";

const KIND_PREFIX: Record<TrackKind, string> = {
  video: "V",
  dialogue: "D",
  narration: "N",
  ambience: "A",
  music: "M",
  sfx: "SFX",
  text: "T",
  vfx: "FX",
};

export function createTrack(kind: TrackKind, lane = 0, name?: string): EditorialTrack {
  const prefix = KIND_PREFIX[kind];
  const id = `track_${kind}_${lane}`;
  return {
    id,
    kind,
    lane,
    name: name || `${prefix}${lane + 1}`,
    clips: [],
  };
}

export function ensureTrack(
  tracks: EditorialTrack[],
  kind: TrackKind,
  lane = 0,
  name?: string
): EditorialTrack {
  let t = tracks.find((x) => x.kind === kind && x.lane === lane);
  if (!t) {
    t = createTrack(kind, lane, name);
    tracks.push(t);
  }
  return t;
}

export function defaultAssemblyTracks(): EditorialTrack[] {
  return [
    createTrack("video", 0, "V1"),
    createTrack("dialogue", 0, "D1"),
    createTrack("narration", 0, "N1"),
    createTrack("ambience", 0, "A1"),
    createTrack("music", 0, "M1"),
    createTrack("sfx", 0, "SFX1"),
    createTrack("text", 0, "Titles"),
    createTrack("vfx", 0, "FX1"),
  ];
}
