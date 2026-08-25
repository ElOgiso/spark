import type { AICapabilityType, AIProviderId, AIModelRoutingConfig } from "../../domain/types";
import { resolveProviderKey } from "./AIProviderOrchestrator";

export type ConcreteAIProviderId = Exclude<AIProviderId, "auto">;

export interface ProviderCapabilityProfile {
  providerId: ConcreteAIProviderId;
  displayName: string;
  capabilities: AICapabilityType[];
  maxVideoDurationSec?: number; // native single-shot peak quality limit (seconds)
  supportsImageRefs?: boolean;
  supportsNativeAudio?: boolean;
  notes: string;
}

/**
 * Single source of truth for AI Provider Physics & Capabilities in SPARK.
 * Scene planners, media compilers, and router engines read real max durations and modalities from here.
 */
export const PROVIDER_CAPABILITY_MAP: Record<ConcreteAIProviderId, ProviderCapabilityProfile> = {
  gemini: {
    providerId: "gemini",
    displayName: "Google Gemini / Veo",
    capabilities: ["Chat", "Reasoning", "Vision", "Video Understanding", "Image Generation", "Video Generation", "Text To Speech"],
    maxVideoDurationSec: 8, // Google Veo 3.1 & 2.0 native 9:16 vertical video limit
    supportsImageRefs: true,
    supportsNativeAudio: true,
    notes: "Google Veo native 9:16 vertical video (~8s single-shot, multimodal image ref conditioned, native synchronized audio)",
  },
  grok: {
    providerId: "grok",
    displayName: "xAI Grok",
    capabilities: ["Chat", "Reasoning", "Vision", "Video Understanding", "Image Generation", "Video Generation", "Text To Speech"],
    maxVideoDurationSec: 15, // Grok Imagine Video preview duration
    supportsImageRefs: true,
    supportsNativeAudio: false,
    notes: "xAI Grok Imagine Video (up to ~15s motion preview, ephemeral URLs persisted to Supabase Storage)",
  },
  openai: {
    providerId: "openai",
    displayName: "OpenAI",
    capabilities: ["Chat", "Reasoning", "Vision", "Video Understanding", "Image Generation", "Text To Speech"],
    supportsImageRefs: true,
    supportsNativeAudio: false,
    notes: "GPT-5.6 Flagship reasoning, GPT Image 1.5 high-fidelity stills, Super Spark voice synthesis",
  },
  claude: {
    providerId: "claude",
    displayName: "Anthropic Claude",
    capabilities: ["Chat", "Reasoning", "Vision", "Video Understanding"],
    supportsImageRefs: false,
    supportsNativeAudio: false,
    notes: "Claude Sonnet 5 & Opus 5 executive production compiling, scriptwriting, and critique",
  },
  elevenlabs: {
    providerId: "elevenlabs",
    displayName: "ElevenLabs",
    capabilities: ["Text To Speech"],
    supportsImageRefs: false,
    supportsNativeAudio: true,
    notes: "Dedicated production voiceover narration & brand voice cloning (Eleven Multilingual v2)",
  },
  kling: {
    providerId: "kling",
    displayName: "Kling AI",
    capabilities: ["Video Generation", "Image Generation"],
    maxVideoDurationSec: 10,
    supportsImageRefs: true,
    supportsNativeAudio: true,
    notes: "Kling 1.5 high-coherence motion & portrait keyframe conditioning (~10s max)",
  },
  runway: {
    providerId: "runway",
    displayName: "Runway Gen-3",
    capabilities: ["Video Generation"],
    maxVideoDurationSec: 10,
    supportsImageRefs: true,
    supportsNativeAudio: false,
    notes: "Runway Gen-3 Alpha cinematic camera control & continuous movement (~10s max)",
  },
  luma: {
    providerId: "luma",
    displayName: "Luma Dream Machine",
    capabilities: ["Video Generation"],
    maxVideoDurationSec: 9,
    supportsImageRefs: true,
    supportsNativeAudio: false,
    notes: "Luma Ray 2 keyframe-to-motion interpolation (~9s max)",
  },
  higgsfield: {
    providerId: "higgsfield",
    displayName: "Higgsfield AI",
    capabilities: ["Video Generation", "Video Understanding"],
    maxVideoDurationSec: 8,
    supportsImageRefs: true,
    supportsNativeAudio: false,
    notes: "Higgsfield Pop / Cinema vertical video motion (~8s max)",
  },
};

/**
 * Resolves the active video generation provider by checking user AI preferences,
 * verifying that the provider has the "Video Generation" capability, and confirming an API key exists.
 * Falls back dynamically to the Best Available video provider.
 */
export function resolveActiveVideoProvider(params?: {
  userRoutingConfig?: Partial<AIModelRoutingConfig>;
  customKeys?: Record<string, string>;
}): {
  providerId: AIProviderId;
  maxVideoDurationSec: number;
  supportsImageRefs: boolean;
  supportsNativeAudio: boolean;
  profile: ProviderCapabilityProfile;
} {
  const { userRoutingConfig, customKeys } = params || {};
  let userConfig: Partial<AIModelRoutingConfig> | undefined = userRoutingConfig;

  if (!userConfig && typeof localStorage !== "undefined") {
    try {
      const saved = localStorage.getItem("spark_ai_model_routing");
      if (saved) userConfig = JSON.parse(saved);
    } catch {}
  }

  const pinnedVideoProvider = userConfig?.videoGeneration;

  // 1. If user pinned a specific video provider, verify capability & key
  if (pinnedVideoProvider && pinnedVideoProvider !== "auto") {
    const profile = PROVIDER_CAPABILITY_MAP[pinnedVideoProvider as ConcreteAIProviderId];
    if (profile && profile.capabilities.includes("Video Generation")) {
      const hasKey = resolveProviderKey(pinnedVideoProvider, customKeys);
      if (hasKey) {
        return {
          providerId: pinnedVideoProvider,
          maxVideoDurationSec: profile.maxVideoDurationSec || 8,
          supportsImageRefs: profile.supportsImageRefs ?? true,
          supportsNativeAudio: profile.supportsNativeAudio ?? false,
          profile,
        };
      }
    }
  }

  // 2. Best Available: Priority order of video-capable providers with available keys
  const videoCandidates: ConcreteAIProviderId[] = ["gemini", "grok", "kling", "runway", "luma", "higgsfield"];
  for (const candidateId of videoCandidates) {
    const profile = PROVIDER_CAPABILITY_MAP[candidateId];
    if (profile && profile.capabilities.includes("Video Generation")) {
      const hasKey = resolveProviderKey(candidateId, customKeys);
      if (hasKey) {
        return {
          providerId: candidateId,
          maxVideoDurationSec: profile.maxVideoDurationSec || 8,
          supportsImageRefs: profile.supportsImageRefs ?? true,
          supportsNativeAudio: profile.supportsNativeAudio ?? false,
          profile,
        };
      }
    }
  }

  // 3. Fallback: Gemini Veo default profile
  const defaultProfile = PROVIDER_CAPABILITY_MAP.gemini;
  return {
    providerId: "gemini",
    maxVideoDurationSec: defaultProfile.maxVideoDurationSec || 8,
    supportsImageRefs: defaultProfile.supportsImageRefs ?? true,
    supportsNativeAudio: defaultProfile.supportsNativeAudio ?? true,
    profile: defaultProfile,
  };
}
