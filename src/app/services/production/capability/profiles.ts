/**
 * Provider/model capability profiles — facts derived from official notes + adapter reality.
 * Unverified marketing claims are NOT recorded as supported.
 */

import type { MediaCapabilityProfile } from "./types";
import { provenance } from "./provenance";
import { PROVIDER_VIDEO_CAPABILITIES } from "../../runtime/providerCapabilities";

const DOC = (notes?: string) =>
  provenance("provider_documentation", "probable", notes, "2026-09-05T00:00:00.000Z");
const ADAPTER = (notes?: string) =>
  provenance("adapter", "verified", notes, "2026-09-05T00:00:00.000Z");
const MANUAL = (notes?: string) =>
  provenance("manual_verification", "verified", notes, "2026-09-05T00:00:00.000Z");

function baseVideoExecution(adapterSupported: boolean) {
  return {
    mode: "async" as const,
    supportsPolling: true,
    supportsWebhooks: false,
    supportsCancellation: false,
    supportsBatch: false,
    supportsStreaming: false,
    returnsInlineBinary: false,
    returnsTemporaryUrl: true,
    returnsPersistentUrl: false,
    urlExpirationKnown: false,
    requiresDownloadBeforePersistence: true,
    provenance: ADAPTER("Production video adapters return URLs that SPARK must persist"),
  };
}

function emptyAudio() {
  return {
    provenance: DOC("Audio capabilities not asserted unless native audio is known"),
  };
}

function promptCamera() {
  return {
    controlLevel: "prompt_only" as const,
    provenance: DOC("Camera described via prompt only — not structured camera API"),
  };
}

function promptMotion() {
  return {
    controlLevel: "prompt_only" as const,
    supportsMotionStrength: false,
    provenance: DOC("Motion described via prompt only unless otherwise noted"),
  };
}

/**
 * Profiles for providers SPARK actually routes/executes for video.
 * Providers without SPARK adapters are marked adapterSupported:false.
 */
