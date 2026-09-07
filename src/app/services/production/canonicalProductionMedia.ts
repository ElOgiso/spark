/**
 * Canonical production media resolution — shared by Review and Production Assets.
 *
 * Rules:
 * - Scene clips are never the canonical master merely because they exist.
 * - Emergency narrator slideshow (`master-fallback`) is never Review hero for
 *   cinematic/deep (or standard) productions.
 * - Review hero = canonical master only.
 * - Production Assets lists scene clips + master by actual role.
 */

import {
  isDurableMasterVideoReady,
  isPlayableVideoUrl,
  isEmergencySlideshowFallbackUrl,
} from "./productionAssetService";
import {
  isCinematicMode,
  isNarratorMode,
  readProductionSettingsSnapshot,
} from "./productionSettingsSnapshot";
import { normalizeModeString } from "./resolveProductionMode";

export type CanonicalMediaRole =
  | "canonical_master"
  | "scene_clip"
  | "emergency_fallback"
  | "still"
  | "missing";

export interface CanonicalSceneMedia {
  scene: number;
  description: string;
  duration: string;
  imageUrl?: string;
  videoUrl?: string;
  role: "scene_clip" | "still" | "missing";
}

export interface CanonicalProductionMediaView {
  productionId: string | null;
  productionMode: string | null;
  contentFormat: string | null;
  hasCanonicalMaster: boolean;
  canonicalMasterUrl: string | undefined;
  canonicalMasterRole: CanonicalMediaRole;
  sceneClips: string[];
  scenes: CanonicalSceneMedia[];
  emergencyFallbackUrl: string | undefined;
  stillImageUrl: string | undefined;
  masterUnavailableReason: string | null;
  modeMismatch: boolean;
  modeMismatchMessage: string | null;
  lineageSource: string;
}

function pushClip(out: string[], url?: string | null) {
  if (!url || !isDurableMasterVideoReady(url)) return;
  if (isEmergencySlideshowFallbackUrl(url)) return;
  if (!out.includes(url)) out.push(url);
}

function collectSceneClips(production: any, brief: any): string[] {
  const clips: string[] = [];
  const storyboard = Array.isArray(brief?.storyboard) ? brief.storyboard : [];
  const productionScenes = Array.isArray(production?.productionScenes)
    ? production.productionScenes
    : Array.isArray(production?.scenes)
      ? production.scenes
      : [];
  const generated = Array.isArray(brief?.generatedAssets?.generatedVideos)
    ? brief.generatedAssets.generatedVideos
    : Array.isArray(brief?.generatedAssets?.sceneClips)
      ? brief.generatedAssets.sceneClips
      : [];
  const len = Math.max(storyboard.length, productionScenes.length, generated.length);
  for (let i = 0; i < len; i++) {
    pushClip(clips, storyboard[i]?.videoUrl);
    pushClip(clips, productionScenes[i]?.videoUrl);
    const g = generated[i];
    pushClip(clips, typeof g === "string" ? g : g?.url || g?.videoUrl);
  }
  return clips;
}

