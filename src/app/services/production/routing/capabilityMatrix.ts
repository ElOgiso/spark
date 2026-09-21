/**
 * Extended capability matrix for shot-level routing.
 * Builds on existing PROVIDER_VIDEO_CAPABILITIES without replacing ModelRouter.
 */

import type { ConcreteAIProviderId } from "../../runtime/providerCapabilities";
import { PROVIDER_VIDEO_CAPABILITIES, PROVIDER_CAPABILITY_MAP } from "../../runtime/providerCapabilities";
import type { ShotSpec, GenerationStrategy } from "../specification/shotSpec";
import { getCapabilityProfile } from "../capability/registry";

export type GenerationCapability =
  | "text_to_image"
  | "image_to_image"
  | "text_to_video"
  | "image_to_video"
  | "first_frame_conditioning"
  | "last_frame_conditioning"
  | "multi_reference"
  | "character_consistency"
  | "object_consistency"
  | "lip_sync"
  | "dialogue"
  | "voice"
  | "audio_generation"
  | "long_duration"
  | "extension"
  | "editing"
  | "high_resolution"
  | "aspect_ratio_flexibility"
  | "motion_quality"
  | "realism"
  | "animation"
  | "stylization"
  | "speed"
  | "cost_efficiency";

export interface ProviderCapabilityScorecard {
  providerId: ConcreteAIProviderId;
  displayName: string;
  capabilities: Partial<Record<GenerationCapability, number>>; // 0-1
  allowedDurationsSec: number[];
  maxNativeSec: number;
  /** Mirrors canonical capability profile limits / reference budgets */
  maxMultimodalReferences: number;
  notes: string;
}

/** Helper to derive limits from canonical MediaCapabilityProfile fact layer, with fallback */
export function resolveScorecardLimits(providerId: ConcreteAIProviderId) {
  const profile = getCapabilityProfile(providerId);
  const fallback = PROVIDER_VIDEO_CAPABILITIES[providerId];
  const allowedDurationsSec = profile?.output.duration?.supportedValues?.length
    ? [...profile.output.duration.supportedValues]
    : fallback?.allowedDurationsSec || [];
  const maxNativeSec = profile?.output.duration?.maxSeconds ?? fallback?.maxNativeSec ?? 0;
  const maxMultimodalReferences = profile?.references.maxReferences ?? fallback?.maxMultimodalReferences ?? 4;
  const notes = profile?.metadata?.notes || fallback?.notes || "";
  return { allowedDurationsSec, maxNativeSec, maxMultimodalReferences, notes };
}

/**
 * Capability priors — soft scorecards subordinate to canonical MediaCapabilityProfile facts.
 * Hard capability validation (Phase 3/5) gates candidates before these soft priors are evaluated.
 */
