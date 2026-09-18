import type { NarrativeScript, ProductionScene } from "../../../domain/types";
import { resolveChapterAudio } from "./chapterAudio";

export { resolveChapterAudio } from "./chapterAudio";

/**
 * Builds canonical ProductionScene list from writer narrative chapters.
 * 
 * Rules:
 * 1. If narrativeScript.chapters is empty or missing, FAIL LOUD: "No writer chapters. SPARK will not invent clips."
 * 2. Each chapter requires a positive durationSec (no || 5 fallback).
 * 3. Spoken lines on scene i = that chapter's spoken text ONLY. Never fullSpokenScript.
 * 4. Audio routing follows mode gates: narrator/express -> vo, cinematic/deep -> talent.
 */
export function buildScenesFromNarrativeChapters(
  script: NarrativeScript | any,
  mode: string = "standard"
): ProductionScene[] {
  if (!script || !Array.isArray(script.chapters) || script.chapters.length === 0) {
    throw new Error("No writer chapters. SPARK will not invent clips.");
  }

  const normMode = (mode || "standard").toLowerCase();

  const scenes: ProductionScene[] = script.chapters.map((c: any, i: number) => {
    if (typeof c.durationSec !== "number" || c.durationSec <= 0 || isNaN(c.durationSec)) {
      throw new Error(`Chapter ${i + 1} missing required durationSec.`);
    }

    const resolvedAudio = resolveChapterAudio({ mode, chapter: c });

    return {
      scene: i + 1,
      index: i,
      durationSec: c.durationSec,
      duration: `${c.durationSec}s`,
      spokenLines: c.spoken || "",
      scriptSnippet: c.spoken || "",
      visualDescription: c.visualIntent || `Chapter ${i + 1}`,
      shotList: c.visualIntent || `Chapter ${i + 1}`,
      valueJob: c.job || "context",
      audio: resolvedAudio,
      cameraDirection: normMode === "deep" || normMode === "cinematic" ? "Tracking shot" : "Medium shot",
      transitions: "cut",
      onScreenText: `CHAPTER ${i + 1}`,
      pacing: "deliberate",
    };
  });

  const sumDuration = scenes.reduce((acc, s) => acc + (s.durationSec || 0), 0);
  if (script.targetDurationSec && Math.abs(sumDuration - script.targetDurationSec) > 5) {
    console.warn(
      `[SPARK Pipeline] Warning: Sum of chapter durations (${sumDuration}s) diverges from script.targetDurationSec (${script.targetDurationSec}s). Using chapter durations, no rescaling to 60.`
    );
  }

  return scenes;
}

/**
 * Calculates subclip durations for a chapter based on engine maxNativeSec.
 * 
 * Rules:
 * - If chapterDurationSec <= maxNativeSec: 1 clip of chapterDurationSec
 * - If chapterDurationSec > maxNativeSec: split into N subclips adding up to chapterDurationSec.
 * - Allowed durations (e.g. Veo [4, 6, 8]) are respected when provided.
 */
function snapDuration(val: number, allowed?: number[]): number {
  if (!allowed || allowed.length === 0 || allowed.includes(val)) return val;
  let closest = allowed[0];
  let minDiff = Math.abs(val - closest);
  for (let i = 1; i < allowed.length; i++) {
    const diff = Math.abs(val - allowed[i]);
    if (diff < minDiff) {
      minDiff = diff;
      closest = allowed[i];
    }
  }
  return closest;
}

/**
 * Calculates subclip durations for a chapter based on engine maxNativeSec.
 * 
 * Rules:
 * - If chapterDurationSec <= maxNativeSec: 1 clip of chapterDurationSec (clamped to official allowed values, e.g. Veo 4|6|8)
 * - If chapterDurationSec > maxNativeSec: split into N subclips adding up to chapterDurationSec.
 * - Allowed durations (e.g. Veo [4, 6, 8]) are respected when provided.
 */
export function calculateSubclipDurations(
  chapterDurationSec: number,
  maxNativeSec: number,
  allowedDurationsSec?: number[]
): number[] {
  if (chapterDurationSec <= maxNativeSec) {
    return [snapDuration(chapterDurationSec, allowedDurationsSec)];
  }

  const subclips: number[] = [];
  let remaining = chapterDurationSec;

  while (remaining > 0) {
    if (remaining <= maxNativeSec) {
      subclips.push(remaining);
      remaining = 0;
    } else {
      const chunk = maxNativeSec;
      subclips.push(chunk);
      remaining -= chunk;
    }
  }

  // If allowedDurationsSec is provided, ensure subclips conform to allowed values
  if (allowedDurationsSec && allowedDurationsSec.length > 0) {
    const minAllowed = Math.min(...allowedDurationsSec);
    for (let i = 0; i < subclips.length; i++) {
      if (!allowedDurationsSec.includes(subclips[i])) {
        // If subclip is less than minAllowed, borrow from previous
        if (subclips[i] < minAllowed && i > 0) {
          const deficit = minAllowed - subclips[i];
          subclips[i - 1] -= deficit;
          subclips[i] += deficit;
        }
      }
    }
  }

  return subclips;
}
export const chapterToClip = buildScenesFromNarrativeChapters;

export function formatChapterClipLog(params: {
  chapterIndex: number;
  chapterDur: number;
  maxNativeSec: number;
  subclipCount: number;
  spokenChars: number;
  fullScriptLength?: number;
}): string {
  const { chapterIndex, chapterDur, maxNativeSec, subclipCount, spokenChars, fullScriptLength } = params;
  const fullPart = typeof fullScriptLength === "number" ? `, fullScriptLength=${fullScriptLength}` : "";
  return `[SPARK Pipeline] Chapter ${chapterIndex}: chapterDur=${chapterDur}s, maxNativeSec=${maxNativeSec}s, subclipCount=${subclipCount}, spokenChars=${spokenChars}${fullPart}`;
}

export { resolveMaxNativeClipSec, resolveAllowedDurationsSec } from "../../runtime/providerCapabilities";
