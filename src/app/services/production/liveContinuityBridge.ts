/**
 * Live Continuity Bridge — one spine for scene-to-scene I2V chaining.
 *
 * Wires OS frameStrategy + GeneratedStateFrame into AssetService without a
 * second pipeline. UI fix / autonomous generate share the same CONTINUATION law:
 *
 *   Scene N LAST (observed) → Scene N+1 FIRST (temporal)
 *   Scene N+1 storyboard still → narrative / composition reference (not start, when chaining)
 */

import {
  resolveGenerationFrameStrategy,
  frameStrategyToVideoRequestFields,
  type FrameStrategyCapabilities,
  type ResolvedFrameStrategy,
} from "./generation/frameStrategy";
import {
  buildGeneratedStateFrame,
  buildContinuityFrameHandoff,
  type GeneratedStateFrame,
} from "./generation/generatedStateFrame";

function isValidMediaData(val?: string | null): val is string {
  if (!val || typeof val !== "string") return false;
  const t = val.trim();
  return t.length >= 8;
}

export interface LiveSceneContinuityInput {
  productionId: string;
  sceneIndexZeroBased: number;
  shotId: string;
  /** Planned still / panel for THIS scene (narrative intent). */
  sceneStillUrl?: string | null;
  /** Observed LAST frame from previous scene clip (temporal precedence). */
  previousLastFrameUrl?: string | null;
  previousShotId?: string | null;
  /** Optional planned end still (next scene panel) when provider supports end frame. */
  nextSceneStillUrl?: string | null;
  nextShotId?: string | null;
  /** Extra identity / location refs (not used as first frame). */
  referenceUrls?: string[];
  /**
   * When true (default for sceneIndex > 0), prefer CONTINUATION from prev LAST.
   * Soft fallback to scene still only when prev LAST missing.
   */
  preferContinuation?: boolean;
  capabilities?: FrameStrategyCapabilities;
}

export interface LiveSceneContinuityPlan {
  firstFrameUrl: string;
  endFrameUrl?: string;
  referenceImageUrls: string[];
  continuationSourceUrl?: string;
  mode: ResolvedFrameStrategy["mode"];
  chained: boolean;
  rationale: string[];
  strategy: ResolvedFrameStrategy;
  handoff?: ReturnType<typeof buildContinuityFrameHandoff>;
  /** True when we had to fall back to scene still despite wanting continuation. */
  continuityGap: boolean;
  gapReason?: string;
}

const DEFAULT_LIVE_CAPS: FrameStrategyCapabilities = {
  supportsReferenceImages: true,
  supportsStartFrame: true,
  supportsEndFrame: true,
  supportsStartAndEndFrame: true,
  supportsVideoContinuation: true,
  supportsLastFrameContinuation: true,
};

function validUrl(u?: string | null): string | undefined {
  return typeof u === "string" && isValidMediaData(u) ? u : undefined;
}

/**
 * Resolve first/end/refs for one live scene I2V call using OS frame strategy.
 */
