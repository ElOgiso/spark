/**
 * Shared fail-closed video request capability assertion.
 * Used by:
 * 1. productionVideoRequest.ts (client-side pre-fetch guard)
 * 2. api/runtime/video.ts (server-side POST handler guard)
 *
 * Single billable video path: missing, unmapped, or disabled models fail closed.
 */

import type { CapabilityRequirements, MediaCapabilityProfile } from "./types.js";
import { getCapabilityProfile } from "./registry.js";
import { assertExecutableCapability } from "./router.js";

export function looksLikeSheetOrGridUrl(url: string): boolean {
  return /storyboard[-_]?grid|contact[-_]?sheet|character[-_]?sheet|model[-_]?sheet|location[-_]?plate|thumbnail|prop[-_]?sheet|product[-_]?sheet/i.test(
    url
  );
}

export function looksLikeStoryboardGridUrl(url: string): boolean {
  return /storyboard[-_]?grid/i.test(url);
}

export const I2V_API_PROVIDERS = new Set([
  "grok",
  "kling",
  "seedance",
  "ark",
  "xai",
  "higgsfield",
  "higgsfield-seedance",
]);

export interface VideoExecutableRequestInput {
  provider?: string;
  model?: string;
  prompt?: string;
  firstFrameUrl?: string;
  imageUrl?: string;
  lastFrameUrl?: string;
  endFrameUrl?: string;
  characterSheetUrl?: string;
  referenceImageUrls?: string[];
  referenceUrls?: string[];
  imageUrls?: string[];
  aspectRatio?: string;
  aspect_ratio?: string;
  durationSec?: number;
  duration?: number | string;
  resolution?: string;
  mode?: string;
  action?: string;
  videoUrls?: string[];
  identityCritical?: boolean;
  [key: string]: any;
}

export function assertVideoRequestExecutable(
  params: VideoExecutableRequestInput
): { ok: true; profile: MediaCapabilityProfile | null } {
  // 0. Serverless FFmpeg merge/concat bypass (non-generative)
  if (
    params.provider === "mux" ||
    params.action === "mux" ||
    params.action === "merge" ||
    (Array.isArray(params.videoUrls) && !params.provider)
  ) {
    return { ok: true, profile: null };
  }

  // 1. Provider presence & normalization
  const rawProvider = String(params.provider || "").trim().toLowerCase();
  if (!rawProvider) {
    throw new Error("Capability validation failed: Missing required provider for video generation.");
  }

  let normProvider = rawProvider;
  if (normProvider === "ark") normProvider = "seedance";
  if (normProvider === "xai") normProvider = "grok";
  if (normProvider === "higgsfield-seedance") normProvider = "higgsfield";
  if (normProvider === "google") normProvider = "gemini";

  // 2. Detect R2V mode
  const isExplicitR2v =
    params.mode === "reference-to-video" ||
    params.mode === "r2v" ||
    (typeof params.model === "string" && (
      params.model.toLowerCase().includes("r2v") ||
      params.model.toLowerCase().includes("reference-to-video")
    ));

  const candidateRefs = [
    ...(params.characterSheetUrl ? [params.characterSheetUrl] : []),
    ...(params.referenceImageUrls || []),
    ...(params.referenceUrls || []),
    ...(params.imageUrls || []),
  ].filter((u): u is string => typeof u === "string" && u.trim().length > 0);

  const isIdentityCritical = Boolean(
    params.identityCritical ||
    params.characterSheetUrl ||
    (params.referenceImageUrls && params.referenceImageUrls.length > 0)
  );

  const isR2v = isExplicitR2v || (normProvider === "higgsfield" && candidateRefs.length > 0 && isIdentityCritical);

  // 3. Resolve effective model
  let effectiveModel = params.model?.trim();
  if (normProvider === "higgsfield") {
    if (isR2v) {
      if (!effectiveModel || !effectiveModel.toLowerCase().includes("r2v")) {
        effectiveModel = "seedance-2.5-r2v";
      }
    } else if (!effectiveModel) {
      effectiveModel = "seedance-2.5-i2v";
    }
  } else if (normProvider === "kling" && !effectiveModel) {
    effectiveModel = "kling-v2-6";
  } else if (normProvider === "seedance" && !effectiveModel) {
    effectiveModel = "doubao-seedance-1-5-pro-251215";
  } else if (normProvider === "grok" && !effectiveModel) {
    effectiveModel = "grok-imagine-video-1.5";
  } else if (normProvider === "gemini" && !effectiveModel) {
    effectiveModel = "veo-3.1-generate-preview";
  }

  // 4. Fail-closed profile lookup
  const profile = getCapabilityProfile(normProvider, effectiveModel);
  if (!profile) {
    throw new Error(
      `Capability validation failed: Provider "${rawProvider}" (model: "${effectiveModel || params.model || "default"}") is not supported or has no registered capability profile.`
    );
  }

  // 5. Fail-closed adapterSupport check
  if (!profile.adapterSupported) {
    throw new Error(
      `Capability validation failed: Provider "${rawProvider}" (model: "${profile.modelId}") has adapterSupported: false. Direct execution is disabled.`
    );
  }

  // 6. Strict I2V first-frame / sheet-grid rules
  const firstFrame = params.firstFrameUrl || params.imageUrl;
  const endFrame = params.endFrameUrl || params.lastFrameUrl;

  if (!isR2v) {
    if (!firstFrame || !firstFrame.trim()) {
      throw new Error(
        `Still required before motion. I2V video generation with provider "${rawProvider}" requires a valid firstFrameUrl (shot still/keyframe).`
      );
    }

    if (looksLikeSheetOrGridUrl(firstFrame) || looksLikeStoryboardGridUrl(firstFrame)) {
      throw new Error(
        `Still required before motion. I2V video generation with provider "${rawProvider}" requires this shot's still as firstFrameUrl, not a sheet or storyboard grid.`
      );
    }
  }

  if (normProvider === "higgsfield") {
    if (firstFrame?.startsWith("asset://")) {
      throw new Error(
        "Higgsfield Seedance I2V does not support asset:// URI scheme. A public HTTPS firstFrameUrl is required."
      );
    }
  }

  // 7. Temporal & output validation via assertExecutableCapability
  const rawDur = typeof params.durationSec === "number"
    ? params.durationSec
    : (Number(params.duration) || undefined);
  const durSec = rawDur != null && Number.isFinite(rawDur) ? Math.round(rawDur) : undefined;

  const shouldValidateMultiRef = isR2v || (profile.references.supportsMultipleReferences && candidateRefs.length > 0);

  const requirements: CapabilityRequirements = {
    modality: "video",
    generationMode: "image_to_video",
    temporal: {
      requiresStartFrame: Boolean(firstFrame),
      requiresEndFrame: Boolean(endFrame),
      requiresStartAndEnd: Boolean(firstFrame && endFrame),
      requiresContinuation: false,
      requiresExtension: false,
    },
    output: {
      durationSeconds: durSec,
      aspectRatio: params.aspectRatio || params.aspect_ratio,
      resolution: params.resolution,
    },
    references: shouldValidateMultiRef && candidateRefs.length
      ? {
          types: ["image"],
          minimumCount: candidateRefs.length,
        }
      : undefined,
  };

  const capCheck = assertExecutableCapability(requirements, normProvider, profile.modelId);
  if (!capCheck.ok) {
    const reasons = capCheck.decision.reasonCodes.filter((r) => r.startsWith("REJECTED"));
    throw new Error(
      `Capability validation failed for provider "${rawProvider}": ${reasons.join(", ") || "unsupported_capability"}`
    );
  }

  return { ok: true, profile };
}
