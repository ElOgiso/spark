/**
 * Generic Fallback Payload Translator for Provider Payload Compiler.
 */

import type { IProviderPayloadTranslator, ProviderPayloadCompilationRequest, CompiledMediaInput, NormalizedGenerationParameters } from "../types";

export class GenericPayloadTranslator implements IProviderPayloadTranslator {
  providerId = "generic";

  supports(): boolean {
    return true;
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
    const { prompt, negativePrompt, mediaInputs, normalizedParams } = intermediates;
    const model = request.modelId || "standard";

    const firstFrameInput = mediaInputs.find((m) => m.role === "first_frame");
    const isI2v = Boolean(firstFrameInput?.url);
    const operation = isI2v ? "image_to_video" : "text_to_video";

    const rawPayload: Record<string, unknown> = {
      model,
      prompt,
      negative_prompt: negativePrompt,
      duration: normalizedParams.durationSec,
      aspect_ratio: normalizedParams.aspectRatio,
      resolution: normalizedParams.resolution,
    };

    if (firstFrameInput?.url) {
      rawPayload.first_frame_url = firstFrameInput.url;
    }

    const lastFrameInput = mediaInputs.find((m) => m.role === "last_frame");
    if (lastFrameInput?.url) {
      rawPayload.last_frame_url = lastFrameInput.url;
    }

    const refs = mediaInputs.filter((m) => m.role === "reference_image" || m.role === "character_reference");
    if (refs.length > 0) {
      rawPayload.reference_urls = refs.map((r) => r.url);
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
