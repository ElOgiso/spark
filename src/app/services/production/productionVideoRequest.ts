/**
 * Production I2V request: sends first-frame, end-frame, and identity refs
 * to /api/runtime/video so last-frame continuity actually reaches the adapter.
 */

export const I2V_API_PROVIDERS = new Set(["grok", "kling", "seedance", "ark", "xai"]);

export interface ProductionVideoClipRequest {
  provider: string;
  prompt: string;
  firstFrameUrl?: string;
  /** Desired end pose for this clip (Kling image_tail / Seedance last_frame). Not the previous clip's last frame. */
  endFrameUrl?: string;
  referenceImageUrls?: string[];
  aspectRatio?: string;
  durationSec?: number;
  model?: string;
  resolution?: string;
  productionId?: string;
  brandId?: string;
}

export interface ProductionVideoClipResult {
  videoUrl: string;
  lastFrameDataUrl?: string;
  provider: string;
}

export function isI2vApiProvider(provider?: string): boolean {
  return Boolean(provider && I2V_API_PROVIDERS.has(provider.toLowerCase()));
}

export async function requestProductionVideoClip(
  params: ProductionVideoClipRequest
): Promise<ProductionVideoClipResult> {
  const res = await fetch("/api/runtime/video", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: params.provider,
      prompt: params.prompt,
      imageUrl: params.firstFrameUrl,
      firstFrameUrl: params.firstFrameUrl,
      lastFrameUrl: params.firstFrameUrl,
      endFrameUrl: params.endFrameUrl,
      referenceImageUrls: params.referenceImageUrls || [],
      aspectRatio: params.aspectRatio,
      durationSec: params.durationSec,
      model: params.model,
      resolution: params.resolution,
      productionId: params.productionId,
      brandId: params.brandId,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Video adapter failed (${res.status})`);
  }
  const videoUrl = data.videoUrl || data.publicUrl || "";
  if (!videoUrl) {
    throw new Error(data.error || "Video adapter returned no videoUrl");
  }
  return {
    videoUrl,
    lastFrameDataUrl: typeof data.lastFrameDataUrl === "string" ? data.lastFrameDataUrl : undefined,
    provider: data.provider || params.provider,
  };
}
