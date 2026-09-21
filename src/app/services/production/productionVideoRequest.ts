/**
 * Production I2V request: sends first-frame, end-frame, and identity refs
 * to /api/runtime/video so last-frame continuity actually reaches the adapter.
 */

import {
  looksLikeSheetOrGridUrl,
  looksLikeStoryboardGridUrl,
  assertVideoRequestExecutable,
  I2V_API_PROVIDERS,
} from "./capability/assertVideoRequest";

export interface ProductionVideoClipRequest {
  provider: string;
  prompt: string;
  firstFrameUrl?: string;
  /** Continuation frame from previous clip (or planned end pose). */
  lastFrameUrl?: string;
  /** Desired end pose for this clip (Kling image_tail / Seedance last_frame). Not the previous clip's last frame. */
  endFrameUrl?: string;
  characterSheetUrl?: string;
  referenceImageUrls?: string[];
  aspectRatio?: string;
  durationSec?: number;
  model?: string;
  resolution?: string;
  productionId?: string;
  brandId?: string;
  shotIndex?: number;
  subclipIndex?: number;
  sourceImageAssetId?: string;
  mode?: string;
  imageUrls?: string[];
  videoUrls?: string[];
  audioUrls?: string[];
}

export interface ProductionVideoClipResult {
  videoUrl: string;
  storagePath?: string;
  lastFrameDataUrl?: string;
  provider: string;
  requestId?: string;
}

export function isI2vApiProvider(provider?: string): boolean {
  return Boolean(provider && I2V_API_PROVIDERS.has(provider.toLowerCase()));
}

