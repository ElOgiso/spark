import type { AICapabilityType, AIProviderId, AIRoutingCategory } from "../../domain/types";

export type ModelCapability =
  | "Chat"
  | "Image Generation"
  | "Video Generation"
  | "Text To Speech"
  | "Vision"
  | "Video Understanding"
  | "Reasoning";

export interface ProviderModel {
  id: string;           // exact API model string
  label: string;        // UI label
  capabilities: ModelCapability[];
  recommended?: boolean;
  status?: "stable" | "preview" | "deprecated";
}

export interface ProviderCatalog {
  provider: AIProviderId;
  displayName: string;
  models: ProviderModel[];
}

export const CATALOG_VERSION = "2026.08.1";

/**
 * Single source of truth for all AI Provider models in SPARK.
 * Adding a row here automatically makes it appear in AI Preferences UI across Desktop and Mobile.
 */
export const MODEL_CATALOG: ProviderCatalog[] = [
  {
    provider: "openai",
    displayName: "OpenAI",
    models: [
      // Flagship 2026 Chat / Reasoning
      {
        id: "gpt-5.6",
        label: "GPT-5.6 (Flagship Alias)",
        capabilities: ["Chat", "Reasoning", "Vision", "Video Understanding"],
        recommended: true,
        status: "stable",
      },
      {
        id: "gpt-5.6-sol",
        label: "GPT-5.6 Sol (Deep Reasoning & Executive)",
        capabilities: ["Chat", "Reasoning", "Vision", "Video Understanding"],
        status: "stable",
      },
      {
        id: "gpt-5.6-terra",
        label: "GPT-5.6 Terra (Balanced Production)",
        capabilities: ["Chat", "Reasoning", "Vision", "Video Understanding"],
        status: "stable",
      },
      {
        id: "gpt-5.6-luna",
        label: "GPT-5.6 Luna (High Volume / Fast)",
        capabilities: ["Chat", "Reasoning", "Vision", "Video Understanding"],
        status: "stable",
      },
      {
        id: "gpt-4o",
        label: "GPT-4o (Omni Fallback)",
        capabilities: ["Chat", "Reasoning", "Vision", "Video Understanding"],
        status: "deprecated",
      },
      {
        id: "gpt-4o-mini",
        label: "GPT-4o Mini (Lightweight)",
        capabilities: ["Chat", "Reasoning", "Vision", "Video Understanding"],
        status: "deprecated",
      },
      // Image Generation
      {
        id: "gpt-image-1.5",
        label: "GPT Image 1.5 (High Fidelity 9:16)",
        capabilities: ["Image Generation"],
        recommended: true,
        status: "stable",
      },
      {
        id: "gpt-image-1",
        label: "GPT Image 1.0 (Standard)",
        capabilities: ["Image Generation"],
        status: "stable",
      },
      {
        id: "dall-e-3",
        label: "DALL-E 3 (Legacy)",
        capabilities: ["Image Generation"],
        status: "deprecated",
      },
      // Voice / TTS
      {
        id: "gpt-4o-mini-tts",
        label: "GPT-4o Mini TTS (Super Spark Voice)",
        capabilities: ["Text To Speech"],
        recommended: true,
        status: "stable",
      },
      {
        id: "tts-1",
        label: "OpenAI TTS-1",
        capabilities: ["Text To Speech"],
        status: "stable",
      },
      {
        id: "tts-1-hd",
        label: "OpenAI TTS-1 HD",
        capabilities: ["Text To Speech"],
        status: "stable",
      },
    ],
  },
  {
    provider: "claude",
    displayName: "Anthropic Claude",
    models: [
      {
        id: "claude-sonnet-5",
        label: "Claude Sonnet 5 (Best Balance & Review)",
        capabilities: ["Chat", "Reasoning", "Vision", "Video Understanding"],
        recommended: true,
        status: "stable",
      },
      {
        id: "claude-fable-5",
        label: "Claude Fable 5 (Creative & Narrative)",
        capabilities: ["Chat", "Reasoning", "Vision", "Video Understanding"],
        status: "stable",
      },
      {
        id: "claude-opus-5",
        label: "Claude Opus 5 (Maximum Intelligence)",
        capabilities: ["Chat", "Reasoning", "Vision", "Video Understanding"],
        status: "stable",
      },
      {
        id: "claude-haiku-4-5",
        label: "Claude Haiku 4.5 (High Speed)",
        capabilities: ["Chat", "Reasoning", "Vision", "Video Understanding"],
        status: "stable",
      },
      {
        id: "claude-3-5-sonnet-20241022",
        label: "Claude 3.5 Sonnet (Legacy Fallback)",
        capabilities: ["Chat", "Reasoning", "Vision", "Video Understanding"],
        status: "deprecated",
      },
    ],
  },
  {
    provider: "gemini",
    displayName: "Google Gemini",
    models: [
      {
        id: "gemini-2.5-flash",
        label: "Gemini 2.5 Flash (Flagship Speed)",
        capabilities: ["Chat", "Reasoning", "Vision", "Video Understanding"],
        recommended: true,
        status: "stable",
      },
      {
        id: "gemini-2.5-pro",
        label: "Gemini 2.5 Pro (Deep Multimodal)",
        capabilities: ["Chat", "Reasoning", "Vision", "Video Understanding"],
        status: "stable",
      },
      {
        id: "gemini-2.0-flash",
        label: "Gemini 2.0 Flash",
        capabilities: ["Chat", "Reasoning", "Vision", "Video Understanding"],
        status: "stable",
      },
      // Image Generation
      {
        id: "imagen-4.0-generate-001",
        label: "Google Imagen 4.0 (9:16 Portrait)",
        capabilities: ["Image Generation"],
        recommended: true,
        status: "stable",
      },
      {
        id: "imagen-3.0-generate-002",
        label: "Google Imagen 3.0",
        capabilities: ["Image Generation"],
        status: "stable",
      },
      {
        id: "gemini-2.0-flash-exp-image",
        label: "Gemini Native Image Preview",
        capabilities: ["Image Generation"],
        status: "preview",
      },
      // Video Generation
      {
        id: "veo-3.1-generate-preview",
        label: "Google Veo 3.1 (9:16 Vertical Video)",
        capabilities: ["Video Generation"],
        recommended: true,
        status: "stable",
      },
      {
        id: "veo-2.0-generate-001",
        label: "Google Veo 2.0",
        capabilities: ["Video Generation"],
        status: "stable",
      },
      // Voice / TTS
      {
        id: "gemini-2.0-flash-tts",
        label: "Gemini Aoede TTS",
        capabilities: ["Text To Speech"],
        status: "stable",
      },
    ],
  },
  {
    provider: "grok",
    displayName: "xAI Grok",
    models: [
      {
        id: "grok-4.5",
        label: "Grok 4.5 (Flagship Reasoning & Vision)",
        capabilities: ["Chat", "Reasoning", "Vision", "Video Understanding"],
        recommended: true,
        status: "stable",
      },
      {
        id: "grok-beta",
        label: "Grok Beta (Fast)",
        capabilities: ["Chat", "Reasoning", "Vision", "Video Understanding"],
        status: "stable",
      },
      {
        id: "grok-2-vision-1212",
        label: "Grok 2 Vision",
        capabilities: ["Chat", "Vision", "Video Understanding"],
        status: "stable",
      },
      // Image Generation
      {
        id: "grok-imagine-image-quality",
        label: "Grok Imagine Image Quality (9:16)",
        capabilities: ["Image Generation"],
        recommended: true,
        status: "stable",
      },
      {
        id: "grok-imagine-image",
        label: "Grok Imagine Image Standard",
        capabilities: ["Image Generation"],
        status: "stable",
      },
      // Video Generation
      {
        id: "grok-imagine-video",
        label: "Grok Imagine Video (9:16 Master Preview)",
        capabilities: ["Video Generation"],
        recommended: true,
        status: "stable",
      },
      // Voice / TTS
      {
        id: "grok-tts-eve",
        label: "xAI Grok TTS (Eve Voice)",
        capabilities: ["Text To Speech"],
        recommended: true,
        status: "stable",
      },
    ],
  },
  {
    provider: "kling",
    displayName: "Kling AI",
    models: [
      {
        id: "kling-v1-6",
        label: "Kling 1.6 Image2Video",
        capabilities: ["Video Generation"],
        status: "stable",
      },
      {
        id: "kling-v2-6",
        label: "Kling 2.6 Pro (image_tail)",
        capabilities: ["Video Generation"],
        recommended: true,
        status: "stable",
      },
      {
        id: "kling-v3-omni",
        label: "Kling v3 Omni (R2V identity, max 4)",
        capabilities: ["Video Generation"],
        status: "preview",
      },
    ],
  },
  {
    provider: "seedance",
    displayName: "Seedance",
    models: [
      {
        id: "doubao-seedance-1-5-pro-251215",
        label: "Seedance 1.5 Pro (first/last/reference frames)",
        capabilities: ["Video Generation"],
        recommended: true,
        status: "stable",
      },
      {
        id: "doubao-seedance-2-0-260128",
        label: "Seedance 2.0 (first/last frame, no mixed refs)",
        capabilities: ["Video Generation"],
        status: "preview",
      },
    ],
  },
  {
    provider: "elevenlabs",
    displayName: "ElevenLabs",
    models: [
      {
        id: "eleven_multilingual_v2",
        label: "Eleven Multilingual v2 (Production Voiceover)",
        capabilities: ["Text To Speech"],
        recommended: true,
        status: "stable",
      },
      {
        id: "eleven_turbo_v2_5",
        label: "Eleven Turbo v2.5 (Fast Narration)",
        capabilities: ["Text To Speech"],
        status: "stable",
      },
      {
        id: "eleven_monolingual_v1",
        label: "Eleven Monolingual v1 (Legacy)",
        capabilities: ["Text To Speech"],
        status: "deprecated",
      },
    ],
  },
];

