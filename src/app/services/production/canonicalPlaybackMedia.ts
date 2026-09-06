/**
 * Canonical Review ↔ Production Assets media lineage.
 *
 * Forensic finding: One AssetService generate could persist BOTH cinematic scene
 * clips AND an emergency narrator slideshow (`master-fallback`). Review previously
 * preferred production/review/brief.videoUrl (often fallback); Production Assets
 * preferred storyboard/generatedVideos (clips). That is divergent persistence +
 * divergent resolvers — not a second Review generator.
 *
 * This module is the single read-side spine. Writers remain ProductionAssetService.
 */

import {
  isDurableMasterVideoReady,
  isPlayableVideoUrl,
  isEmergencySlideshowFallbackUrl,
} from "./productionAssetService";
import { normalizeModeString, getNotionModeLabel } from "./resolveProductionMode";

export { isEmergencySlideshowFallbackUrl } from "./productionAssetService";

export type CanonicalMediaKind =
  | "merged_master"
  | "scene_clips"
  | "express_master"
  | "emergency_fallback"
  | "still_only"
  | "missing";

export interface CanonicalProductionMedia {
  productionId: string | null;
  requestedMode: string | null;
  resolvedMode: "express" | "standard" | "deep" | null;
  modeLabel: string | null;
  kind: CanonicalMediaKind;
  /** Hero / master URL for Review player (undefined → shot mode or stills). */
  masterVideoUrl: string | undefined;
  /** Durable cinematic/standard scene clips (never emergency fallback URLs). */
  sceneClipUrls: string[];
  /** Per-scene binding matching Production Assets. */
  scenes: Array<{
    scene: number;
    description: string;
    duration: string;
    image?: string;
    videoUrl?: string;
  }>;
  audioUrl: string | undefined;
  /** True when persisted hero is emergency slideshow but mode is deep/standard. */
  modeMismatch: boolean;
  modeMismatchMessage: string | null;
  /** Quarantined emergency URL — diagnostic only; never Review hero for deep. */
  emergencyFallbackUrl: string | undefined;
  stillImageUrl: string | undefined;
  availabilityMessage: string | null;
  lineageSource: string;
}

function pushDurableClip(out: string[], url?: string | null) {
  if (!url || !isDurableMasterVideoReady(url)) return;
  if (isEmergencySlideshowFallbackUrl(url)) return;
  if (!out.includes(url)) out.push(url);
}

function resolveRequestedMode(input: {
  production?: any;
  brief?: any;
}): {
  raw: string | null;
  resolved: "express" | "standard" | "deep" | null;
  label: string | null;
} {
  const production = input.production || {};
  const brief = input.brief || production.brief || {};
  const raw =
    production.productionMode ||
    production.mode ||
    brief.productionMode ||
    brief.mode ||
    null;
  const resolved = (normalizeModeString(raw) as "express" | "standard" | "deep" | null) || null;
  return {
    raw: raw ? String(raw) : null,
    resolved,
    label: raw ? getNotionModeLabel(raw) : null,
  };
}

/**
 * Collect durable scene clips from the same sources Production Assets uses.
 */
export function collectDurableSceneClipUrls(input: {
  production?: any;
  brief?: any;
}): string[] {
  const production = input.production || {};
  const brief = input.brief || production.brief || {};
  const clips: string[] = [];

  const storyboard: any[] = Array.isArray(brief.storyboard) ? brief.storyboard : [];
  const productionScenes: any[] = Array.isArray(production.productionScenes)
    ? production.productionScenes
    : Array.isArray(production.scenes)
      ? production.scenes
      : [];
  const generated: any[] = Array.isArray(brief.generatedAssets?.generatedVideos)
    ? brief.generatedAssets.generatedVideos
    : Array.isArray(brief.generatedAssets?.sceneClips)
      ? brief.generatedAssets.sceneClips
      : Array.isArray(production.clips)
        ? production.clips
        : [];

  const len = Math.max(storyboard.length, productionScenes.length, generated.length);
  for (let i = 0; i < len; i++) {
    pushDurableClip(clips, storyboard[i]?.videoUrl);
    pushDurableClip(clips, productionScenes[i]?.videoUrl);
    const gen = generated[i];
    pushDurableClip(clips, typeof gen === "string" ? gen : gen?.url || gen?.videoUrl);
  }

  return clips;
}