export function resolveLiveSceneContinuity(
  input: LiveSceneContinuityInput
): LiveSceneContinuityPlan {
  const sceneStill = validUrl(input.sceneStillUrl);
  const prevLast = validUrl(input.previousLastFrameUrl);
  const nextStill = validUrl(input.nextSceneStillUrl);
  const preferContinuation =
    input.preferContinuation ?? input.sceneIndexZeroBased > 0;

  if (!sceneStill && !prevLast) {
    throw new Error(
      `Continuity Gate: Scene ${input.sceneIndexZeroBased + 1} has no still and no previous last frame — cannot I2V`
    );
  }

  const caps = input.capabilities || DEFAULT_LIVE_CAPS;
  const previousGeneratedState =
    prevLast && input.previousShotId
      ? {
          id: `prev_last_${input.previousShotId}`,
          url: prevLast,
          position: "LAST" as const,
          sourceVideoAssetId: `scene_video_${input.previousShotId}`,
          sourceShotId: input.previousShotId,
        }
      : prevLast
        ? {
            id: `prev_last_idx_${input.sceneIndexZeroBased}`,
            url: prevLast,
            position: "LAST" as const,
            sourceVideoAssetId: `scene_video_${input.sceneIndexZeroBased}`,
            sourceShotId: `shot_${input.sceneIndexZeroBased}`,
          }
        : null;

  // Storyboard / panel frame for THIS shot — narrative authority (may equal still URL)
  const storyboardFrame = sceneStill
    ? ({
        id: `live_sbframe_${input.shotId}`,
        kind: "panel_frame" as const,
        category: "storyboard_panel" as const,
        lineage: {
          productionId: input.productionId,
          shotId: input.shotId,
          panelId: `panel_${input.sceneIndexZeroBased + 1}`,
          storyboardId: input.productionId,
          storyboardVersion: 1,
        },
        url: sceneStill,
        status: "rendered" as const,
        aspectRatio: "locked",
        excludesSheetChrome: true as const,
        excludesPanelNumbers: true as const,
        excludesExplanatoryText: true as const,
        compositionIntent: "live",
        framingIntent: "live",
        createdAt: new Date().toISOString(),
      } as any)
    : null;

  const storyboardEndFrame =
    nextStill && nextStill !== sceneStill && nextStill !== prevLast
      ? ({
          id: `live_sbframe_end_${input.shotId}`,
          kind: "panel_frame" as const,
          category: "storyboard_panel" as const,
          lineage: {
            productionId: input.productionId,
            shotId: input.nextShotId || `shot_${input.sceneIndexZeroBased + 2}`,
            panelId: `panel_${input.sceneIndexZeroBased + 2}`,
            storyboardId: input.productionId,
            storyboardVersion: 1,
          },
          url: nextStill,
          status: "rendered" as const,
          aspectRatio: "locked",
          excludesSheetChrome: true as const,
          excludesPanelNumbers: true as const,
          excludesExplanatoryText: true as const,
          compositionIntent: "live",
          framingIntent: "live",
          createdAt: new Date().toISOString(),
        } as any)
      : null;

  const strategy = resolveGenerationFrameStrategy({
    storyboardFrame,
    storyboardEndFrame,
    previousGeneratedState,
    referenceUrls: (input.referenceUrls || []).filter(Boolean),
    preferContinuation: preferContinuation && Boolean(prevLast),
    preferFirstLast: Boolean(storyboardEndFrame) && !prevLast,
    capabilities: caps,
  });

  const fields = frameStrategyToVideoRequestFields(strategy);

  // Hard law: when chaining, first frame MUST be prev LAST if available
  let firstFrameUrl = fields.firstFrameUrl || sceneStill || prevLast!;
  let continuityGap = false;
  let gapReason: string | undefined;
  if (preferContinuation && input.sceneIndexZeroBased > 0) {
    if (prevLast) {
      firstFrameUrl = prevLast;
    } else {
      continuityGap = true;
      gapReason =
        "Previous scene last frame missing — falling back to this scene still (seam risk)";
      firstFrameUrl = sceneStill || firstFrameUrl;
    }
  }

  // End frame: next still when not equal to first (provider optional)
  let endFrameUrl = fields.endFrameUrl || (nextStill && nextStill !== firstFrameUrl ? nextStill : undefined);
  if (endFrameUrl === firstFrameUrl) endFrameUrl = undefined;

  const refs = Array.from(
    new Set(
      [...(fields.referenceImageUrls || []), ...(input.referenceUrls || []), sceneStill]
        .filter((u): u is string => Boolean(u && u !== firstFrameUrl && u !== endFrameUrl))
    )
  );

  const chained = Boolean(prevLast && firstFrameUrl === prevLast);
  const handoff =
    prevLast && input.previousShotId
      ? buildContinuityFrameHandoff({
          fromShotId: input.previousShotId,
          toShotId: input.shotId,
          generatedLastFrame: buildGeneratedStateFrame({
            productionId: input.productionId,
            sourceVideoAssetId: `scene_video_${input.previousShotId}`,
            sourceShotId: input.previousShotId,
            url: prevLast,
            position: "LAST",
          }),
          nextStoryboardFrameId: storyboardFrame?.id,
        })
      : undefined;

  return {
    firstFrameUrl,
    endFrameUrl,
    referenceImageUrls: refs,
    continuationSourceUrl: fields.continuationSourceUrl || (chained ? prevLast : undefined),
    mode: strategy.mode,
    chained,
    rationale: [
      ...strategy.rationale,
      chained
        ? `Live CONTINUATION: Scene ${input.sceneIndexZeroBased} LAST → Scene ${input.sceneIndexZeroBased + 1} FIRST`
        : `Live FIRST_FRAME from scene still (Scene ${input.sceneIndexZeroBased + 1})`,
    ],
    strategy,
    handoff,
    continuityGap,
    gapReason,
  };
}