function buildScenes(production: any, brief: any): CanonicalSceneMedia[] {
  const rawClips: any[] = Array.isArray(brief?.generatedAssets?.generatedVideos)
    ? brief.generatedAssets.generatedVideos
    : Array.isArray(brief?.generatedAssets?.sceneClips)
      ? brief.generatedAssets.sceneClips
      : [];
  const pick = (s: any, idx: number): string | undefined => {
    const fromScene = s?.videoUrl;
    const fromGen = typeof rawClips[idx] === "string" ? rawClips[idx] : rawClips[idx]?.videoUrl;
    const url = fromScene || fromGen;
    if (!url || !isPlayableVideoUrl(url) || isEmergencySlideshowFallbackUrl(url)) return undefined;
    return url;
  };

  const source =
    (Array.isArray(production?.productionScenes) && production.productionScenes.length > 0
      ? production.productionScenes
      : null) ||
    (Array.isArray(brief?.storyboard) && brief.storyboard.length > 0 ? brief.storyboard : null) ||
    (Array.isArray(production?.scenes) && production.scenes.length > 0 ? production.scenes : null) ||
    [];

  if (source.length === 0) return [];

  return source.map((s: any, idx: number) => {
    const videoUrl = pick(s, idx);
    const imageUrl =
      s.image || s.keyframeImageUrl || brief?.generatedAssets?.generatedFrames?.[idx];
    return {
      scene: s.scene || idx + 1,
      description:
        s.visualDescription || s.shotList || s.onScreenText || s.description || `Scene ${idx + 1}`,
      duration: s.duration || "0–10s",
      imageUrl,
      videoUrl,
      role: videoUrl ? ("scene_clip" as const) : imageUrl ? ("still" as const) : ("missing" as const),
    };
  });
}

function resolveRequestedMode(production: any, brief: any): string | null {
  const snapshot = readProductionSettingsSnapshot(production, brief);
  return (
    snapshot?.productionMode ||
    production?.mode ||
    production?.productionMode ||
    brief?.productionMode ||
    null
  );
}

/**
 * Canonical master only:
 * 1) Explicit master fields (canonicalMasterUrl / masterVideoUrl)
 * 2) videoUrl fields that are NOT a scene clip and NOT emergency fallback
 *    (unless narrator/express mode where slideshow master is valid)
 *
 * Never returns a scene clip just because it is the only available video.
 */
export function resolveCanonicalMasterVideoUrl(input: {
  production?: any;
  review?: any;
  brief?: any;
}): string | undefined {
  const production = input.production || {};
  const review = input.review || {};
  const brief = input.brief || production.brief || {};
  const mode = resolveRequestedMode(production, brief);
  const resolved = normalizeModeString(mode) || null;

  const explicit =
    production.canonicalMasterUrl ||
    brief.canonicalMasterUrl ||
    production.masterVideoUrl ||
    brief.masterVideoUrl ||
    brief.generatedAssets?.canonicalMasterUrl;
  if (
    explicit &&
    isDurableMasterVideoReady(explicit) &&
    !isEmergencySlideshowFallbackUrl(explicit)
  ) {
    return explicit;
  }

  const sceneClips = collectSceneClips(production, brief);
  const sceneSet = new Set(sceneClips);

  const candidates = [production.videoUrl, review.videoUrl, brief.videoUrl].filter(
    (u): u is string => Boolean(u && isDurableMasterVideoReady(u))
  );

  // Prefer non-fallback, non-scene-clip hero URLs.
  const trueMaster = candidates.find(
    (u) => !isEmergencySlideshowFallbackUrl(u) && !sceneSet.has(u)
  );
  if (trueMaster) return trueMaster;

  // If videoUrl equals a scene clip, it is provisional pollution — not master.
  if (candidates.some((u) => sceneSet.has(u) && !isEmergencySlideshowFallbackUrl(u))) {
    return undefined;
  }

  const fallback = candidates.find((u) => isEmergencySlideshowFallbackUrl(u));
  if (fallback && (isNarratorMode(mode) || resolved === "express")) {
    return fallback;
  }
  // Cinematic/deep/standard: never promote emergency slideshow to Review hero.
  return undefined;
}

