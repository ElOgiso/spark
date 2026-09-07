/**
 * One media lineage for SPARK productions.
 *
 * Spec shot media (when present) is preferred; brief.storyboard and
 * productionScenes are projections of the same shelves — never rival truths.
 * Review, Assets, and queue MUST read through resolveProductionMediaView.
 */

import {
  resolveCanonicalProductionMedia,
  type CanonicalProductionMediaView,
} from "./canonicalProductionMedia";

export interface ProductionMediaSceneView {
  /** 1-based scene index (always) */
  scene: number;
  shotId?: string;
  sceneId?: string;
  description: string;
  duration: string;
  durationSec?: number;
  imageUrl?: string;
  keyframeImageUrl?: string;
  videoUrl?: string;
  lastFrameUrl?: string;
  subject?: string;
  status?: string;
  source: "spec" | "productionScenes" | "brief.storyboard" | "scenes" | "generatedFrames";
}

export interface ProductionMediaView {
  productionId: string | null;
  scenes: ProductionMediaSceneView[];
  /** Same still URL every surface should show for scene N (1-based) */
  stillByScene: Record<number, string | undefined>;
  videoByScene: Record<number, string | undefined>;
  lastFrameByScene: Record<number, string | undefined>;
  storyboardGridUrl?: string;
  canonical: CanonicalProductionMediaView;
  lineageSource: string;
  isGenerating: boolean;
  reviewReady: boolean;
}

