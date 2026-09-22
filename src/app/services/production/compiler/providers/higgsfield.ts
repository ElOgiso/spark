/**
 * Higgsfield Payload Translator for Provider Payload Compiler.
 *
 * Wire format:
 * - prompt (string)
 * - image_url (string, required public HTTPS still)
 * - end_image_url (string, optional end frame)
 * - duration (number, 4-30 for 2.5, 4-15 for 2.0)
 * - resolution ("480p" | "720p" | "1080p" | "4k")
 * - generate_audio (boolean)
 * - output_format ("mp4" for 2.5, omitted for 2.0)
 */

import type { IProviderPayloadTranslator, ProviderPayloadCompilationRequest, CompiledMediaInput, NormalizedGenerationParameters } from "../types";

export class HiggsfieldPayloadTranslator implements IProviderPayloadTranslator {
  providerId = "higgsfield";

  supports(modelId: string): boolean {
    return modelId.toLowerCase().includes("higgsfield");
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
    const model = request.modelId || "higgsfield-seedance-2-5";
    const is20 = model.toLowerCase().includes("2.0");

    const firstFrameInput = mediaInputs.find((m) => m.role === "first_frame");
    const lastFrameInput = mediaInputs.find((m) => m.role === "last_frame");

    const isI2v = Boolean(firstFrameInput?.url);
    const operation = isI2v ? "image_to_video" : "text_to_video";

    const maxDur = is20 ? 15 : 30;
    const dur = Math.max(4, Math.min(maxDur, Math.round(normalizedParams.durationSec || 5)));

    const rawPayload: Record<string, unknown> = {
      prompt,
      duration: dur,
      resolution: normalizedParams.resolution,
      generate_audio: normalizedParams.generateAudio !== false,
      ...(!is20 ? { output_format: "mp4" } : {}),
    };

    if (firstFrameInput?.url) {
      rawPayload.image_url = firstFrameInput.url;
    }

    if (lastFrameInput?.url) {
      rawPayload.end_image_url = lastFrameInput.url;
    }

    return {
      operation,
      rawPayload,
      parameters: {
        model,
        duration: rawPayload.duration,
        resolution: rawPayload.resolution,
        generate_audio: rawPayload.generate_audio,
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
