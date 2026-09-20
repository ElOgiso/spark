/**
 * Semantic Media Vocabulary & Reference Contracts
 *
 * Provider-neutral semantics defining WHAT media is, WHAT role it plays,
 * and WHAT quality/resolution tier is required without coupling to provider-specific enums.
 */

import type { ShotReferencePack } from "./shotSpec";

/**
 * Semantic media roles describing the fundamental nature or function of an asset.
 */
export type SemanticMediaType =
  | "IMAGE"
  | "VIDEO"
  | "AUDIO"
  | "VOICE"
  | "MUSIC"
  | "SFX"
  | "AMBIENCE"
  | "USER_ASSET"
  | "STOCK"
  | "SCREENSHOT"
  | "MAP"
  | "CHART"
  | "TEXT"
  | "MOTION_GRAPHIC";

/**
 * Provider-neutral quality targets representing artistic and technical production standards.
 */
export type QualityTier =
  | "DRAFT"
  | "STANDARD"
  | "HIGH"
  | "CINEMATIC"
  | "MAXIMUM";

/**
 * Provider-neutral resolution classes.
 * Concrete pixel dimensions (e.g. 1920x1080) and provider parameters (e.g. "1080p")
 * are resolved by downstream routing and compiler layers.
 */
export type ResolutionClass =
  | "SD"
  | "HD"
  | "FULL_HD"
  | "UHD";

/**
 * Provider-neutral audio requirements for a shot or scene.
 */
export interface ShotAudioRequirement {
  dialogue?: boolean;
  narration?: boolean;
  music?: boolean;
  sfx?: boolean;
  ambience?: boolean;
  nativeAudio?: boolean;
}

/**
 * Provider-neutral output requirements for a shot.
 */
export interface ShotOutputRequirement {
  mediaType: SemanticMediaType;
  aspectRatio?: string;
  qualityTier?: QualityTier;
  resolutionClass?: ResolutionClass;
  durationSec?: number;
  fps?: number;
  audio?: ShotAudioRequirement;
}

/**
 * Semantic reference roles describing the purpose of a reference asset
 * without hard-coding provider-specific payload field names.
 */
export type SemanticReferenceRole =
  | "CHARACTER"
  | "IDENTITY"
  | "START_FRAME"
  | "END_FRAME"
  | "STYLE"
  | "ENVIRONMENT"
  | "SOURCE_VIDEO"
  | "REPLACEMENT_OBJECT"
  | "PROP"
  | "COMPOSITION";

/**
 * Provider-neutral reference item.
 */
export interface SemanticReference {
  role: SemanticReferenceRole;
  url?: string;
  assetId?: string;
  label?: string;
  importance?: "required" | "preferred" | "optional";
  metadata?: Record<string, unknown>;
}

/**
 * Canonical capability identifiers representing WHAT operational capabilities
 * a generation task or shot requires, independent of any specific provider.
 */
export type SemanticCapabilityId =
  | "IMAGE_GENERATION"
  | "TEXT_TO_VIDEO"
  | "IMAGE_TO_VIDEO"
  | "START_END_FRAME_VIDEO"
  | "CHARACTER_CONSISTENCY"
  | "STYLE_CONSISTENCY"
  | "MOTION_TRANSFER"
  | "OBJECT_REPLACEMENT"
  | "VIDEO_EDIT"
  | "VIDEO_UPSCALE"
  | "VIDEO_ANALYSIS"
  | "TTS"
  | "VOICE_CONVERSION"
  | "MUSIC_GENERATION"
  | "SFX_GENERATION";

/**
 * Normalize an arbitrary quality string to a canonical QualityTier.
 */
export function normalizeQualityTier(val?: string): QualityTier {
  if (!val) return "STANDARD";
  const clean = val.trim().toUpperCase();
  if (clean.includes("DRAFT")) return "DRAFT";
  if (clean.includes("CINEMA") || clean.includes("FILM") || clean.includes("MAX")) {
    return clean.includes("MAX") ? "MAXIMUM" : "CINEMATIC";
  }
  if (clean.includes("HIGH") || clean.includes("BROADCAST")) return "HIGH";
  return "STANDARD";
}

