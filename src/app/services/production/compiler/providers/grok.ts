/**
 * Grok (xAI) Payload Translator for Provider Payload Compiler.
 *
 * Wire format:
 * - model: grok-imagine-video-1.5
 * - prompt: clamped to <= 4096 chars (safety max 4000)
 * - image: { url } (stillUrl)
 * - last_frame: { url } (optional)
 * - reference_images: Array<{ url }> (max 7, forces 720p)
 * - aspect_ratio: "9:16" | "16:9" | "1:1" | etc.
 * - duration: integer 1-15
 * - resolution: "480p" | "720p" | "1080p"
 */

import type { IProviderPayloadTranslator, ProviderPayloadCompilationRequest, CompiledMediaInput, NormalizedGenerationParameters } from "../types";
import { clampGrokVideoPrompt } from "../../../../../../api/runtime/_videoContract";

export class GrokPayloadTranslator implements IProviderPayloadTranslator {
  providerId = "grok";

  supports(modelId: string): boolean {
    return modelId.toLowerCase().includes("grok");
  }

  translate(
    request: ProviderPayloadCompilationRequest,
    intermediates: {
      prompt: string;
      negativePrompt?: string;
      mediaInputs: CompiledMediaInput[];
      normalizedParams: NormalizedGenerationParameters;
    }
  ) {
    const { prompt, mediaInputs, normalizedParams } = intermediates;
    const model = request.modelId || "grok-imagine-video-1.5";

    const firstFrameInput = mediaInputs.find((m) => m.role === "first_frame");
    const lastFrameInput = mediaInputs.find((m) => m.role === "last_frame");

    const isI2v = Boolean(firstFrameInput?.url);
    const operation = isI2v ? "image_to_video" : "text_to_video";

    let resolution = normalizedParams.resolution as "480p" | "720p" | "1080p";

    const clampedPrompt = clampGrokVideoPrompt(prompt, 4000);

    const rawPayload: Record<string, unknown> = {
      model,
      prompt: clampedPrompt,
      duration: Math.max(1, Math.min(15, Math.round(normalizedParams.durationSec || 5))),
      aspect_ratio: normalizedParams.aspectRatio,
      resolution,
    };

    if (firstFrameInput?.url) {
      rawPayload.image = { url: firstFrameInput.url };
      rawPayload.image_url = firstFrameInput.url;
    }

    if (lastFrameInput?.url) {
      rawPayload.last_frame = { url: lastFrameInput.url };
    }

    const refInputs = mediaInputs.filter(
      (m) => m.role === "reference_image" || m.role === "character_reference" || m.role === "style_reference"
    );

    if (refInputs.length > 0) {
      rawPayload.reference_images = refInputs.slice(0, 7).map((r) => ({ url: r.url }));
      // In Grok API, reference_images force 720p
      resolution = "720p";
      rawPayload.resolution = resolution;
    }

    return {
      operation,
      rawPayload,
      parameters: {
        model,
        duration: rawPayload.duration,
        aspect_ratio: rawPayload.aspect_ratio,
        resolution: rawPayload.resolution,
      },
      validation: {
        valid: true,
        errors: [],
        warnings: [],
        degradedFeatures: [],
      },
    };
  }
}