export const PROVIDER_GENERATION_SCORECARDS: ProviderCapabilityScorecard[] = [
  {
    providerId: "gemini",
    displayName: "Google Gemini / Veo",
    ...resolveScorecardLimits("gemini"),
    capabilities: {
      text_to_video: 0.85,
      image_to_video: 0.88,
      first_frame_conditioning: 0.85,
      audio_generation: 0.8,
      motion_quality: 0.85,
      realism: 0.88,
      character_consistency: 0.7,
      high_resolution: 0.8,
      speed: 0.7,
      cost_efficiency: 0.55,
    },
  },
  {
    providerId: "grok",
    displayName: "xAI Grok",
    ...resolveScorecardLimits("grok"),
    capabilities: {
      image_to_video: 0.86,
      first_frame_conditioning: 0.9,
      multi_reference: 0.85,
      character_consistency: 0.82,
      long_duration: 0.8,
      audio_generation: 0.75,
      motion_quality: 0.8,
      realism: 0.8,
      speed: 0.75,
      cost_efficiency: 0.6,
    },
  },
  {
    providerId: "kling",
    displayName: "Kling AI",
    ...resolveScorecardLimits("kling"),
    capabilities: {
      image_to_video: 0.9,
      first_frame_conditioning: 0.92,
      last_frame_conditioning: 0.88,
      character_consistency: 0.84,
      motion_quality: 0.88,
      realism: 0.85,
      stylization: 0.7,
      speed: 0.55,
      cost_efficiency: 0.5,
    },
  },
  {
    providerId: "seedance",
    displayName: "Seedance",
    ...resolveScorecardLimits("seedance"),
    capabilities: {
      image_to_video: 0.88,
      first_frame_conditioning: 0.9,
      last_frame_conditioning: 0.9,
      character_consistency: 0.8,
      long_duration: 0.85,
      motion_quality: 0.82,
      realism: 0.8,
      speed: 0.6,
      cost_efficiency: 0.55,
    },
  },
  {
    providerId: "runway",
    displayName: "Runway Gen-3",
    ...resolveScorecardLimits("runway"),
    capabilities: {
      image_to_video: 0.84,
      text_to_video: 0.8,
      motion_quality: 0.9,
      stylization: 0.85,
      character_consistency: 0.65,
      speed: 0.6,
      cost_efficiency: 0.45,
    },
  },
  {
    providerId: "luma",
    displayName: "Luma Dream Machine",
    ...resolveScorecardLimits("luma"),
    capabilities: {
      image_to_video: 0.8,
      first_frame_conditioning: 0.85,
      last_frame_conditioning: 0.8,
      motion_quality: 0.82,
      realism: 0.78,
      speed: 0.65,
      cost_efficiency: 0.55,
    },
  },
  {
    providerId: "higgsfield",
    displayName: "Higgsfield AI",
    ...resolveScorecardLimits("higgsfield"),
    capabilities: {
      image_to_video: 0.78,
      motion_quality: 0.8,
      stylization: 0.82,
      speed: 0.7,
      cost_efficiency: 0.6,
    },
  },
  {
    providerId: "openai",
    displayName: "OpenAI",
    allowedDurationsSec: [],
    maxNativeSec: 0,
    maxMultimodalReferences: PROVIDER_VIDEO_CAPABILITIES.openai.maxMultimodalReferences,
    notes: "Stills / reasoning",
    capabilities: {
      text_to_image: 0.92,
      image_to_image: 0.85,
      multi_reference: 0.7,
      character_consistency: 0.75,
      high_resolution: 0.9,
      realism: 0.88,
      speed: 0.8,
      cost_efficiency: 0.55,
      voice: 0.7,
    },
  },
  {
    providerId: "elevenlabs",
    displayName: "ElevenLabs",
    allowedDurationsSec: [],
    maxNativeSec: 0,
    maxMultimodalReferences: PROVIDER_VIDEO_CAPABILITIES.elevenlabs.maxMultimodalReferences,
    notes: "Voice",
    capabilities: {
      voice: 0.95,
      audio_generation: 0.9,
      dialogue: 0.85,
      lip_sync: 0.4,
      speed: 0.85,
      cost_efficiency: 0.6,
    },
  },
];

export function strategyToRequiredCapabilities(strategy: GenerationStrategy, shot: ShotSpec): GenerationCapability[] {
  const req: GenerationCapability[] = [];
  switch (strategy) {
    case "text_to_image":
      req.push("text_to_image");
      break;
    case "image_to_image":
      req.push("image_to_image");
      break;
    case "text_to_video":
      req.push("text_to_video", "motion_quality");
      break;
    case "first_last_frame":
      req.push("image_to_video", "first_frame_conditioning", "last_frame_conditioning");
      break;
    case "multi_reference":
      req.push("image_to_video", "multi_reference", "character_consistency");
      break;
    case "slideshow_still":
      req.push("text_to_image");
      break;
    case "extend":
      req.push("extension", "image_to_video");
      break;
    case "edit":
      req.push("editing");
      break;
    case "voice":
      req.push("voice");
      break;
    case "image_to_video":
    default:
      req.push("image_to_video", "first_frame_conditioning", "motion_quality");
      break;
  }
  if (shot.characterIds?.length) req.push("character_consistency");
  if (shot.dialogue) req.push("dialogue");
  if ((shot.durationSec || 0) > 10) req.push("long_duration");
  if (shot.camera?.shotType === "macro") req.push("realism");
  if (shot.generationStrategySpec?.notes?.includes("animation")) req.push("animation", "stylization");
  return Array.from(new Set(req));
}

export function getScorecard(providerId: string): ProviderCapabilityScorecard | undefined {
  return PROVIDER_GENERATION_SCORECARDS.find((s) => s.providerId === providerId);
}

export function providerSupportsVideo(providerId: ConcreteAIProviderId): boolean {
  return (PROVIDER_CAPABILITY_MAP[providerId]?.capabilities || []).includes("Video Generation");
}
