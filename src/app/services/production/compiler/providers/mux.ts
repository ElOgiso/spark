/**
 * Mux Video Merge/Edit Payload Translator for Provider Payload Compiler.
 */

import type { IProviderPayloadTranslator, ProviderPayloadCompilationRequest, CompiledMediaInput, NormalizedGenerationParameters } from "../types";

export class MuxPayloadTranslator implements IProviderPayloadTranslator {
  providerId = "mux";

  supports(modelId: string): boolean {
    return modelId.toLowerCase().includes("mux") || modelId.toLowerCase().includes("merge");
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
    const { mediaInputs } = intermediates;
    const model = request.modelId || "mux-concat-v1";

    const videoInputs = mediaInputs.filter((m) => m.role === "source_video" || m.url.endsWith(".mp4"));

    const rawPayload: Record<string, unknown> = {
      model,
      inputs: videoInputs.map((v) => ({ url: v.url })),
    };

    return {
      operation: "merge",
      rawPayload,
      parameters: {
        model,
        inputCount: videoInputs.length,
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
