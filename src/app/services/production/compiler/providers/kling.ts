/**
 * Kling Payload Translator for Provider Payload Compiler.
 *
 * Translates compiled intermediates into exact Kling wire payload format.
 * Reuses tested contracts:
 * - duration: "5" or "10" string
 * - mode: "std" or "pro" (end frame / image_tail forces pro mode)
 * - image_tail: accepted on turbo / v2.6 in pro mode
 * - image_list: supported for multi-image models (e.g. v3-omni)
 */

import type { IProviderPayloadTranslator, ProviderPayloadCompilationRequest, CompiledMediaInput, NormalizedGenerationParameters } from "../types";
import { klingSupportsImageTail } from "../../../../../../api/runtime/_videoContract";

export class KlingPayloadTranslator implements IProviderPayloadTranslator {
  providerId = "kling";

  supports(modelId: string): boolean {
    return modelId.toLowerCase().includes("kling");
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
    const model = request.modelId || "kling-v2-6";

    const firstFrameInput = mediaInputs.find((m) => m.role === "first_frame");
    const lastFrameInput = mediaInputs.find((m) => m.role === "last_frame");
    const hasTail = Boolean(lastFrameInput?.url);

    const isI2v = Boolean(firstFrameInput?.url);
    const operation = isI2v ? "image_to_video" : "text_to_video";

    const mode = hasTail ? "pro" : normalizedParams.klingMode || "std";

    const rawPayload: Record<string, unknown> = {
      model_name: model,
      mode,
      duration: normalizedParams.durationString || "5",
      aspect_ratio: normalizedParams.aspectRatio,
      sound: normalizedParams.klingSound === "off" ? "off" : "on",
      prompt,
      negative_prompt: negativePrompt || "",
    };

    if (firstFrameInput?.url) {
      rawPayload.image = firstFrameInput.url;
    }

    if (hasTail) {
      if (klingSupportsImageTail(model, mode)) {
        rawPayload.image_tail = lastFrameInput!.url;
      }
    }

    // Multi-reference handling for Kling Omni / multi-ref
    const refInputs = mediaInputs.filter(
      (m) => m.role === "reference_image" || m.role === "character_reference"
    );
    if (refInputs.length > 0) {
      rawPayload.image_list = refInputs.slice(0, 4).map((r) => ({ image: r.url }));
    }

    return {
      operation,
      rawPayload,
      parameters: {
        model,
        mode,
        duration: rawPayload.duration,
        aspect_ratio: rawPayload.aspect_ratio,
        sound: rawPayload.sound,
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
