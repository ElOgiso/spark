/**
 * Google Veo Payload Translator for Provider Payload Compiler.
 *
 * Wire format (Vertex AI / Gemini Video endpoint):
 * - instances: [{ prompt, image, lastFrame }]
 * - parameters: { aspectRatio: "16:9" | "9:16", sampleCount: 1, durationSeconds: 4 | 6 | 8 }
 * Note: durationSeconds must be 8 when lastFrame is present.
 */

import type { IProviderPayloadTranslator, ProviderPayloadCompilationRequest, CompiledMediaInput, NormalizedGenerationParameters } from "../types";
import { snapVeoDuration } from "../../../../../../api/runtime/_videoContract";

export class VeoPayloadTranslator implements IProviderPayloadTranslator {
  providerId = "google";

  supports(modelId: string): boolean {
    return modelId.toLowerCase().includes("veo");
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
    const model = request.modelId || "veo-2-0";

    const firstFrameInput = mediaInputs.find((m) => m.role === "first_frame");
    const lastFrameInput = mediaInputs.find((m) => m.role === "last_frame");

    const isI2v = Boolean(firstFrameInput?.url);
    const operation = isI2v ? "image_to_video" : "text_to_video";

    const hasLastFrame = Boolean(lastFrameInput?.url);
    const durationSeconds = snapVeoDuration(normalizedParams.durationSec, { hasLastFrame });

    const instance: Record<string, unknown> = {
      prompt,
    };

    if (firstFrameInput?.url) {
      instance.image = { imageBytes: firstFrameInput.url };
    }

    if (lastFrameInput?.url) {
      instance.lastFrame = { imageBytes: lastFrameInput.url };
    }

    const aspectRatio = normalizedParams.aspectRatio === "16:9" ? "16:9" : "9:16";

    const rawPayload: Record<string, unknown> = {
      instances: [instance],
      parameters: {
        aspectRatio,
        sampleCount: 1,
        durationSeconds,
      },
    };

    return {
      operation,
      rawPayload,
      parameters: {
        model,
        aspectRatio,
        durationSeconds,
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