/**
 * Filter models for a provider that support the specified capability.
 */
export function getModelsForProviderAndCapability(
  provider: AIProviderId,
  capability?: AICapabilityType
): ProviderModel[] {
  const prov = MODEL_CATALOG.find((p) => p.provider === provider);
  if (!prov) return [];
  if (!capability) return prov.models;

  return prov.models.filter((m) => {
    if (capability === "Chat" || capability === "Reasoning") {
      return m.capabilities.includes("Chat") || m.capabilities.includes("Reasoning");
    }
    if (capability === "Vision" || capability === "Video Understanding") {
      return m.capabilities.includes("Vision") || m.capabilities.includes("Video Understanding") || m.capabilities.includes("Chat");
    }
    return m.capabilities.includes(capability as ModelCapability);
  });
}

/**
 * Get the recommended model for a provider and capability.
 */
export function getRecommendedModel(
  provider: AIProviderId,
  capability?: AICapabilityType
): ProviderModel | undefined {
  const models = getModelsForProviderAndCapability(provider, capability);
  return models.find((m) => m.recommended) || models[0];
}

/**
 * Resolve human-readable label for a model ID.
 */
export function getModelLabel(provider: AIProviderId, modelId: string): string {
  const prov = MODEL_CATALOG.find((p) => p.provider === provider);
  if (!prov) return modelId;
  const match = prov.models.find((m) => m.id === modelId);
  return match?.label || modelId;
}