function findEmergencyFallbackUrl(input: {
  production?: any;
  review?: any;
  brief?: any;
}): string | undefined {
  const production = input.production || {};
  const review = input.review || {};
  const brief = input.brief || production.brief || {};
  const candidates = [
    production.videoUrl,
    review.videoUrl,
    brief.videoUrl,
    brief.generatedAssets?.emergencyFallbackVideoUrl,
  ];
  const hit = candidates.find((u) => typeof u === "string" && isEmergencySlideshowFallbackUrl(u));
  return hit || undefined;
}

/**
 * Master URL for InteractiveVideoPlayer "master mode".
 *
 * Returns undefined when scene clips should drive playback (shot mode) so Review
 * matches Open Production Assets. Never promotes emergency slideshow over clips.
 * For deep/standard, never promotes emergency slideshow even when clips are absent
 * (show stills + truthful unavailable state instead of silent narrator substitution).
 */
export function resolveCanonicalMasterVideoUrl(input: {
  production?: any;
  review?: any;
  brief?: any;
}): string | undefined {
  const production = input.production || {};
  const review = input.review || {};
  const brief = input.brief || production.brief || {};
  const { resolved: mode } = resolveRequestedMode({ production, brief });

  const candidates = [production.videoUrl, review.videoUrl, brief.videoUrl].filter(
    (u): u is string => Boolean(u && isDurableMasterVideoReady(u)),
  );

  const sceneClips = collectDurableSceneClipUrls({ production, brief });
  const nonFallbackMaster = candidates.find((u) => !isEmergencySlideshowFallbackUrl(u));

  if (nonFallbackMaster) {
    if (sceneClips.length > 1) {
      const distinct = new Set(sceneClips);
      if (distinct.size > 1 && sceneClips.includes(nonFallbackMaster)) {
        return undefined;
      }
    }
    return nonFallbackMaster;
  }

  if (sceneClips.length > 0) return undefined;

  const fallback = candidates.find((u) => isEmergencySlideshowFallbackUrl(u));
  // Express/narrator: slideshow master is legitimate.
  if (mode === "express" && fallback) return fallback;

  // Deep/standard (cinematic/hybrid): do NOT silently substitute narrator media.
  if (mode === "deep" || mode === "standard") return undefined;

  return candidates[0];
}

export function resolveCanonicalReviewAudioUrl(input: {
  production?: any;
  review?: any;
  brief?: any;
  masterVideoUrl?: string | null;
}): string | undefined {
  if (input.masterVideoUrl && isDurableMasterVideoReady(input.masterVideoUrl)) {
    return undefined;
  }
  const production = input.production || {};
  const review = input.review || {};
  const brief = input.brief || production.brief || {};
  return (
    production.audioUrl ||
    review.audioUrl ||
    brief.audioUrl ||
    brief.generatedAssets?.voiceoverUrl ||
    brief.generatedAssets?.generatedAudio?.[0] ||
    undefined
  );
}

/**
 * Storyboard scenes for Review player — same clip binding as Production Assets.
 */