function asText(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

function pickImage(s: any, frameFallback?: string): string | undefined {
  const url =
    s?.image ||
    s?.keyframeImageUrl ||
    s?.keyframeUrl ||
    s?.storyboardFrameUrl ||
    frameFallback;
  return typeof url === "string" && url.trim() ? url : undefined;
}

function pickVideo(s: any): string | undefined {
  const url = s?.videoUrl || s?.mediaUrl;
  return typeof url === "string" && url.trim() ? url : undefined;
}

function normalizeSceneIndex(raw: any, idx: number): number {
  const n = Number(raw?.scene ?? raw?.index ?? raw?.sequenceIndex);
  if (Number.isFinite(n) && n >= 1) return Math.floor(n);
  return idx + 1;
}

/** Collect Spec shots flattened in scene order (1-based). */
export function listSpecShots(production: any): any[] {
  const spec =
    production?.reasoning?.productionSpec ||
    production?.productionSpec ||
    production?.brief?.productionSpec;
  if (!spec?.scenes || !Array.isArray(spec.scenes)) return [];
  const out: any[] = [];
  for (const scene of spec.scenes) {
    const shots = Array.isArray(scene?.shots) ? scene.shots : [];
    for (const shot of shots) {
      out.push({
        ...shot,
        sceneId: shot.sceneId || scene.id,
        sceneLabel: scene.title || scene.id,
      });
    }
  }
  return out;
}

/**
 * Single shelf resolver — same ordering and URLs for Review, Assets, queue.
 * Prefer Spec shot media → productionScenes → brief.storyboard → scenes.
 */
export function resolveProductionMediaView(input: {
  production?: any;
  review?: any;
  brief?: any;
}): ProductionMediaView {
  const production = input.production || {};
  const review = input.review || {};
  const brief = input.brief || production.brief || review.brief || {};
  const canonical = resolveCanonicalProductionMedia({ production, review, brief });
  const frames: string[] = Array.isArray(brief?.generatedAssets?.generatedFrames)
    ? brief.generatedAssets.generatedFrames
    : [];

  const specShots = listSpecShots(production);
  let scenes: ProductionMediaSceneView[] = [];
  let lineageSource = "empty";

  if (specShots.length > 0 && specShots.some((s) => s.keyframeUrl || s.mediaUrl || s.lastFrameUrl)) {
    lineageSource = "spec";
    scenes = specShots.map((shot, idx) => {
      const imageUrl = pickImage(shot, frames[idx]);
      return {
        scene: idx + 1,
        shotId: shot.id || shot.shotId,
        sceneId: shot.sceneId,
        description: asText(
          shot.action || shot.visualDescription || shot.purpose || shot.sceneLabel,
          `Scene ${idx + 1}`
        ),
        duration: asText(shot.durationLabel, `${shot.durationSec || 5}s`),
        durationSec: typeof shot.durationSec === "number" ? shot.durationSec : undefined,
        imageUrl,
        keyframeImageUrl: imageUrl,
        videoUrl: pickVideo(shot),
        lastFrameUrl: typeof shot.lastFrameUrl === "string" ? shot.lastFrameUrl : undefined,
        subject: shot.subject || shot.subjectType,
        status: shot.generationStatus || shot.status,
        source: "spec" as const,
      };
    });
  } else {
    const productionScenes = Array.isArray(production.productionScenes)
      ? production.productionScenes
      : [];
    const storyboard = Array.isArray(brief.storyboard) ? brief.storyboard : [];
    const legacyScenes = Array.isArray(production.scenes) ? production.scenes : [];

    let sourceRows: any[] = [];
    let source: ProductionMediaSceneView["source"] = "brief.storyboard";
    if (productionScenes.length > 0) {
      sourceRows = productionScenes;
      source = "productionScenes";
    } else if (storyboard.length > 0) {
      sourceRows = storyboard;
      source = "brief.storyboard";
    } else if (legacyScenes.length > 0) {
      sourceRows = legacyScenes;
      source = "scenes";
    } else if (frames.length > 0) {
      sourceRows = frames.map((url, idx) => ({ scene: idx + 1, image: url }));
      source = "generatedFrames";
    }
    lineageSource = source;

    scenes = sourceRows.map((s, idx) => {
      const imageUrl = pickImage(s, frames[idx]);
      return {
        scene: normalizeSceneIndex(s, idx),
        shotId: s.shotId || s.id,
        sceneId: s.sceneId,
        description: asText(
          s.visualDescription || s.shotList || s.onScreenText || s.description || s.action,
          `Scene ${idx + 1}`
        ),
        duration: asText(s.duration, `${s.durationSec || 5}s`),
        durationSec: typeof s.durationSec === "number" ? s.durationSec : undefined,
        imageUrl,
        keyframeImageUrl: imageUrl,
        videoUrl: pickVideo(s),
        lastFrameUrl: typeof s.lastFrameUrl === "string" ? s.lastFrameUrl : undefined,
        subject: s.subject || s.subjectType,
        status: s.status,
        source,
      };
    });
  }

  // Normalize to contiguous 1-based indices after sort
  scenes = [...scenes]
    .sort((a, b) => a.scene - b.scene)
    .map((s, idx) => ({ ...s, scene: idx + 1 }));

  const stillByScene: Record<number, string | undefined> = {};
  const videoByScene: Record<number, string | undefined> = {};
  const lastFrameByScene: Record<number, string | undefined> = {};
  for (const s of scenes) {
    stillByScene[s.scene] = s.imageUrl;
    videoByScene[s.scene] = s.videoUrl;
    lastFrameByScene[s.scene] = s.lastFrameUrl;
  }

  const firstStill = scenes.find((s) => s.imageUrl)?.imageUrl;
  const storyboardGridUrl =
    (typeof brief.storyboardGridUrl === "string" && brief.storyboardGridUrl) ||
    (typeof brief.generatedAssets?.storyboardGridUrl === "string" &&
      brief.generatedAssets.storyboardGridUrl) ||
    firstStill;

  const isGenerating =
    Boolean(production.isGeneratingAssets) ||
    Boolean(
      production.generationProgress &&
        production.generationProgress.percent > 0 &&
        production.generationProgress.percent < 100 &&
        production.generationProgress.stage !== "Complete" &&
        production.generationProgress.stage !== "Cancelled" &&
        production.generationProgress.stage !== "Failed"
    );

  const hasDeliverable =
    Boolean(canonical.canonicalMasterUrl) ||
    scenes.some((s) => s.videoUrl) ||
    (scenes.length > 0 && scenes.every((s) => s.imageUrl));

  const reviewReady =
    !isGenerating &&
    hasDeliverable &&
    (production.status === "Ready for Review" ||
      production.status === "Awaiting Review" ||
      production.status === "Completed");

  return {
    productionId: production.id || review.productionId || null,
    scenes,
    stillByScene,
    videoByScene,
    lastFrameByScene,
    storyboardGridUrl,
    canonical,
    lineageSource,
    isGenerating,
    reviewReady,
  };
}

/**
 * Project scene media onto brief.storyboard + productionScenes + scenes + generatedFrames
 * so every reader shelf stays in sync. Spec shots updated when shotId matches.
 */
export function syncProductionMediaStores(params: {
  production: any;
  scenes: Array<{
    scene?: number;
    index?: number;
    shotId?: string;
    image?: string;
    keyframeImageUrl?: string;
    videoUrl?: string;
    lastFrameUrl?: string;
    visualDescription?: string;
    description?: string;
    duration?: string;
    durationSec?: number;
    subject?: string;
    status?: string;
    [k: string]: any;
  }>;
  masterVideoUrl?: string;
  audioUrl?: string;
}): any {
  const { production, scenes: incoming, masterVideoUrl, audioUrl } = params;
  const brief = { ...(production.brief || {}) };
  const normalized = incoming.map((s, idx) => {
    const scene = normalizeSceneIndex(s, idx);
    const image = s.image || s.keyframeImageUrl;
    return {
      ...s,
      scene,
      index: scene,
      image,
      keyframeImageUrl: s.keyframeImageUrl || image,
      videoUrl: s.videoUrl,
      lastFrameUrl: s.lastFrameUrl,
      visualDescription:
        s.visualDescription || s.description || s.shotList || `Scene ${scene}`,
      duration: s.duration || `${s.durationSec || 5}s`,
      durationSec: s.durationSec,
      subject: s.subject,
      status: s.status || (image || s.videoUrl ? "ready" : s.status),
    };
  });

  const frames = normalized.map((s) => s.image).filter(Boolean) as string[];
  const sceneClips = normalized.map((s) => s.videoUrl).filter(Boolean) as string[];

  // Preserve a real multi-panel sheet URL — never demote it to the first still
  const existingGrid =
    (typeof brief.storyboardGridUrl === "string" && brief.storyboardGridUrl) ||
    (typeof brief.generatedAssets?.storyboardGridUrl === "string" &&
      brief.generatedAssets.storyboardGridUrl) ||
    undefined;
  // Prefer existing grid when it is not merely the first still alias
  const nextGridUrl =
    existingGrid && (!frames[0] || existingGrid !== frames[0])
      ? existingGrid
      : existingGrid || frames[0];

  brief.storyboard = normalized.map((s) => ({
    ...(Array.isArray(brief.storyboard)
      ? brief.storyboard.find((b: any) => normalizeSceneIndex(b, -1) === s.scene) || {}
      : {}),
    ...s,
  }));
  brief.generatedAssets = {
    ...(brief.generatedAssets || {}),
    generatedFrames: frames,
    sceneClips,
    // Keep generatedVideos as scene clips when present; master is separate field
    generatedVideos:
      sceneClips.length > 0 ? sceneClips : brief.generatedAssets?.generatedVideos,
    storyboardGridUrl: nextGridUrl || brief.generatedAssets?.storyboardGridUrl,
  };
  if (nextGridUrl) {
    brief.storyboardGridUrl = nextGridUrl;
  }
  if (masterVideoUrl) {
    brief.videoUrl = masterVideoUrl;
    brief.canonicalMasterUrl = masterVideoUrl;
    brief.generatedAssets.canonicalMasterUrl = masterVideoUrl;
  }
  if (audioUrl) {
    brief.audioUrl = audioUrl;
  }

  const productionScenes = normalized;
  const scenesLite = normalized.slice(0, Math.max(3, normalized.length)).map((s) => ({
    scene: s.scene,
    description: s.visualDescription,
    duration: s.duration,
    image: s.image,
    videoUrl: s.videoUrl,
  }));

  // Project onto Spec shots by shotId when available
  let reasoning = production.reasoning;
  const spec = reasoning?.productionSpec;
  if (spec?.scenes && Array.isArray(spec.scenes)) {
    const byShot = new Map(
      normalized.filter((s) => s.shotId).map((s) => [String(s.shotId), s])
    );
    let shotOrdinal = 0;
    const nextScenes = spec.scenes.map((scene: any) => ({
      ...scene,
      shots: (scene.shots || []).map((shot: any) => {
        shotOrdinal += 1;
        const match =
          byShot.get(String(shot.id)) ||
          byShot.get(String(shot.shotId)) ||
          normalized[shotOrdinal - 1];
        if (!match) return shot;
        return {
          ...shot,
          keyframeUrl: match.image || match.keyframeImageUrl || shot.keyframeUrl,
          mediaUrl: match.videoUrl || shot.mediaUrl,
          lastFrameUrl: match.lastFrameUrl || shot.lastFrameUrl,
          generationStatus:
            match.image || match.videoUrl ? "generated" : shot.generationStatus,
        };
      }),
    }));
    reasoning = {
      ...reasoning,
      productionSpec: { ...spec, scenes: nextScenes },
    };
  }

  return {
    ...production,
    brief,
    productionScenes,
    scenes: scenesLite,
    reasoning,
    ...(masterVideoUrl
      ? { videoUrl: masterVideoUrl, canonicalMasterUrl: masterVideoUrl }
      : {}),
    ...(audioUrl ? { audioUrl } : {}),
  };
}

/** Normalize UI scene index: accept 0-based or 1-based, always return 1-based. */
export function toOneBasedSceneIndex(
  rawIndex: number,
  sceneCount: number
): number {
  if (!Number.isFinite(rawIndex)) return 1;
  if (rawIndex <= 0) return 1;
  if (rawIndex > sceneCount && rawIndex - 1 >= 1 && rawIndex - 1 <= sceneCount) {
    // Likely already 1-based beyond count — clamp
    return Math.min(rawIndex, Math.max(1, sceneCount));
  }
  // If caller passed 0-based findIndex result (0..n-1), convert when rawIndex < sceneCount
  // Convention: values in 1..sceneCount are 1-based; we always treat as 1-based here.
  return Math.min(Math.max(1, Math.floor(rawIndex)), Math.max(1, sceneCount || 1));
}

/**
 * Bind media reuse by shotId / scene number — never by array index alone.
 */
export function findReusableStill(params: {
  shotId?: string;
  scene: number;
  storyboard?: any[];
  productionScenes?: any[];
  generatedFrames?: string[];
}): string | undefined {
  const { shotId, scene, storyboard = [], productionScenes = [], generatedFrames = [] } = params;
  if (shotId) {
    const fromSb = storyboard.find((s) => s?.shotId === shotId || s?.id === shotId);
    const fromPs = productionScenes.find((s) => s?.shotId === shotId || s?.id === shotId);
    const hit = pickImage(fromSb) || pickImage(fromPs);
    if (hit) return hit;
  }
  const fromSb = storyboard.find((s) => normalizeSceneIndex(s, -1) === scene);
  const fromPs = productionScenes.find(
    (s) => normalizeSceneIndex(s, -1) === scene || s?.index === scene
  );
  return pickImage(fromSb) || pickImage(fromPs) || generatedFrames[scene - 1];
}