export function resolveCanonicalProductionMedia(input: {
  production?: any;
  review?: any;
  brief?: any;
}): CanonicalProductionMediaView {
  const production = input.production || {};
  const review = input.review || {};
  const brief = input.brief || production.brief || {};
  const snapshot = readProductionSettingsSnapshot(production, brief);
  const mode = resolveRequestedMode(production, brief);
  const contentFormat =
    snapshot?.contentFormat ||
    production.formatSettings?.contentFormat ||
    brief.formatSettings?.contentFormat ||
    null;

  const sceneClips = collectSceneClips(production, brief);
  const scenes = buildScenes(production, brief);
  const emergencyFallbackUrl = [
    production.videoUrl,
    review.videoUrl,
    brief.videoUrl,
    brief.generatedAssets?.emergencyFallbackVideoUrl,
  ].find((u) => typeof u === "string" && isEmergencySlideshowFallbackUrl(u)) as
    | string
    | undefined;

  const canonicalMasterUrl = resolveCanonicalMasterVideoUrl({ production, review, brief });
  const stillImageUrl =
    scenes.find((s) => s.imageUrl)?.imageUrl ||
    brief.generatedAssets?.generatedFrames?.[0] ||
    production.thumbnailUrl ||
    undefined;

  const modeMismatch = Boolean(
    isCinematicMode(mode) &&
      emergencyFallbackUrl &&
      sceneClips.length === 0 &&
      !canonicalMasterUrl
  );

  let masterUnavailableReason: string | null = null;
  let canonicalMasterRole: CanonicalMediaRole = "missing";
  if (canonicalMasterUrl) {
    canonicalMasterRole = isEmergencySlideshowFallbackUrl(canonicalMasterUrl)
      ? "emergency_fallback"
      : "canonical_master";
  } else if (sceneClips.length > 0) {
    masterUnavailableReason =
      "Scene clips are ready. Canonical master is not assembled yet — open Production Assets to review scenes / Approve & merge.";
    canonicalMasterRole = "scene_clip";
  } else if (modeMismatch) {
    masterUnavailableReason =
      "Cinematic master unavailable. A narrator slideshow fallback was quarantined and is not shown as the Review hero.";
    canonicalMasterRole = "emergency_fallback";
  } else if (stillImageUrl) {
    masterUnavailableReason = "Canonical master video not yet available.";
    canonicalMasterRole = "still";
  } else {
    masterUnavailableReason = "Canonical master video not yet available.";
  }

  return {
    productionId: production.id || review.productionId || null,
    productionMode: mode ? String(mode) : null,
    contentFormat: contentFormat ? String(contentFormat) : null,
    hasCanonicalMaster: Boolean(canonicalMasterUrl),
    canonicalMasterUrl,
    canonicalMasterRole,
    sceneClips,
    scenes,
    emergencyFallbackUrl,
    stillImageUrl,
    masterUnavailableReason,
    modeMismatch,
    modeMismatchMessage: modeMismatch
      ? "⚠ Production mode mismatch — Expected: Cinematic · Observed: Narrator slideshow fallback. Review will not treat fallback as the master."
      : null,
    lineageSource: canonicalMasterUrl
      ? "canonical_master"
      : sceneClips.length
        ? "scene_clips"
        : emergencyFallbackUrl
          ? "emergency_fallback_quarantined"
          : "stills_or_missing",
  };
}

export function resolveCanonicalSceneVideoUrl(input: {
  production?: any;
  brief?: any;
  sceneIndex: number;
}): string | undefined {
  const view = resolveCanonicalProductionMedia(input);
  return view.scenes[input.sceneIndex]?.videoUrl;
}

/** Review hero: canonical master only — never a scene-clip stand-in. */
export function resolveReviewHeroVideoUrl(input: {
  production?: any;
  review?: any;
  brief?: any;
}): string | undefined {
  return resolveCanonicalProductionMedia(input).canonicalMasterUrl;
}

/**
 * True when durable playable video already exists (canonical master and/or scene clips).
 * Used to skip credit-burning regenerate when force=false.
 * Quarantined emergency narrator fallback alone does not count for cinematic/standard.
 */
export function hasCanonicalPlayableMedia(input: {
  production?: any;
  review?: any;
  brief?: any;
}): boolean {
  const media = resolveCanonicalProductionMedia(input);
  if (media.hasCanonicalMaster && isPlayableVideoUrl(media.canonicalMasterUrl)) return true;
  if (media.sceneClips.length > 0) return true;
  return false;
}
