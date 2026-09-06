/**
 * Canonical duration policy — reconciles format settings + credit settings
 * into one planning interpretation. Not a second duration system.
 *
 * TOTAL production length  → formatSettings.targetDurationSec
 * Preferred clip length   → creditSettings.shortsDurationSec | cinematicDurationSec
 * Max clips / panel budget → creditSettings.maxVideoClips | keyframeCount
 *
 * keyframeCount = visual panel / clip budget (existing product meaning)
 * It is NOT silently reused as duration.
 */

import type {
  GenerationCreditSettings,
  ProductionFormatSettings,
} from "../../domain/types";
import {
  DEFAULT_CREDIT_SETTINGS,
  DEFAULT_FORMAT_SETTINGS,
} from "../../domain/types";

export type ProductionDurationMode = "shorts" | "cinematic" | "standard";

export interface ResolvedDurationPolicy {
  /** Total desired production runtime (seconds) */
  totalTargetDurationSec: number;
  /** Preferred individual clip duration before provider snap */
  preferredClipDurationSec: number;
  /** Hard ceiling for a single generation clip (user + mode) */
  maxClipDurationSec: number;
  /** Maximum number of video clips / scenes the planner may emit */
  maxClips: number;
  /** Maximum storyboard/visual panels (same budget field when synced) */
  maxPanels: number;
  mode: ProductionDurationMode;
  source: {
    totalFrom: "formatSettings.targetDurationSec" | "default";
    clipFrom: "shortsDurationSec" | "cinematicDurationSec" | "provider_native" | "default";
    clipCapFrom: "maxVideoClips" | "keyframeCount" | "unlimited";
  };
  rationale: string[];
}

function detectMode(params: {
  mode?: string;
  contentFormat?: string;
  totalTargetDurationSec: number;
}): ProductionDurationMode {
  const raw = String(params.mode || "").toLowerCase();
  if (raw === "deep" || raw === "cinematic") return "cinematic";
  if (raw === "express" || raw === "shorts" || raw === "narrator") return "shorts";
  const fmt = String(params.contentFormat || "").toLowerCase();
  if (fmt === "faceless" && params.totalTargetDurationSec <= 60) return "shorts";
  if (params.totalTargetDurationSec <= 60) return "shorts";
  if (params.totalTargetDurationSec >= 180) return "cinematic";
  return "standard";
}

/**
 * Resolve one canonical duration policy for planning + generation.
 */
export function resolveDurationPolicy(params: {
  formatSettings?: Partial<ProductionFormatSettings> | null;
  creditSettings?: Partial<GenerationCreditSettings> | null;
  productionMode?: string;
  contentFormat?: string;
  /** Provider native max single-clip duration */
  providerMaxClipSec?: number;
}): ResolvedDurationPolicy {
  const format = {
    ...DEFAULT_FORMAT_SETTINGS,
    ...(params.formatSettings || {}),
  };
  const credit = {
    ...DEFAULT_CREDIT_SETTINGS,
    ...(params.creditSettings || {}),
  };

  const totalTargetDurationSec =
    typeof format.targetDurationSec === "number" && format.targetDurationSec > 0
      ? format.targetDurationSec
      : DEFAULT_FORMAT_SETTINGS.targetDurationSec;

  const mode = detectMode({
    mode: params.productionMode,
    contentFormat: params.contentFormat || format.contentFormat,
    totalTargetDurationSec,
  });

  const providerMax = Math.max(1, params.providerMaxClipSec || 8);
  const rationale: string[] = [];

  let preferredClipDurationSec: number;
  let clipFrom: ResolvedDurationPolicy["source"]["clipFrom"];

  if (mode === "shorts" && typeof credit.shortsDurationSec === "number" && credit.shortsDurationSec > 0) {
    preferredClipDurationSec = credit.shortsDurationSec;
    clipFrom = "shortsDurationSec";
    rationale.push(`Shorts clip preference ${credit.shortsDurationSec}s from credit settings`);
  } else if (mode === "cinematic" && typeof credit.cinematicDurationSec === "number" && credit.cinematicDurationSec > 0) {
    preferredClipDurationSec = credit.cinematicDurationSec;
    clipFrom = "cinematicDurationSec";
    rationale.push(`Cinematic clip preference ${credit.cinematicDurationSec}s from credit settings`);
  } else if (mode === "standard" && typeof credit.shortsDurationSec === "number") {
    preferredClipDurationSec = credit.shortsDurationSec;
    clipFrom = "shortsDurationSec";
    rationale.push(`Standard mode uses shorts clip preference ${credit.shortsDurationSec}s`);
  } else {
    preferredClipDurationSec = Math.min(providerMax, 8);
    clipFrom = "default";
    rationale.push(`Default preferred clip ${preferredClipDurationSec}s`);
  }

  // User clip preference cannot exceed provider native max; decompose instead of truncate story.
  const maxClipDurationSec = Math.min(preferredClipDurationSec, providerMax);
  if (preferredClipDurationSec > providerMax) {
    rationale.push(
      `Preferred clip ${preferredClipDurationSec}s exceeds provider max ${providerMax}s — decompose into provider-legal clips`
    );
  }

  let maxClips: number;
  let clipCapFrom: ResolvedDurationPolicy["source"]["clipCapFrom"];
  if (typeof credit.maxVideoClips === "number" && credit.maxVideoClips > 0) {
    maxClips = Math.floor(credit.maxVideoClips);
    clipCapFrom = "maxVideoClips";
  } else if (typeof credit.keyframeCount === "number" && credit.keyframeCount > 0) {
    maxClips = Math.floor(credit.keyframeCount);
    clipCapFrom = "keyframeCount";
  } else {
    maxClips = Math.max(1, Math.ceil(totalTargetDurationSec / Math.max(1, maxClipDurationSec)));
    clipCapFrom = "unlimited";
  }

  const maxPanels =
    typeof credit.keyframeCount === "number" && credit.keyframeCount > 0
      ? Math.floor(credit.keyframeCount)
      : maxClips;

  rationale.push(`Total target ${totalTargetDurationSec}s from format settings`);
  rationale.push(`Clip budget maxClips=${maxClips} (${clipCapFrom})`);

  return {
    totalTargetDurationSec,
    preferredClipDurationSec,
    maxClipDurationSec,
    maxClips,
    maxPanels,
    mode,
    source: {
      totalFrom: typeof format.targetDurationSec === "number" ? "formatSettings.targetDurationSec" : "default",
      clipFrom,
      clipCapFrom,
    },
    rationale,
  };
}

/**
 * Allocate clip durations that sum toward the total target without
 * silently truncating cinematic intent when provider limits force splits.
 */
export function allocateClipDurations(policy: ResolvedDurationPolicy): number[] {
  const clipLen = Math.max(1, policy.maxClipDurationSec);
  const needed = Math.ceil(policy.totalTargetDurationSec / clipLen);
  const count = Math.max(1, Math.min(policy.maxClips, needed));
  const clips: number[] = [];
  let remaining = policy.totalTargetDurationSec;
  for (let i = 0; i < count; i++) {
    const left = count - i;
    if (left === 1) {
      clips.push(Math.max(1, Math.min(clipLen, remaining)));
    } else {
      const take = Math.min(clipLen, Math.max(1, Math.ceil(remaining / left)));
      clips.push(take);
      remaining -= take;
    }
  }
  return clips;
}