export const MEDIA_CAPABILITY_PROFILES: MediaCapabilityProfile[] = [
  {
    providerId: "kling",
    modelId: "kling-v2-6",
    displayName: "Kling image2video",
    modalities: ["video", "image"],
    generationModes: ["image_to_video"],
    adapterSupported: true,
    references: {
      supportedTypes: ["image", "character", "face"],
      maxReferences: 1,
      supportsMultipleReferences: false,
      supportsTypedReferences: false,
      provenance: MANUAL("Kling I2V uses start image; identity refs limited in SPARK adapter"),
    },
    temporal: {
      supportsStartFrame: true,
      supportsEndFrame: true,
      supportsStartAndEndFrame: true,
      supportsTailFrame: true,
      supportsPreviousShotFrame: true,
      supportsVideoContinuation: false,
      supportsVideoExtension: false,
      supportsPreviousVideoAsInput: false,
      supportsLastFrameContinuation: true,
      provenance: MANUAL("Kling image_tail / end-frame supported via production I2V adapter"),
    },
    camera: promptCamera(),
    motion: promptMotion(),
    output: {
      duration: {
        supportedValues: [...PROVIDER_VIDEO_CAPABILITIES.kling.allowedDurationsSec],
        minSeconds: 5,
        maxSeconds: 10,
      },
      aspectRatios: ["16:9", "9:16", "1:1"],
      supportsNativeAudio: true,
      provenance: DOC(PROVIDER_VIDEO_CAPABILITIES.kling.notes),
    },
    audio: { nativeAudioGeneration: true, provenance: DOC("Native audio optional on Kling modes") },
    execution: baseVideoExecution(true),
    controls: {
      seed: false,
      negativePrompt: false,
      provenance: ADAPTER("Controls limited to what videoI2vAdapter passes today"),
    },
    limits: {
      maxDurationSec: 10,
      maxReferenceCount: 1,
      supportedOutputFormats: ["video/mp4"],
    },
    economics: { known: false, notes: "No authoritative SPARK price table" },
  },
  {
    providerId: "seedance",
    modelId: "doubao-seedance-1-5-pro",
    displayName: "Seedance I2V",
    modalities: ["video", "image"],
    generationModes: ["image_to_video"],
    adapterSupported: true,
    references: {
      supportedTypes: ["image", "character", "environment", "location", "style"],
      maxReferences: 4,
      supportsMultipleReferences: true,
      supportsTypedReferences: true,
      provenance: MANUAL("Seedance first_frame / last_frame / reference_image roles"),
    },
    temporal: {
      supportsStartFrame: true,
      supportsEndFrame: true,
      supportsStartAndEndFrame: true,
      supportsTailFrame: true,
      supportsPreviousShotFrame: true,
      supportsVideoContinuation: false,
      supportsVideoExtension: false,
      supportsPreviousVideoAsInput: false,
      supportsLastFrameContinuation: true,
      provenance: MANUAL("Seedance first+last frame supported in SPARK adapter"),
    },
    camera: promptCamera(),
    motion: promptMotion(),
    output: {
      duration: {
        supportedValues: [...PROVIDER_VIDEO_CAPABILITIES.seedance.allowedDurationsSec],
        minSeconds: 4,
        maxSeconds: 15,
      },
      aspectRatios: ["16:9", "9:16", "1:1"],
      resolutions: ["720p", "1080p"],
      supportsNativeAudio: true,
      provenance: DOC(PROVIDER_VIDEO_CAPABILITIES.seedance.notes),
    },
    audio: { nativeAudioGeneration: true, provenance: DOC() },
    execution: baseVideoExecution(true),
    controls: { provenance: ADAPTER() },
    limits: { maxDurationSec: 15, maxReferenceCount: 4, supportedOutputFormats: ["video/mp4"] },
    economics: { known: false },
  },
  {
    providerId: "grok",
    modelId: "grok-imagine-video",
    displayName: "Grok Imagine Video",
    modalities: ["video", "image"],
    generationModes: ["image_to_video"],
    adapterSupported: true,
    references: {
      supportedTypes: ["image", "face", "character"],
      maxReferences: 7,
      supportsMultipleReferences: true,
      supportsTypedReferences: false,
      provenance: DOC("Start-frame + reference faces per provider notes"),
    },
    temporal: {
      supportsStartFrame: true,
      supportsEndFrame: false,
      supportsStartAndEndFrame: false,
      supportsTailFrame: false,
      supportsPreviousShotFrame: true,
      supportsVideoContinuation: false,
      supportsVideoExtension: false,
      supportsPreviousVideoAsInput: false,
      supportsLastFrameContinuation: false,
      provenance: MANUAL("SPARK Grok adapter: start frame only — end frame NOT exposed"),
    },
    camera: promptCamera(),
    motion: promptMotion(),
    output: {
      duration: {
        supportedValues: [...PROVIDER_VIDEO_CAPABILITIES.grok.allowedDurationsSec],
        minSeconds: 1,
        maxSeconds: 15,
      },
      aspectRatios: ["16:9", "9:16", "1:1"],
      supportsNativeAudio: true,
      provenance: DOC(PROVIDER_VIDEO_CAPABILITIES.grok.notes),
    },
    audio: { nativeAudioGeneration: true, provenance: DOC() },
    execution: baseVideoExecution(true),
    controls: { provenance: ADAPTER() },
    limits: { maxDurationSec: 15, maxReferenceCount: 7, supportedOutputFormats: ["video/mp4"] },
    economics: { known: false },
  },
  {
    providerId: "gemini",
    modelId: "veo",
    displayName: "Gemini Veo",
    modalities: ["video", "image", "text"],
    generationModes: ["text_to_video", "image_to_video"],
    adapterSupported: true,
    references: {
      supportedTypes: ["image"],
      maxReferences: 1,
      supportsMultipleReferences: false,
      provenance: DOC(PROVIDER_VIDEO_CAPABILITIES.gemini.notes),
    },
    temporal: {
      supportsStartFrame: true,
      supportsEndFrame: false,
      supportsStartAndEndFrame: false,
      supportsTailFrame: false,
      supportsPreviousShotFrame: true,
      supportsVideoContinuation: false,
      supportsVideoExtension: false,
      supportsPreviousVideoAsInput: false,
      supportsLastFrameContinuation: false,
      provenance: DOC("Veo start-frame / image-conditioned; end-frame not claimed in SPARK adapter"),
    },
    camera: promptCamera(),
    motion: promptMotion(),
    output: {
      duration: {
        supportedValues: [...PROVIDER_VIDEO_CAPABILITIES.gemini.allowedDurationsSec],
        minSeconds: 4,
        maxSeconds: 8,
      },
      aspectRatios: ["16:9", "9:16"],
      supportsNativeAudio: true,
      provenance: DOC(PROVIDER_VIDEO_CAPABILITIES.gemini.notes),
    },
    audio: { nativeAudioGeneration: true, provenance: DOC() },
    execution: {
      ...baseVideoExecution(true),
      mode: "both",
      provenance: ADAPTER("Veo path via ModelRouter / injectable submitVideo"),
    },
    controls: { provenance: ADAPTER() },
    limits: { maxDurationSec: 8, maxReferenceCount: 1, supportedOutputFormats: ["video/mp4"] },
    economics: { known: false },
  },
  // Documented but NOT adapter-backed in SPARK execution registry — adapterSupported:false
  {
    providerId: "runway",
    modelId: "gen3",
    displayName: "Runway Gen-3",
    modalities: ["video"],
    generationModes: ["image_to_video", "text_to_video"],
    adapterSupported: false,
    references: {
      supportedTypes: ["image"],
      maxReferences: 1,
      supportsMultipleReferences: false,
      provenance: DOC(PROVIDER_VIDEO_CAPABILITIES.runway.notes),
    },
    temporal: {
      supportsStartFrame: true,
      supportsEndFrame: false,
      supportsStartAndEndFrame: false,
      supportsTailFrame: false,
      supportsPreviousShotFrame: false,
      supportsVideoContinuation: false,
      supportsVideoExtension: false,
      supportsPreviousVideoAsInput: false,
      supportsLastFrameContinuation: false,
      provenance: DOC("Not exposed via SPARK adapter — effective capability disabled"),
    },
    camera: {
      controlLevel: "prompt_only",
      provenance: DOC("Marketing claims structured camera — SPARK adapter absent, so prompt_only"),
    },
    motion: promptMotion(),
    output: {
      duration: { supportedValues: [5, 10], minSeconds: 5, maxSeconds: 10 },
      aspectRatios: ["16:9", "9:16"],
      provenance: DOC(),
    },
    audio: emptyAudio(),
    execution: baseVideoExecution(false),
    controls: { provenance: DOC() },
    limits: { maxDurationSec: 10 },
    economics: { known: false },
    metadata: { deprecated: false, notes: "Provider fact recorded; SPARK cannot execute yet" },
  },
  {
    providerId: "luma",
    modelId: "ray-2",
    displayName: "Luma Ray 2",
    modalities: ["video"],
    generationModes: ["image_to_video"],
    adapterSupported: false,
    references: {
      supportedTypes: ["image"],
      maxReferences: 2,
      supportsMultipleReferences: true,
      provenance: DOC(PROVIDER_VIDEO_CAPABILITIES.luma.notes),
    },
    temporal: {
      supportsStartFrame: true,
      supportsEndFrame: true,
      supportsStartAndEndFrame: true,
      supportsTailFrame: true,
      supportsPreviousShotFrame: false,
      supportsVideoContinuation: false,
      supportsVideoExtension: false,
      supportsPreviousVideoAsInput: false,
      supportsLastFrameContinuation: false,
      provenance: DOC("Keyframe interpolation claimed in docs — adapter not registered"),
    },
    camera: promptCamera(),
    motion: promptMotion(),
    output: {
      duration: { supportedValues: [5, 9], minSeconds: 5, maxSeconds: 9 },
      aspectRatios: ["16:9", "9:16"],
      provenance: DOC(),
    },
    audio: emptyAudio(),
    execution: baseVideoExecution(false),
    controls: { provenance: DOC() },
    limits: { maxDurationSec: 9 },
    economics: { known: false },
  },
  {
    providerId: "openai",
    modelId: "gpt-image",
    displayName: "OpenAI Image",
    modalities: ["image", "text"],
    generationModes: ["text_to_image", "image_to_image"],
    adapterSupported: true,
    references: {
      supportedTypes: ["image", "style"],
      maxReferences: 4,
      supportsMultipleReferences: true,
      provenance: DOC("Image generation / edit paths"),
    },
    temporal: {
      supportsStartFrame: false,
      supportsEndFrame: false,
      supportsStartAndEndFrame: false,
      supportsTailFrame: false,
      supportsPreviousShotFrame: false,
      supportsVideoContinuation: false,
      supportsVideoExtension: false,
      supportsPreviousVideoAsInput: false,
      supportsLastFrameContinuation: false,
      provenance: MANUAL("Not a video model"),
    },
    camera: { controlLevel: "none", provenance: DOC() },
    motion: { controlLevel: "none", provenance: DOC() },
    output: {
      aspectRatios: ["1:1", "16:9", "9:16"],
      provenance: DOC(),
    },
    audio: emptyAudio(),
    execution: {
      mode: "sync",
      supportsPolling: false,
      supportsWebhooks: false,
      returnsTemporaryUrl: true,
      requiresDownloadBeforePersistence: true,
      provenance: ADAPTER(),
    },
    controls: { seed: false, provenance: ADAPTER() },
    limits: { maxReferenceCount: 4, supportedOutputFormats: ["image/png", "image/jpeg"] },
    economics: { known: false },
  },
  {
    providerId: "elevenlabs",
    modelId: "eleven-multilingual-v2",
    displayName: "ElevenLabs TTS",
    modalities: ["audio", "text"],
    generationModes: ["text_to_speech"],
    adapterSupported: true,
    references: {
      supportedTypes: [],
      supportsMultipleReferences: false,
      provenance: DOC(),
    },
    temporal: {
      supportsStartFrame: false,
      supportsEndFrame: false,
      supportsStartAndEndFrame: false,
      supportsTailFrame: false,
      supportsPreviousShotFrame: false,
      supportsVideoContinuation: false,
      supportsVideoExtension: false,
      supportsPreviousVideoAsInput: false,
      supportsLastFrameContinuation: false,
      provenance: MANUAL(),
    },
    camera: { controlLevel: "none", provenance: DOC() },
    motion: { controlLevel: "none", provenance: DOC() },
    output: { provenance: DOC() },
    audio: {
      speech: true,
      nativeAudioGeneration: true,
      provenance: DOC("Voiceover narration"),
    },
    execution: {
      mode: "sync",
      supportsPolling: false,
      supportsWebhooks: false,
      returnsTemporaryUrl: true,
      requiresDownloadBeforePersistence: true,
      provenance: ADAPTER(),
    },
    controls: { provenance: ADAPTER() },
    limits: { supportedOutputFormats: ["audio/mpeg"] },
    economics: { known: false },
  },
];

export function findProfiles(providerId?: string, modelId?: string): MediaCapabilityProfile[] {
  return MEDIA_CAPABILITY_PROFILES.filter((p) => {
    if (providerId && p.providerId !== providerId) return false;
    if (modelId && p.modelId !== modelId) return false;
    return true;
  });
}
