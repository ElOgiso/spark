/**
 * Canonical Review ↔ Production Assets playback binding.
 *
 * One AssetService generate can write both cinematic scene clips and an emergency
 * narrator slideshow fallback master. Review must prefer the same durable scene
 * clips Production Assets already surfaces — never a dual pipeline / dual hero.
 */

import {
  isDurableMasterVideoReady,
  isPlayableVideoUrl,
  isEmergencySlideshowFallbackUrl,
} from "./productionAssetService";

export { isEmergencySlideshowFallbackUrl } from "./productionAssetService";

function pushDurableClip(out: string[], url?: string | null) {
  if (!url || !isDurableMasterVideoReady(url)) return;
  if (isEmergencySlideshowFallbackUrl(url)) return;
  if (!out.includes(url)) out.push(url);
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

/**
 * Master URL for InteractiveVideoPlayer "master mode".
 *
 * Returns undefined when scene clips should drive playback (shot mode) so Review
 * matches Open Production Assets. Never promotes emergency slideshow over clips.
 */
export function resolveCanonicalMasterVideoUrl(input: {
  production?: any;
  review?: any;
  brief?: any;
}): string | undefined {
  const production = input.production || {};
  const review = input.review || {};
  const brief = input.brief || production.brief || {};

  const candidates = [production.videoUrl, review.videoUrl, brief.videoUrl].filter(
    (u): u is string => Boolean(u && isDurableMasterVideoReady(u)),
  );

  const sceneClips = collectDurableSceneClipUrls({ production, brief });
  const nonFallbackMaster = candidates.find((u) => !isEmergencySlideshowFallbackUrl(u));

  if (nonFallbackMaster) {
    // Provisional first-clip master + multiple distinct scene clips → shot mode
    // so Review browses the same clips Open Production Assets shows.
    if (sceneClips.length > 1) {
      const distinct = new Set(sceneClips);
      if (distinct.size > 1 && sceneClips.includes(nonFallbackMaster)) {
        return undefined;
      }
    }
    return nonFallbackMaster;
  }

  // Emergency slideshow must not win when cinematic/standard scene clips exist.
  if (sceneClips.length > 0) return undefined;

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
    return url && isPlayableVideoUrl(url) ? url : undefined;
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
