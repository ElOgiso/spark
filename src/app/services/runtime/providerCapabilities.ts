import type { AICapabilityType, AIProviderId, AIModelRoutingConfig } from "../../domain/types";
import { resolveProviderKey } from "./AIProviderOrchestrator";

export type ConcreteAIProviderId = Exclude<AIProviderId, "auto">;

export interface ProviderCapabilityProfile {
  providerId: ConcreteAIProviderId;
  displayName: string;
  capabilities: AICapabilityType[];
  maxVideoDurationSec?: number; // native single-shot peak quality limit (seconds)
  allowedDurationsSec?: number[]; // official supported durations in seconds (e.g. [4, 6, 8] for Veo)
  supportsImageRefs?: boolean;
  supportsNativeAudio?: boolean;
  notes: string;
}

export interface ProviderVideoCapability {
  providerId: ConcreteAIProviderId;
  displayName: string;
  logoName: string;
  allowedDurationsSec: number[];
  maxNativeSec: number;
  supportsImageRefs: boolean;
  supportsNativeAudio: boolean;
  notes: string;
}

/**
 * Official Provider Native Video Capabilities & Duration Limits.
 * Single source of truth for scene planning, video generation duration parameters, and UI settings.
 */
export const PROVIDER_VIDEO_CAPABILITIES: Record<ConcreteAIProviderId, ProviderVideoCapability> = {
  gemini: {
    providerId: "gemini",
    displayName: "Google Gemini / Veo",
    logoName: "gemini",
    allowedDurationsSec: [4, 6, 8],
    maxNativeSec: 8,
    supportsImageRefs: true,
    supportsNativeAudio: true,
    notes: "Google Veo 3.1 & 2.0 (4s, 6s, or 8s vertical clips with synchronized native audio)",
  },
  grok: {
    providerId: "grok",
    displayName: "xAI Grok",
    logoName: "grok",
    allowedDurationsSec: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    maxNativeSec: 15,
    supportsImageRefs: true,
    supportsNativeAudio: true,
    notes: "xAI Grok Imagine Video (1–15s I2V, audio on, start-frame + up to 7 reference faces)",
  },
  kling: {
    providerId: "kling",
    displayName: "Kling AI",
    logoName: "kling",
    allowedDurationsSec: [5, 10],
    maxNativeSec: 10,
    supportsImageRefs: true,
    supportsNativeAudio: true,
    notes: "Kling image2video JWT (5s or 10s, image_tail last-frame in pro/turbo/v2.6)",
  },
  seedance: {
    providerId: "seedance",
    displayName: "Seedance",
    logoName: "seedance",
    allowedDurationsSec: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    maxNativeSec: 15,
    supportsImageRefs: true,
    supportsNativeAudio: true,
    notes: "ByteDance Seedance Ark I2V (first_frame + last_frame continuation, 4–15s, 720p/1080p)",
  },
  runway: {
    providerId: "runway",
    displayName: "Runway Gen-3",
    logoName: "runway",
    allowedDurationsSec: [5, 10],
    maxNativeSec: 10,
    supportsImageRefs: true,
    supportsNativeAudio: false,
    notes: "Runway Gen-3 Alpha cinematic camera control (5s or 10s)",
  },
  luma: {
    providerId: "luma",
    displayName: "Luma Dream Machine",
    logoName: "luma",
    allowedDurationsSec: [5, 9],
    maxNativeSec: 9,
    supportsImageRefs: true,
    supportsNativeAudio: false,
    notes: "Luma Ray 2 keyframe-to-motion interpolation (5s or 9s)",
  },
  higgsfield: {
    providerId: "higgsfield",
    displayName: "Higgsfield AI",
    logoName: "higgsfield",
    allowedDurationsSec: [4, 8],
    maxNativeSec: 8,
    supportsImageRefs: true,
    supportsNativeAudio: false,
    notes: "Higgsfield Pop / Cinema vertical video motion (4s or 8s)",
  },
  openai: {
    providerId: "openai",
    displayName: "OpenAI",
    logoName: "openai",
    allowedDurationsSec: [],
    maxNativeSec: 0,
    supportsImageRefs: true,
    supportsNativeAudio: false,
    notes: "Reasoning & DALL-E / GPT Image only (no native video model)",
  },
  claude: {
    providerId: "claude",
    displayName: "Anthropic Claude",
    logoName: "claude",
    allowedDurationsSec: [],
    maxNativeSec: 0,
    supportsImageRefs: false,
    supportsNativeAudio: false,
    notes: "Reasoning & Scriptwriting only",
  },
  elevenlabs: {
    providerId: "elevenlabs",
    displayName: "ElevenLabs",
    logoName: "elevenlabs",
    allowedDurationsSec: [],
    maxNativeSec: 0,
    supportsImageRefs: false,
    supportsNativeAudio: true,
    notes: "Voiceover & Audio Narration only",
  },
};

/**
 * Single source of truth for AI Provider Physics & Capabilities in SPARK.
 * Scene planners, media compilers, and router engines read real max durations and modalities from here.
 */
