/**
 * Canonical captions / subtitles — generation separate from rendering.
 */

import type { ProductionSpec } from "../specification/productionSpec";
import type { CaptionCue, CaptionRenderMode } from "./types";
import { secToFrames } from "./timebase";

export function buildCaptionsFromSpec(params: {
  spec: ProductionSpec;
  frameRate: number;
  shotPlacements: Array<{
    shotId: string;
    sceneId: string;
    startFrames: number;
    endFrames: number;
    dialogue?: string;
    narration?: string;
    onScreenText?: string;
  }>;
  language?: string;
  renderMode?: CaptionRenderMode;
}): CaptionCue[] {
  const language = params.language || "en";
  const renderMode = params.renderMode || "sidecar";
  const cues: CaptionCue[] = [];

  for (const p of params.shotPlacements) {
    if (p.dialogue?.trim()) {
      cues.push({
        id: `cap_dlg_${p.shotId}`,
        text: p.dialogue.trim(),
        startFrames: p.startFrames,
        endFrames: p.endFrames,
        language,
        speaker: "dialogue",
        renderMode,
        provenance: { sceneId: p.sceneId, shotId: p.shotId, source: "shot.dialogue" },
      });
    }
    if (p.narration?.trim()) {
      cues.push({
        id: `cap_nar_${p.shotId}`,
        text: p.narration.trim(),
        startFrames: p.startFrames,
        endFrames: p.endFrames,
        language,
        speaker: "narrator",
        renderMode,
        provenance: { sceneId: p.sceneId, shotId: p.shotId, source: "shot.narration" },
      });
    }
    if (p.onScreenText?.trim()) {
      const end = Math.min(
        p.endFrames,
        p.startFrames + secToFrames(3, params.frameRate)
      );
      cues.push({
        id: `cap_ost_${p.shotId}`,
        text: p.onScreenText.trim(),
        startFrames: p.startFrames,
        endFrames: Math.max(p.startFrames + 1, end),
        language,
        style: { role: "on_screen_text" },
        renderMode: renderMode === "none" ? "burn_in" : renderMode,
        provenance: { sceneId: p.sceneId, shotId: p.shotId, source: "scene.onScreenText" },
      });
    }
  }

  return cues;
}

/** Sidecar SRT-like representation (frames→timestamps at export time) */
export function captionsToSrtPreview(
  cues: CaptionCue[],
  frameRate: number
): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const ts = (frames: number) => {
    const totalMs = Math.round((frames / frameRate) * 1000);
    const h = Math.floor(totalMs / 3600000);
    const m = Math.floor((totalMs % 3600000) / 60000);
    const s = Math.floor((totalMs % 60000) / 1000);
    const ms = totalMs % 1000;
    return `${pad(h)}:${pad(m)}:${pad(s)},${String(ms).padStart(3, "0")}`;
  };
  return cues
    .map(
      (c, i) =>
        `${i + 1}\n${ts(c.startFrames)} --> ${ts(c.endFrames)}\n${c.text}\n`
    )
    .join("\n");
}
