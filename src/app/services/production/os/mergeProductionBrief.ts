import type { ProductionBrief, ProductionBriefBeat } from "../../../domain/types";

/**
 * Checks if an object looks like a complete narrative script (with chapters or spoken script).
 */
export function isFullNarrativeScript(script: any): boolean {
  if (!script || typeof script !== "object") return false;
  const hasChapters = Array.isArray(script.chapters) && script.chapters.length > 0;
  const hasSpoken = typeof script.fullSpokenScript === "string" && script.fullSpokenScript.trim().length > 0;
  return hasChapters || hasSpoken;
}

/**
 * Merges two ProductionBrief instances canonically.
 * 
 * Rules:
 * 1. Keep prev.narrativeScript unless next.narrativeScript is a full object.
 * 2. Keep prev.beats if next.beats is empty.
 * 3. Keep prev.storyboard if next.storyboard is empty.
 * 4. Overlay generationProgress, generatedAssets, video and audio URLs from next.
 * 5. Preserve lastError and quality scores.
 */
export function mergeProductionBrief(
  prev?: Partial<ProductionBrief> | Record<string, any> | null,
  next?: Partial<ProductionBrief> | Record<string, any> | null
): ProductionBrief | undefined {
  if (!prev && !next) return undefined;
  const p = (prev && typeof prev === "object" ? prev : {}) as Record<string, any>;
  const n = (next && typeof next === "object" ? next : {}) as Record<string, any>;

  // 1. keep prev.narrativeScript unless next.narrativeScript is a full object
  const nextScript = n.narrativeScript;
  const prevScript = p.narrativeScript;
  const narrativeScript = isFullNarrativeScript(nextScript)
    ? nextScript
    : isFullNarrativeScript(prevScript)
    ? prevScript
    : (nextScript || prevScript);

  // 2. keep prev.beats if next.beats is empty
  const nextBeats = Array.isArray(n.beats) ? n.beats : undefined;
  const prevBeats = Array.isArray(p.beats) ? p.beats : undefined;
  const beats: ProductionBriefBeat[] =
    nextBeats && nextBeats.length > 0
      ? nextBeats
      : prevBeats && prevBeats.length > 0
      ? prevBeats
      : (nextBeats || prevBeats || []);

  // 3. keep prev.storyboard if next.storyboard is empty
  const nextStoryboard = Array.isArray(n.storyboard) ? n.storyboard : undefined;
  const prevStoryboard = Array.isArray(p.storyboard) ? p.storyboard : undefined;
  const storyboard =
    nextStoryboard && nextStoryboard.length > 0
      ? nextStoryboard
      : prevStoryboard && prevStoryboard.length > 0
      ? prevStoryboard
      : (nextStoryboard || prevStoryboard || []);

  // 4. overlay generationProgress / generatedAssets / media URLs from next
  const pGenAssets = p.generatedAssets && typeof p.generatedAssets === "object" ? p.generatedAssets : {};
  const nGenAssets = n.generatedAssets && typeof n.generatedAssets === "object" ? n.generatedAssets : {};
  const generatedAssets = {
    ...pGenAssets,
    ...nGenAssets,
  };

  const generationProgress = n.generationProgress !== undefined ? n.generationProgress : p.generationProgress;
  const audioUrl = n.audioUrl || p.audioUrl;
  const videoUrl = n.videoUrl || p.videoUrl;
  const playablePreviewUrl = n.playablePreviewUrl || p.playablePreviewUrl;
  const storyboardGridUrl = n.storyboardGridUrl || p.storyboardGridUrl;
  const video_storage_path = n.video_storage_path || p.video_storage_path;
  const lastError = n.lastError !== undefined ? n.lastError : p.lastError;

  return {
    ...p,
    ...n,
    title: n.title || p.title || "Untitled",
    productionMode: n.productionMode || p.productionMode || "standard",
    targetDurationSec: n.targetDurationSec || p.targetDurationSec,
    hook: n.hook || p.hook || "",
    scriptOutline: n.scriptOutline || p.scriptOutline || "",
    spokenCta: n.spokenCta || p.spokenCta || "",
    onScreenCta: n.onScreenCta || p.onScreenCta || "",
    visualDirection: n.visualDirection || p.visualDirection || "",
    caption: n.caption || p.caption || "",
    platformRecommendation: n.platformRecommendation || p.platformRecommendation || "",
    whyThisWorks: n.whyThisWorks || p.whyThisWorks || "",
    contentSource: n.contentSource || p.contentSource || "ai",
    brandFitScore: n.brandFitScore ?? p.brandFitScore ?? 90,
    narrativeScript,
    beats,
    storyboard,
    audioUrl,
    videoUrl,
    playablePreviewUrl,
    storyboardGridUrl,
    video_storage_path,
    generationProgress,
    generatedAssets,
    lastError,
  } as ProductionBrief;
}
