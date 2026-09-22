/**
 * Parameter Normalizer for Provider Payload Compiler.
 *
 * Deterministically snaps and normalizes:
 * - duration
 * - aspect ratio
 * - resolution
 * - audio generation flags
 * - model modes
 *
 * Never silently changes hard constraints without warnings/errors.
 */

import type { MediaCapabilityProfile } from "../capability/types";
import type { NormalizedGenerationParameters } from "./types";

export interface ParameterNormalizationResult {
  params: NormalizedGenerationParameters;
  warnings: string[];
  errors: string[];
  degradations: string[];
}

export function normalizeParameters(
  raw: {
    durationSec?: number;
    aspectRatio?: string;
    resolution?: string;
    generateAudio?: boolean;
    seed?: number;
    klingMode?: "std" | "pro";
    klingSound?: "on" | "off";
    hasLastFrame?: boolean;
  },
  profile: MediaCapabilityProfile
): ParameterNormalizationResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const degradations: string[] = [];

  // 1. Aspect Ratio Normalization
  let aspectRatio = (raw.aspectRatio || "9:16").trim();
  const supportedRatios = profile.output.aspectRatios || ["9:16", "16:9", "1:1"];
  if (!supportedRatios.includes(aspectRatio)) {
    if (aspectRatio === "9:16" || aspectRatio === "16:9" || aspectRatio === "1:1") {
      errors.push(`UNSUPPORTED_ASPECT_RATIO: ${aspectRatio} is not supported by ${profile.modelId}`);
    } else {
      // Soft fall back to default
      const fallbackRatio = supportedRatios[0] || "9:16";
      warnings.push(`ASPECT_RATIO_NORMALIZED: ${aspectRatio} -> ${fallbackRatio}`);
      degradations.push("ASPECT_RATIO_DEGRADED");
      aspectRatio = fallbackRatio;
    }
  }

  // 2. Resolution Normalization
  let resolution = (raw.resolution || "720p").toLowerCase().trim();
  const supportedResolutions = profile.output.resolutions || ["720p", "1080p"];
  const resMatch = supportedResolutions.find(
    (r) => r.toLowerCase() === resolution || (resolution.includes("1080") && r.includes("1080")) || (resolution.includes("720") && r.includes("720"))
  );
  if (resMatch) {
    resolution = resMatch;
  } else {
    const fallbackRes = supportedResolutions[0] || "720p";
    warnings.push(`RESOLUTION_NORMALIZED: ${resolution} -> ${fallbackRes}`);
    degradations.push("RESOLUTION_DEGRADED");
    resolution = fallbackRes;
  }

  // 3. Duration Normalization
  let durationSec = typeof raw.durationSec === "number" && raw.durationSec > 0 ? raw.durationSec : 5;
  let durationString: string | undefined;

  const durationSpec = profile.output.duration;
  if (durationSpec?.supportedValues && durationSpec.supportedValues.length > 0) {
    if (!durationSpec.supportedValues.includes(durationSec)) {
      // Find closest supported value (preferring ceiling/higher on ties)
      const closest = durationSpec.supportedValues.reduce((prev, curr) => {
        const diffPrev = Math.abs(prev - durationSec);
        const diffCurr = Math.abs(curr - durationSec);
        if (diffCurr < diffPrev) return curr;
        if (diffCurr === diffPrev) return Math.max(prev, curr);
        return prev;
      });
      warnings.push(`DURATION_NORMALIZED: requested ${durationSec}s snapped to supported ${closest}s`);
      degradations.push("DURATION_DEGRADED");
      durationSec = closest;
    }
  } else {
    const min = durationSpec?.minSeconds ?? 1;
    const max = durationSpec?.maxSeconds ?? 15;
    if (durationSec < min) {
      warnings.push(`DURATION_NORMALIZED: clamped min from ${durationSec}s to ${min}s`);
      durationSec = min;
    } else if (durationSec > max) {
      warnings.push(`DURATION_NORMALIZED: clamped max from ${durationSec}s to ${max}s`);
      durationSec = max;
    }
  }

  // Provider specific string forms
  if (profile.providerId.toLowerCase() === "kling") {
    // Kling duration must be the number-string "5" or "10"
    durationString = durationSec > 5 ? "10" : "5";
    durationSec = durationString === "10" ? 10 : 5;
  } else {
    durationString = String(durationSec);
  }

  // 4. Audio Support
  let generateAudio = raw.generateAudio;
  const supportsAudio = profile.output.supportsNativeAudio ?? profile.audio.nativeAudioGeneration ?? false;
  if (generateAudio && !supportsAudio) {
    warnings.push(`NATIVE_AUDIO_UNSUPPORTED: Model ${profile.modelId} does not support native audio`);
    degradations.push("AUDIO_GENERATION_DEGRADED");
    generateAudio = false;
  }

  // 5. Kling Specific Modes
  let klingMode = raw.klingMode || "std";
  if (raw.hasLastFrame) {
    klingMode = "pro"; // Tail frame requires pro mode
  }

  return {
    params: {
      durationSec,
      durationString,
      aspectRatio,
      resolution,
      generateAudio,
      seed: raw.seed,
      klingMode,
      klingSound: raw.klingSound,
    },
    warnings,
    errors,
    degradations,
  };
}