export async function requestProductionVideoClip(
  params: ProductionVideoClipRequest
): Promise<ProductionVideoClipResult> {
  const normProvider = String(params.provider || "").toLowerCase();
  const isHf = normProvider === "higgsfield" || normProvider === "higgsfield-seedance";
  const isR2v =
    params.mode === "reference-to-video" ||
    params.mode === "r2v" ||
    params.model?.toLowerCase().includes("r2v") ||
    params.model?.toLowerCase().includes("reference-to-video");

  if (!isR2v && isI2vApiProvider(params.provider) && (!params.firstFrameUrl || !params.firstFrameUrl.trim())) {
    throw new Error(
      `Still required before motion. I2V video generation with provider "${params.provider}" requires a valid firstFrameUrl (shot still/keyframe).`
    );
  }

  if (!isR2v && isI2vApiProvider(params.provider) && params.firstFrameUrl && (looksLikeSheetOrGridUrl(params.firstFrameUrl) || looksLikeStoryboardGridUrl(params.firstFrameUrl))) {
    throw new Error(
      `Still required before motion. I2V video generation with provider "${params.provider}" requires this shot's still as firstFrameUrl, not a sheet or storyboard grid.`
    );
  }

  if (isHf) {
    if (params.firstFrameUrl?.startsWith("asset://")) {
      throw new Error(
        "Higgsfield Seedance I2V does not support asset:// URI scheme. A public HTTPS firstFrameUrl is required."
      );
    }

    if (params.firstFrameUrl?.startsWith("data:")) {
      try {
        const { ingestRemoteMediaToSpark } = await import("./ingestMediaToSpark");
        const prodId = params.productionId || "default-prod";
        const brandId = params.brandId || "default-brand";
        const storagePath = `brands/${brandId}/productions/${prodId}/keyframes/shot-${params.shotIndex || Date.now()}-still.png`;
        const ingested = await ingestRemoteMediaToSpark({
          url: params.firstFrameUrl,
          brandId,
          productionId: prodId,
          assetType: "frame",
          storagePath,
        });
        if (ingested?.publicUrl) {
          params.firstFrameUrl = ingested.publicUrl;
        }
      } catch (uploadErr) {
        console.warn("[requestProductionVideoClip] Pre-upload of Higgsfield firstFrame data URI notice:", uploadErr);
      }
    }

    if (params.endFrameUrl?.startsWith("data:")) {
      try {
        const { ingestRemoteMediaToSpark } = await import("./ingestMediaToSpark");
        const prodId = params.productionId || "default-prod";
        const brandId = params.brandId || "default-brand";
        const storagePath = `brands/${brandId}/productions/${prodId}/keyframes/shot-${params.shotIndex || Date.now()}-end.png`;
        const ingested = await ingestRemoteMediaToSpark({
          url: params.endFrameUrl,
          brandId,
          productionId: prodId,
          assetType: "frame",
          storagePath,
        });
        if (ingested?.publicUrl) {
          params.endFrameUrl = ingested.publicUrl;
        } else {
          params.endFrameUrl = undefined;
        }
      } catch (uploadErr) {
        console.warn("[requestProductionVideoClip] Pre-upload of Higgsfield endFrame data URI notice:", uploadErr);
        params.endFrameUrl = undefined;
      }
    }

    if (
      !params.firstFrameUrl ||
      (!params.firstFrameUrl.startsWith("http://") && !params.firstFrameUrl.startsWith("https://"))
    ) {
      throw new Error(
        `Higgsfield Seedance I2V requires a public HTTPS firstFrameUrl (received: ${params.firstFrameUrl ? params.firstFrameUrl.slice(0, 40) : "empty"}).`
      );
    }

    if (!isR2v && params.referenceImageUrls && params.referenceImageUrls.length > 0) {
      console.info(
        `[HF I2V Honesty] Higgsfield Seedance I2V only conditions on first frame (and optional end frame); ${params.referenceImageUrls.length} reference image(s) are baked into the still and not passed in the HF I2V API payload.`
      );
    }
  }

  // Fail-closed capability assertion: missing, unmapped, or disabled models reject before fetch
  assertVideoRequestExecutable(params);


  const res = await fetch("/api/runtime/video", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: params.provider,
      prompt: params.prompt,
      imageUrl: params.firstFrameUrl,
      firstFrameUrl: params.firstFrameUrl,
      sourceImageAssetId: params.sourceImageAssetId,
      // End-frame conditioning must NOT silently reuse the first frame.
      lastFrameUrl: params.lastFrameUrl || params.endFrameUrl,
      endFrameUrl: params.endFrameUrl || params.lastFrameUrl,
      characterSheetUrl: params.characterSheetUrl,
      referenceImageUrls: params.referenceImageUrls || [],
      aspectRatio: params.aspectRatio,
      durationSec: params.durationSec,
      model: params.model,
      resolution: params.resolution,
      productionId: params.productionId,
      brandId: params.brandId,
      shotIndex: params.shotIndex,
      subclipIndex: params.subclipIndex,
      mode: params.mode,
      imageUrls: params.imageUrls,
      videoUrls: params.videoUrls,
      audioUrls: params.audioUrls,
    }),
  });

  const data = await res.json().catch(() => ({} as Record<string, unknown>));
  if (!res.ok) {
    throw new Error(
      (typeof data.error === "string" && data.error) ||
        `Video adapter failed (${res.status})`
    );
  }
  // Explicit failure payloads must not be treated as successful generation
  // even when HTTP 200 is used (e.g. mux client-fallback responses).
  if (data && data.success === false) {
    throw new Error(
      (typeof data.error === "string" && data.error) ||
        (typeof data.message === "string" && data.message) ||
        "Video adapter reported success=false without a durable videoUrl"
    );
  }
  const videoUrl =
    (typeof data.videoUrl === "string" && data.videoUrl) ||
    (typeof data.publicUrl === "string" && data.publicUrl) ||
    "";
  if (!videoUrl) {
    throw new Error(
      (typeof data.error === "string" && data.error) ||
        "Video adapter returned no videoUrl"
    );
  }
  const storagePath = typeof data.storagePath === "string" ? data.storagePath : undefined;
  const looksSpark =
    /\/storage\/v1\/object\/(?:sign|public)\/Spark\//i.test(videoUrl) ||
    Boolean(storagePath && storagePath.startsWith("brands/"));
  // Provider URLs (e.g. vidgen.x.ai) are kept as playable preview while background ingest copies bytes to Spark.
  return {
    videoUrl,
    storagePath,
    lastFrameDataUrl:
      typeof data.lastFrameDataUrl === "string" ? data.lastFrameDataUrl : undefined,
    provider: (typeof data.provider === "string" && data.provider) || params.provider,
    requestId:
      (typeof data.requestId === "string" && data.requestId) ||
      (typeof data.request_id === "string" && data.request_id) ||
      (typeof data.id === "string" && data.id) ||
      undefined,
  };
}
