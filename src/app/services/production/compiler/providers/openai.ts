/**
 * OpenAI / Image Still Payload Translator for Provider Payload Compiler.
 *
 * Wire format for DALL-E / Imagen / Still generation:
 * - prompt: string
 * - model: string (e.g. dall-e-3)
 * - size: resolution mapping ("1024x1024", "1024x1792", etc.)
 * - quality: "standard" | "hd"
 */

import type { IProviderPayloadTranslator, ProviderPayloadCompilationRequest, CompiledMediaInput, NormalizedGenerationParameters } from "../types";

export class OpenAIPayloadTranslator implements IProviderPayloadTranslator {
  providerId = "openai";

  supports(modelId: string): boolean {
    return modelId.toLowerCase().includes("dall") || modelId.toLowerCase().includes("openai");
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
    const { prompt, normalizedParams } = intermediates;
    const model = request.modelId || "dall-e-3";

    let size = "1024x1024";
    if (normalizedParams.aspectRatio === "9:16") {
      size = "1024x1792";
    } else if (normalizedParams.aspectRatio === "16:9") {
      size = "1792x1024";
    }

    const rawPayload: Record<string, unknown> = {
      model,
      prompt,
      n: 1,
      size,
      quality: "hd",
      response_format: "url",
    };

    return {
      operation: "text_to_image",
      rawPayload,
      parameters: {
        model,
        size,
        quality: "hd",
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