export const PROVIDER_CAPABILITY_MAP: Record<ConcreteAIProviderId, ProviderCapabilityProfile> = {
  gemini: {
    providerId: "gemini",
    displayName: "Google Gemini / Veo",
    capabilities: ["Chat", "Reasoning", "Vision", "Video Understanding", "Image Generation", "Video Generation", "Text To Speech"],
    maxVideoDurationSec: 8,
    allowedDurationsSec: [4, 6, 8],
    supportsImageRefs: true,
    supportsNativeAudio: true,
    notes: "Google Veo native 9:16 vertical video (~8s single-shot, multimodal image ref conditioned, native synchronized audio)",
  },
  grok: {
    providerId: "grok",
    displayName: "xAI Grok",
    capabilities: ["Chat", "Reasoning", "Vision", "Video Understanding", "Image Generation", "Video Generation", "Text To Speech"],
    maxVideoDurationSec: 15,
    allowedDurationsSec: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    supportsImageRefs: true,
    supportsNativeAudio: true,
    notes: "xAI Grok Imagine Video (up to 15s I2V, start-frame data URI + reference faces, audio on)",
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
    allowedDurationsSec: [5, 10],
    supportsImageRefs: true,
    supportsNativeAudio: true,
    notes: "Kling image2video with JWT, first-frame + image_tail continuity (~10s max)",
  },
  seedance: {
    providerId: "seedance",
    displayName: "Seedance",
    capabilities: ["Video Generation"],
    maxVideoDurationSec: 15,
    allowedDurationsSec: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    supportsImageRefs: true,
    supportsNativeAudio: true,
    notes: "ByteDance Seedance Ark I2V with first_frame / last_frame / reference_image roles (~15s max)",
  },
  runway: {
    providerId: "runway",
    displayName: "Runway Gen-3",
    capabilities: ["Video Generation"],
    maxVideoDurationSec: 10,
    allowedDurationsSec: [5, 10],
    supportsImageRefs: true,
    supportsNativeAudio: false,
    notes: "Runway Gen-3 Alpha cinematic camera control & continuous movement (~10s max)",
  },
  luma: {
    providerId: "luma",
    displayName: "Luma Dream Machine",
    capabilities: ["Video Generation"],
    maxVideoDurationSec: 9,
    allowedDurationsSec: [5, 9],
    supportsImageRefs: true,
    supportsNativeAudio: false,
    notes: "Luma Ray 2 keyframe-to-motion interpolation (~9s max)",
  },
  higgsfield: {
    providerId: "higgsfield",
    displayName: "Higgsfield AI",
    capabilities: ["Video Generation", "Video Understanding"],
    maxVideoDurationSec: 8,
    allowedDurationsSec: [4, 8],
    supportsImageRefs: true,
    supportsNativeAudio: false,
    notes: "Higgsfield Pop / Cinema vertical video motion (~8s max)",
  },
};

/**
 * Snaps a target scene duration to the largest legal duration supported by the provider.
 * For example: for Gemini/Veo (allowed: [4, 6, 8]), 8s -> 8, 7s -> 6, 5s -> 4.
 */
export function snapToAllowedDuration(targetSec: number, providerId: ConcreteAIProviderId): number {
  const cap = PROVIDER_VIDEO_CAPABILITIES[providerId] || PROVIDER_VIDEO_CAPABILITIES.gemini;
  const allowed = cap.allowedDurationsSec;
  if (!allowed || allowed.length === 0) return Math.min(targetSec, 8);

  const validLessOrEqual = allowed.filter((d) => d <= targetSec);
  if (validLessOrEqual.length > 0) {
    return Math.max(...validLessOrEqual);
  }
  return Math.min(...allowed);
}

/**
 * Resolves the active video generation provider by checking user AI preferences,
 * verifying that the provider has the "Video Generation" capability, and confirming an API key exists.
 * Falls back dynamically to the Best Available video provider.
 */