/** Register observed LAST state after a clip succeeds. */
export function stampSceneGeneratedStateFrame(params: {
  productionId: string;
  shotId: string;
  videoUrl: string;
  lastFrameUrl: string;
  sceneIndexZeroBased: number;
}): GeneratedStateFrame {
  return buildGeneratedStateFrame({
    productionId: params.productionId,
    sourceVideoAssetId: params.videoUrl,
    sourceShotId: params.shotId,
    url: params.lastFrameUrl,
    position: "LAST",
    plannedStoryboardFrameId: `live_sbframe_${params.shotId}`,
  });
}

/** Collect on-screen caption lines from storyboard (shared by auto-merge + UI merge). */
export function collectSceneCaptionLines(
  scenes: Array<{ onScreenText?: string }>,
  beats?: Array<{ onScreenText?: string }>,
  hook?: string,
  formatBurned?: (t: string) => string
): string[] {
  const fmt = formatBurned || ((t: string) => String(t || "").trim());
  return scenes.map((s, idx) => {
    if (s.onScreenText) {
      const f = fmt(s.onScreenText);
      if (f) return f;
    }
    const beat = beats?.[idx]?.onScreenText;
    if (beat) {
      const f = fmt(beat);
      if (f) return f;
    }
    if (idx === 0 && hook) return fmt(hook);
    return "";
  });
}

/**
 * Shared master assemble options — UI merge and autonomous auto-merge must call the same merger.
 */
export interface AssembleMasterFromClipsParams {
  productionId: string;
  brandId?: string;
  videoUrls: string[];
  /** VO bed when all scenes are VO, or optional narration. */
  audioUrl?: string;
  /** Transition / whoosh SFX — preferred as audio when no VO; otherwise stored for lineage. */
  sfxUrl?: string;
  onScreenTexts?: string[];
  width?: number;
  height?: number;
  timeoutMs?: number;
}

export async function assembleMasterFromClips(
  params: AssembleMasterFromClipsParams
): Promise<{
  publicUrl?: string;
  blob?: Blob;
  mimeType: string;
  extension: "webm" | "mp4";
  durationSec: number;
  provider?: string;
} | null> {
  const { mergeSceneVideos } = await import("./sceneVideoMerger");
  // Prefer VO as mix bed; if no VO but SFX exists, attach SFX so cinematic masters aren't silent of bed
  const audioUrl = params.audioUrl || params.sfxUrl;
  return mergeSceneVideos({
    productionId: params.productionId,
    brandId: params.brandId,
    videoUrls: params.videoUrls,
    audioUrl,
    onScreenTexts: params.onScreenTexts,
    width: params.width,
    height: params.height,
    timeoutMs: params.timeoutMs ?? 120000,
  });
}
