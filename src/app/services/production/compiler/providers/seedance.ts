/**
 * Seedance (ByteDance / Ark) Payload Translator for Provider Payload Compiler.
 *
 * Wire format:
 * - model: e.g. doubao-seedance-1-5-pro-251215 or doubao-seedance-2-0-260128
 * - content: structured array of { type: "text" | "image_url", role?: "first_frame" | "last_frame" | "reference_image" }
 * - ratio, duration, resolution, generate_audio
 *
 * Invariant: Seedance 2.0 cannot mix first/last frame pair with reference media.
 */

import type { IProviderPayloadTranslator, ProviderPayloadCompilationRequest, CompiledMediaInput, NormalizedGenerationParameters } from "../types";

export class SeedancePayloadTranslator implements IProviderPayloadTranslator {
  providerId = "seedance";

  supports(modelId: string): boolean {
    return modelId.toLowerCase().includes("seedance") || modelId.toLowerCase().includes("doubao");
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
    const model = request.modelId || "doubao-seedance-1-5-pro-251215";
    const is20 = /seedance-2|doubao-seedance-2/i.test(model);

    const firstFrameInput = mediaInputs.find((m) => m.role === "first_frame");
    const lastFrameInput = mediaInputs.find((m) => m.role === "last_frame");
    const isI2v = Boolean(firstFrameInput?.url);
    const operation = isI2v ? "image_to_video" : "text_to_video";

    const content: Array<Record<string, unknown>> = [
      { type: "text", text: prompt },
    ];

    if (firstFrameInput?.url) {
      content.push({
        type: "image_url",
        image_url: { url: firstFrameInput.url },
        role: "first_frame",
      });
    }

    if (lastFrameInput?.url) {
      content.push({
        type: "image_url",
        image_url: { url: lastFrameInput.url },
        role: "last_frame",
      });
    }

    const hasFramePair = Boolean(firstFrameInput?.url || lastFrameInput?.url);
    const warnings: string[] = [];
    const degradedFeatures: string[] = [];

    const refInputs = mediaInputs.filter(
      (m) => m.role === "reference_image" || m.role === "character_reference" || m.role === "style_reference"
    );

    if (is20 && hasFramePair && refInputs.length > 0) {
      warnings.push("SEEDANCE_20_FRAME_REFERENCE_CONFLICT: Seedance 2.0 does not support reference images alongside first/last frame; references omitted from payload.");
      degradedFeatures.push("REFERENCE_IMAGES_DEGRADED");
    } else {
      for (const r of refInputs.slice(0, 9)) {
        content.push({
          type: "image_url",
          image_url: { url: r.url },
          role: "reference_image",
        });
      }
    }

    const rawPayload: Record<string, unknown> = {
      model,
      content,
      ratio: normalizedParams.aspectRatio,
      duration: normalizedParams.durationSec || 5,
      resolution: normalizedParams.resolution,
      generate_audio: normalizedParams.generateAudio !== false,
      watermark: false,
    };

    return {
      operation,
      rawPayload,
      parameters: {
        model,
        ratio: rawPayload.ratio,
        duration: rawPayload.duration,
        resolution: rawPayload.resolution,
        generate_audio: rawPayload.generate_audio,
      },
      validation: {
        valid: true,
        errors: [],
        warnings,
        degradedFeatures,
      },
    };
  }
}