export function buildReviewPlaybackScenes(input: {
  production?: any;
  brief?: any;
}): Array<{
  scene: number;
  description: string;
  duration: string;
  image?: string;
  videoUrl?: string;
}> {
  const production = input.production || {};
  const brief = input.brief || production.brief || {};
  const rawClips: any[] = Array.isArray(brief.generatedAssets?.generatedVideos)
    ? brief.generatedAssets.generatedVideos
    : Array.isArray(brief.generatedAssets?.sceneClips)
      ? brief.generatedAssets.sceneClips
      : Array.isArray(production.clips)
        ? production.clips
        : [];

  const pickClip = (s: any, idx: number): string | undefined => {
    const fromScene = s?.videoUrl;
    const fromGen = typeof rawClips[idx] === "string" ? rawClips[idx] : rawClips[idx]?.videoUrl;
    const url = fromScene || fromGen;
    if (!url || !isPlayableVideoUrl(url)) return undefined;
    if (isEmergencySlideshowFallbackUrl(url)) return undefined;
    return url;
  };

  if (Array.isArray(production.productionScenes) && production.productionScenes.length > 0) {
    return production.productionScenes.map((s: any, idx: number) => ({
      scene: s.scene || idx + 1,
      description:
        s.visualDescription || s.shotList || s.onScreenText || s.description || `Scene ${idx + 1}`,
      duration: s.duration || "0–10s",
      image: s.image || s.keyframeImageUrl || brief?.storyboard?.[idx]?.image,
      videoUrl: pickClip(s, idx) || pickClip(brief?.storyboard?.[idx], idx),
    }));
  }

  if (Array.isArray(production.scenes) && production.scenes.length > 0) {
    return production.scenes.map((s: any, idx: number) => ({
      scene: s.scene || idx + 1,
      description: s.description || s.visualDescription || `Scene ${idx + 1}`,
      duration: s.duration || "0–10s",
      image: s.image || brief?.storyboard?.[idx]?.image,
      videoUrl: pickClip(s, idx) || pickClip(brief?.storyboard?.[idx], idx),
    }));
  }

  if (Array.isArray(brief.storyboard) && brief.storyboard.length > 0) {
    return brief.storyboard.map((s: any, idx: number) => ({
      scene: s.scene || idx + 1,
      description: s.visualDescription || s.shotList || s.onScreenText || `Scene ${idx + 1}`,
      duration: s.duration || "0–10s",
      image: s.image,
      videoUrl: pickClip(s, idx),
    }));
  }

  return [
    {
      scene: 1,
      description: `Hook: ${brief?.hook || "Opening hook"}`,
      duration: "0–5s",
      image: brief?.generatedAssets?.generatedFrames?.[0],
      videoUrl: pickClip({}, 0),
    },
    {
      scene: 2,
      description: `Body: ${brief?.visualDirection || "Script body breakdown"}`,
      duration: "5–25s",
      image: brief?.generatedAssets?.generatedFrames?.[1],
      videoUrl: pickClip({}, 1),
    },
    {
      scene: 3,
      description: `CTA: ${brief?.caption || "Call to Action"}`,
      duration: "25–30s",
      image: brief?.generatedAssets?.generatedFrames?.[2],
      videoUrl: pickClip({}, 2),
    },
  ];
}

/** Scene clip by index — same binding Production Assets uses for scene cards. */
export function resolveCanonicalSceneVideoUrl(input: {
  production?: any;
  brief?: any;
  sceneIndex: number;
}): string | undefined {
  const scenes = buildReviewPlaybackScenes(input);
  return scenes[input.sceneIndex]?.videoUrl;
}

/**
 * Authoritative lineage snapshot for Review, Production Assets, and diagnostics.
 */
