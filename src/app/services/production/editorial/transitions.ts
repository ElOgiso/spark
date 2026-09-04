/**
 * Provider-neutral transition model — timeline-level, not baked into assets.
 */

import type { EditorialClip, EditorialTransition, TransitionType } from "./types";

export const SUPPORTED_TRANSITIONS: readonly TransitionType[] = [
  "cut",
  "dissolve",
  "fade_in",
  "fade_out",
];

export function normalizeTransition(value: string | undefined): TransitionType {
  const v = (value || "cut").toLowerCase().replace(/\s+/g, "_");
  if (v === "fade" || v === "fadein") return "fade_in";
  if (v === "fadeout") return "fade_out";
  if (v === "crossfade" || v === "cross_dissolve") return "dissolve";
  if (SUPPORTED_TRANSITIONS.includes(v)) return v;
  return v; // allow future types without redesign
}

export function defaultTransitionDurationFrames(type: TransitionType, frameRate: number): number {
  switch (type) {
    case "cut":
      return 0;
    case "dissolve":
      return Math.round(frameRate * 0.4);
    case "fade_in":
    case "fade_out":
      return Math.round(frameRate * 0.5);
    default:
      return Math.round(frameRate * 0.35);
  }
}

export function buildTransitionsFromClips(
  videoClips: EditorialClip[],
  frameRate: number
): EditorialTransition[] {
  const out: EditorialTransition[] = [];
  for (let i = 0; i < videoClips.length; i++) {
    const clip = videoClips[i];
    const next = videoClips[i + 1];
    const outType = normalizeTransition(clip.transitionOut);
    if (outType !== "cut" && next) {
      out.push({
        id: `tr_${clip.id}_${next.id}`,
        type: outType,
        durationFrames: defaultTransitionDurationFrames(outType, frameRate),
        fromClipId: clip.id,
        toClipId: next.id,
        atFrames: clip.timelineEndFrames,
      });
    }
    if (i === 0) {
      const inType = normalizeTransition(clip.transitionIn);
      if (inType === "fade_in") {
        out.push({
          id: `tr_in_${clip.id}`,
          type: "fade_in",
          durationFrames: defaultTransitionDurationFrames("fade_in", frameRate),
          toClipId: clip.id,
          atFrames: clip.timelineStartFrames,
        });
      }
    }
  }
  return out;
}
