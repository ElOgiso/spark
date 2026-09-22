/**
 * ElevenLabs Audio/Voice Payload Translator for Provider Payload Compiler.
 *
 * Wire format for TTS generation:
 * - text: prompt (or dialogue/narration)
 * - model_id: eleven_multilingual_v2
 * - voice_settings: stability, similarity_boost
 */

import type { IProviderPayloadTranslator, ProviderPayloadCompilationRequest, CompiledMediaInput, NormalizedGenerationParameters } from "../types";

export class ElevenLabsPayloadTranslator implements IProviderPayloadTranslator {
  providerId = "elevenlabs";

  supports(modelId: string): boolean {
    return modelId.toLowerCase().includes("eleven") || modelId.toLowerCase().includes("voice");
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
    const { prompt } = intermediates;
    const model = request.modelId || "eleven_multilingual_v2";

    const textToSpeak = request.shot.dialogue || request.shot.narration || prompt;

    const rawPayload: Record<string, unknown> = {
      text: textToSpeak,
      model_id: model,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    };

    return {
      operation: "text_to_speech",
      rawPayload,
      parameters: {
        model,
        voice_settings: rawPayload.voice_settings,
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