export function resolveCanonicalProductionMedia(input: {
  production?: any;
  review?: any;
  brief?: any;
}): CanonicalProductionMedia {
  const production = input.production || {};
  const review = input.review || {};
  const brief = input.brief || production.brief || {};
  const modeInfo = resolveRequestedMode({ production, brief });
  const sceneClipUrls = collectDurableSceneClipUrls({ production, brief });
  const scenes = buildReviewPlaybackScenes({ production, brief });
  const emergencyFallbackUrl = findEmergencyFallbackUrl({ production, review, brief });
  const masterVideoUrl = resolveCanonicalMasterVideoUrl({ production, review, brief });
  const audioUrl = resolveCanonicalReviewAudioUrl({
    production,
    review,
    brief,
    masterVideoUrl,
  });

  const stillImageUrl =
    scenes.find((s) => s.image)?.image ||
    brief.generatedAssets?.generatedFrames?.[0] ||
    production.thumbnailUrl ||
    brief.thumbnailUrl ||
    undefined;

  const modeMismatch = Boolean(
    (modeInfo.resolved === "deep" || modeInfo.resolved === "standard") &&
      emergencyFallbackUrl &&
      sceneClipUrls.length === 0,
  );

  let kind: CanonicalMediaKind = "missing";
  if (masterVideoUrl && !isEmergencySlideshowFallbackUrl(masterVideoUrl) && sceneClipUrls.length === 0) {
    kind = modeInfo.resolved === "express" ? "express_master" : "merged_master";
  } else if (sceneClipUrls.length > 0) {
    kind = "scene_clips";
  } else if (
    masterVideoUrl &&
    isEmergencySlideshowFallbackUrl(masterVideoUrl) &&
    modeInfo.resolved === "express"
  ) {
    kind = "emergency_fallback";
  } else if (stillImageUrl) {
    kind = "still_only";
  }

  let availabilityMessage: string | null = null;
  if (kind === "missing") {
    availabilityMessage = "Master video not yet available.";
  } else if (kind === "still_only" && (modeInfo.resolved === "deep" || modeInfo.resolved === "standard")) {
    availabilityMessage =
      "Cinematic scene video not yet available. Showing storyboard stills — narrator fallback is not used as the Review hero.";
  }

  const modeMismatchMessage = modeMismatch
    ? `⚠ Production mode mismatch — Expected: ${modeInfo.label || "Cinematic"} · Observed: Narrator slideshow fallback. Approval/publish blocked until cinematic clips or a true master exist.`
    : null;

  const lineageSource =
    kind === "scene_clips"
      ? "storyboard.videoUrl|generatedAssets.generatedVideos|productionScenes.videoUrl"
      : kind === "merged_master" || kind === "express_master"
        ? "production.videoUrl|brief.videoUrl (non-fallback)"
        : kind === "emergency_fallback"
          ? "master-fallback (express only)"
          : "stills/unavailable";

  const result: CanonicalProductionMedia = {
    productionId: production.id || review.productionId || null,
    requestedMode: modeInfo.raw,
    resolvedMode: modeInfo.resolved,
    modeLabel: modeInfo.label,
    kind,
    masterVideoUrl,
    sceneClipUrls,
    scenes,
    audioUrl,
    modeMismatch,
    modeMismatchMessage,
    emergencyFallbackUrl,
    stillImageUrl,
    availabilityMessage,
    lineageSource,
  };

  logMediaLineage(result);
  return result;
}

/** Dev diagnostics for duplicate-generation / dual-spine investigations. */
export function logMediaLineage(media: CanonicalProductionMedia): void {
  try {
    if (typeof console === "undefined" || typeof console.debug !== "function") return;
    console.debug("[SPARK:MEDIA-LINEAGE]", {
      productionId: media.productionId,
      productionMode: media.resolvedMode,
      modeLabel: media.modeLabel,
      kind: media.kind,
      master: media.masterVideoUrl ? "yes" : "no",
      sceneClips: media.sceneClipUrls.length,
      modeMismatch: media.modeMismatch,
      source: media.lineageSource,
      emergencyFallback: Boolean(media.emergencyFallbackUrl),
    });
  } catch {
    // never throw from diagnostics
  }
}

/** True when generation already produced durable canonical media (idempotent skip). */
export function hasCanonicalPlayableMedia(input: {
  production?: any;
  brief?: any;
}): boolean {
  const media = resolveCanonicalProductionMedia(input);
  if (media.kind === "scene_clips" && media.sceneClipUrls.length > 0) return true;
  if (media.kind === "merged_master" || media.kind === "express_master") {
    return Boolean(media.masterVideoUrl);
  }
  return false;
}
