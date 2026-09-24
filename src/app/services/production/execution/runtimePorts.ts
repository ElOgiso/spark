import { runtimeFetch } from "../../../backend/runtimeFetch";
/**
 * Optional runtime ports that wrap existing Spark integrations.
 * Used by productionService — unit tests inject mocks instead.
 */

import type { AdapterPorts } from "./adapters/types";
import type { ProviderGenerationRequest } from "./types";

/**
 * Best-effort ports for browser/runtime execution.
 * Video I2V adapters already call requestProductionVideoClip by default.
 * Image/voice/merge require these ports when not injected by tests.
 */
export function createRuntimeAdapterPorts(): AdapterPorts {
  return {
    async submitImage(request: ProviderGenerationRequest) {
      // Prefer ModelRouter storyboard path when available
      try {
        const { ModelRouter } = await import("../../runtime/modelRouter");
        const result: any = await ModelRouter.executeCategoryRequest("storyboardImages", {
          prompt: request.prompt,
          aspectRatio: request.aspectRatio,
        } as any);
        const imageUrl =
          result?.imageUrl ||
          result?.url ||
          result?.images?.[0]?.url ||
          result?.data?.[0]?.url;
        if (!imageUrl) {
          throw new Error("Image provider returned no url");
        }
        return {
          imageUrl: String(imageUrl),
          providerJobId: `img_${request.executionId}`,
          provider: request.providerId,
        };
      } catch (err: any) {
        throw new Error(err?.message || "Image generation unavailable");
      }
    },

    async submitVoice(request: ProviderGenerationRequest) {
      try {
        const { generateElevenLabsVoice } = await import("../../runtime/providers/elevenLabsTTS");
        const result: any = await generateElevenLabsVoice({
          text: request.prompt,
        } as any);
        const audioUrl = result?.audioUrl || result?.url;
        if (!audioUrl) throw new Error("Voice provider returned no url");
        return {
          audioUrl: String(audioUrl),
          providerJobId: `voice_${request.executionId}`,
          durationSec: result?.durationSec,
          provider: "elevenlabs",
        };
      } catch (err: any) {
        throw new Error(err?.message || "Voice generation unavailable");
      }
    },

    async submitMerge(request: ProviderGenerationRequest) {
      if (request.inputs.some(input => input.visualPlan || input.mimeType?.startsWith("image/"))) {
        const { compileMixedVisualVideo } = await import("../narratorVideoCompiler");
        const { renderVisualGraphic } = await import("../generation/visualMedia");
        const { resolveAspectDimensions } = await import("../editorial/variants");
        const { ProductionAssetService } = await import("../productionAssetService");
        const visualInputs = request.inputs.filter(input => input.role !== "audio");
        const clips = await Promise.all(visualInputs.map(async input => {
          if (!input.url || !input.durationSec) throw new Error("Mixed master input is missing source or timing");
          const steps = input.visualPlan?.kind === "MOTION_GRAPHIC" && !input.visualPlan.source ? input.visualPlan.graphic?.steps : undefined;
          const animationFrames = steps ? await Promise.all(steps.map((_, i) => renderVisualGraphic({ id: input.assetRef || "graphic", durationSec: input.durationSec!, visualPlan: input.visualPlan }, (i + 1) / steps.length))) : undefined;
          return { url: input.url, mediaType: input.mimeType?.startsWith("image/") ? "image" as const : "video" as const,
            durationSec: input.durationSec, animationFrames };
        }));
        const result = await compileMixedVisualVideo({ clips, audioUrl: request.inputs.find(i => i.role === "audio")?.url,
          ...resolveAspectDimensions(request.aspectRatio || "9:16") });
        const stored = await ProductionAssetService.uploadAssetToStorage({ productionId: request.productionId,
          brandId: request.brandId, assetType: "video", storagePath: `${request.productionId}/video/master.${result.extension}`,
          dataUrlOrBlob: result.blob, mimeType: result.mimeType, provider: "NarratorHybridCompiler" });
        if (!stored?.publicUrl) throw new Error("Mixed master storage failed");
        return { videoUrl: stored.publicUrl, providerJobId: `mux_${request.executionId}`, provider: "mux", mimeType: result.mimeType, durationSec: result.durationSec };
      }
      const videoUrls = request.inputs.filter((i) => i.role === "source_video" && i.url).map((i) => i.url!);
      if (!videoUrls.length) throw new Error("Merge requires source videos");
      const res = await runtimeFetch("/api/runtime/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "mux",
          action: "mux",
          videoUrls,
          productionId: request.productionId,
          brandId: request.brandId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Mux failed (${res.status})`);
      const videoUrl = data.videoUrl || data.publicUrl;
      if (!videoUrl) throw new Error("Mux returned no videoUrl");
      if (
        /vidgen\.x\.ai|generativelanguage\.googleapis|fal\.media/i.test(String(videoUrl)) ||
        !/\/storage\/v1\/object\/(?:sign|public)\/Spark\//i.test(String(videoUrl))
      ) {
        throw new Error("Mux returned a non-Spark videoUrl — persist failed");
      }
      return {
        videoUrl: String(videoUrl),
        providerJobId: `mux_${request.executionId}`,
        provider: "mux",
      };
    },
  };
}