export function resolveActiveVideoProvider(params?: {
  preferredVideoProvider?: AIProviderId;
  userRoutingConfig?: Partial<AIModelRoutingConfig>;
  customKeys?: Record<string, string>;
}): {
  providerId: ConcreteAIProviderId;
  maxVideoDurationSec: number;
  allowedDurationsSec: number[];
  supportsImageRefs: boolean;
  supportsNativeAudio: boolean;
  profile: ProviderCapabilityProfile;
  videoCapability: ProviderVideoCapability;
} {
  const { preferredVideoProvider, userRoutingConfig, customKeys } = params || {};
  let userConfig: Partial<AIModelRoutingConfig> | undefined = userRoutingConfig;

  if (!userConfig && typeof localStorage !== "undefined") {
    try {
      const saved = localStorage.getItem("spark_ai_model_routing");
      if (saved) userConfig = JSON.parse(saved);
    } catch {}
  }

  const pinnedVideoProvider = preferredVideoProvider && preferredVideoProvider !== "auto"
    ? preferredVideoProvider
    : userConfig?.videoGeneration;

  // 1. If user pinned a specific video provider, verify capability & key
  if (pinnedVideoProvider && pinnedVideoProvider !== "auto") {
    const profile = PROVIDER_CAPABILITY_MAP[pinnedVideoProvider as ConcreteAIProviderId];
    if (profile && profile.capabilities.includes("Video Generation")) {
      const hasKey = resolveProviderKey(pinnedVideoProvider, customKeys);
      if (hasKey) {
        const vidCap = PROVIDER_VIDEO_CAPABILITIES[pinnedVideoProvider as ConcreteAIProviderId];
        return {
          providerId: pinnedVideoProvider as ConcreteAIProviderId,
          maxVideoDurationSec: profile.maxVideoDurationSec || 8,
          allowedDurationsSec: profile.allowedDurationsSec || [4, 6, 8],
          supportsImageRefs: profile.supportsImageRefs ?? true,
          supportsNativeAudio: profile.supportsNativeAudio ?? false,
          profile,
          videoCapability: vidCap,
        };
      }
    }
  }

  // 2. Best Available: Priority order of video-capable providers with available keys
  const videoCandidates: ConcreteAIProviderId[] = ["gemini", "grok", "kling", "seedance", "runway", "luma", "higgsfield"];
  for (const candidateId of videoCandidates) {
    const profile = PROVIDER_CAPABILITY_MAP[candidateId];
    if (profile && profile.capabilities.includes("Video Generation")) {
      const hasKey = resolveProviderKey(candidateId, customKeys);
      if (hasKey) {
        const vidCap = PROVIDER_VIDEO_CAPABILITIES[candidateId];
        return {
          providerId: candidateId,
          maxVideoDurationSec: profile.maxVideoDurationSec || 8,
          allowedDurationsSec: profile.allowedDurationsSec || [4, 6, 8],
          supportsImageRefs: profile.supportsImageRefs ?? true,
          supportsNativeAudio: profile.supportsNativeAudio ?? false,
          profile,
          videoCapability: vidCap,
        };
      }
    }
  }

  // 3. Fallback: Gemini Veo default profile
  const defaultProfile = PROVIDER_CAPABILITY_MAP.gemini;
  const defaultVidCap = PROVIDER_VIDEO_CAPABILITIES.gemini;
  return {
    providerId: "gemini",
    maxVideoDurationSec: defaultProfile.maxVideoDurationSec || 8,
    allowedDurationsSec: defaultProfile.allowedDurationsSec || [4, 6, 8],
    supportsImageRefs: defaultProfile.supportsImageRefs ?? true,
    supportsNativeAudio: defaultProfile.supportsNativeAudio ?? true,
    profile: defaultProfile,
    videoCapability: defaultVidCap,
  };
}

export interface VideoProductionPlanMetrics {
  targetDurationSec: number;
  activeProviderId: ConcreteAIProviderId;
  displayName: string;
  maxNativeClipSec: number;
  allowedDurationsSec: number[];
  isMultiScene: boolean;
  estimatedSceneCount: number;
  perSceneMaxSec: number;
  summaryText: string;
  helperText: string;
}

/**
 * Derives unified video length and clip engine metrics for UI display and scene planning.
 * Guarantees that target duration and clip engine operate as one unified control system.
 */
export function deriveVideoProductionPlanMetrics(params: {
  targetDurationSec?: number;
  preferredVideoProvider?: AIProviderId;
  customKeys?: Record<string, string>;
}): VideoProductionPlanMetrics {
  const targetDurationSec = params.targetDurationSec || 60;
  const activeVideo = resolveActiveVideoProvider({
    preferredVideoProvider: params.preferredVideoProvider,
    customKeys: params.customKeys,
  });

  const maxNativeClipSec = activeVideo.maxVideoDurationSec || 8;
  const isMultiScene = targetDurationSec > maxNativeClipSec;
  const estimatedSceneCount = isMultiScene ? Math.ceil(targetDurationSec / maxNativeClipSec) : 1;
  const perSceneMaxSec = snapToAllowedDuration(Math.min(targetDurationSec, maxNativeClipSec), activeVideo.providerId);

  const formattedTarget =
    targetDurationSec >= 60
      ? `${Math.round(targetDurationSec / 60)}m (${targetDurationSec}s)`
      : `${targetDurationSec}s`;

  const summaryText = isMultiScene
    ? `${estimatedSceneCount} continuous scenes (~${perSceneMaxSec}s max per clip) for ${formattedTarget} total runtime`
    : `Single take (1 scene, ~${perSceneMaxSec}s) matching ${activeVideo.videoCapability.displayName} native limits`;

  const helperText = "SPARK splits long targets into scenes at this engine's max clip length.";

  return {
    targetDurationSec,
    activeProviderId: activeVideo.providerId,
    displayName: activeVideo.videoCapability.displayName,
    maxNativeClipSec,
    allowedDurationsSec: activeVideo.allowedDurationsSec,
    isMultiScene,
    estimatedSceneCount,
    perSceneMaxSec,
    summaryText,
    helperText,
  };
}