/**
 * Parse an arbitrary resolution string (e.g. "1080p", "4k", "720") into a ResolutionClass.
 */
export function parseResolutionClass(val?: string): ResolutionClass | undefined {
  if (!val) return undefined;
  const clean = val.trim().toLowerCase();
  if (clean === "4k" || clean.includes("2160") || clean.includes("uhd")) return "UHD";
  if (clean === "1080p" || clean.includes("1080") || clean.includes("fhd") || clean === "full_hd") return "FULL_HD";
  if (clean === "720p" || clean.includes("720") || clean.includes("hd")) return "HD";
  if (clean.includes("480") || clean.includes("sd")) return "SD";
  return undefined;
}

/**
 * Convert a legacy ShotReferencePack into an array of typed SemanticReferences.
 */
export function referencePackToSemanticReferences(pack?: ShotReferencePack): SemanticReference[] {
  if (!pack) return [];
  const refs: SemanticReference[] = [];

  if (pack.firstFrameUrl) {
    refs.push({
      role: "START_FRAME",
      url: pack.firstFrameUrl,
      importance: "required",
      label: "First frame keyframe",
    });
  }

  if (pack.lastFrameUrl) {
    refs.push({
      role: "END_FRAME",
      url: pack.lastFrameUrl,
      importance: "preferred",
      label: "Last frame anchor",
    });
  }

  for (const charRef of pack.characterRefs || []) {
    refs.push({
      role: "CHARACTER",
      url: charRef.startsWith("http") ? charRef : undefined,
      assetId: !charRef.startsWith("http") ? charRef : undefined,
      importance: "required",
      label: `Character reference ${charRef}`,
    });
  }

  for (const locRef of pack.locationRefs || []) {
    refs.push({
      role: "ENVIRONMENT",
      url: locRef.startsWith("http") ? locRef : undefined,
      assetId: !locRef.startsWith("http") ? locRef : undefined,
      importance: "preferred",
      label: `Environment reference ${locRef}`,
    });
  }

  for (const styleRef of pack.styleRefs || []) {
    refs.push({
      role: "STYLE",
      url: styleRef.startsWith("http") ? styleRef : undefined,
      assetId: !styleRef.startsWith("http") ? styleRef : undefined,
      importance: "preferred",
      label: `Style reference ${styleRef}`,
    });
  }

  return refs;
}

/**
 * Convert an array of SemanticReferences back into a legacy ShotReferencePack
 * for backward compatibility with existing executors and UI.
 */
export function semanticReferencesToReferencePack(refs?: SemanticReference[]): ShotReferencePack {
  if (!refs?.length) {
    return {
      characterRefs: [],
      locationRefs: [],
      styleRefs: [],
    };
  }

  const characterRefs: string[] = [];
  const locationRefs: string[] = [];
  const styleRefs: string[] = [];
  let firstFrameUrl: string | undefined;
  let lastFrameUrl: string | undefined;

  for (const ref of refs) {
    const val = ref.url || ref.assetId;
    if (!val) continue;

    switch (ref.role) {
      case "START_FRAME":
        if (!firstFrameUrl && ref.url) firstFrameUrl = ref.url;
        break;
      case "END_FRAME":
        if (!lastFrameUrl && ref.url) lastFrameUrl = ref.url;
        break;
      case "CHARACTER":
      case "IDENTITY":
        characterRefs.push(val);
        break;
      case "ENVIRONMENT":
        locationRefs.push(val);
        break;
      case "STYLE":
        styleRefs.push(val);
        break;
      default:
        break;
    }
  }

  return {
    characterRefs,
    locationRefs,
    styleRefs,
    firstFrameUrl,
    lastFrameUrl,
  };
}
