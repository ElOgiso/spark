/**
 * Final master technical QC — reuses Phase 4 validation patterns.
 */

import type { TechnicalValidationResult } from "../../execution/types";
import type { DeliveryVariant } from "../types";
import type { MasterOutput } from "./types";

export interface FinalMasterQcResult {
  ok: boolean;
  technical: TechnicalValidationResult;
  reasons: string[];
}

export function validateMasterOutput(params: {
  output: MasterOutput;
  variant: DeliveryVariant;
  expectAudio?: boolean;
  expectCaptions?: boolean;
  captionCount?: number;
}): FinalMasterQcResult {
  const reasons: string[] = [];
  const { output, variant } = params;

  if (!output.mediaUrl && !output.productionAsset?.publicUrl) {
    reasons.push("output_missing");
  }
  if (!output.mimeType) reasons.push("mime_missing");
  if (!(output.durationSec > 0)) reasons.push("duration_invalid");

  if (variant.maxDurationSec && output.durationSec > variant.maxDurationSec + 0.5) {
    reasons.push("duration_exceeds_variant_limit");
  }

  if (
    output.resolution.width !== variant.resolution.width ||
    output.resolution.height !== variant.resolution.height
  ) {
    reasons.push("resolution_mismatch");
  }

  if (output.aspectRatio && output.aspectRatio !== variant.aspectRatio) {
    reasons.push("aspect_ratio_mismatch");
  }

  if (variant.codec && output.codec && output.codec !== variant.codec) {
    reasons.push("codec_mismatch");
  }

  if (params.expectAudio && output.productionAsset?.assetType === "video") {
    // Cannot deeply inspect audio tracks without runtime — soft check via metadata
    const hasAudioMeta = output.productionAsset.generationSettings?.hasAudio;
    if (hasAudioMeta === false) reasons.push("audio_missing");
  }

  if (
    params.expectCaptions &&
    (variant.captionPolicy === "burn_in" || variant.captionPolicy === "sidecar") &&
    (params.captionCount || 0) === 0
  ) {
    reasons.push("captions_missing");
  }

  if (output.fileSizeBytes !== undefined && output.fileSizeBytes <= 0) {
    reasons.push("file_size_invalid");
  }

  const ok = reasons.length === 0;
  return {
    ok,
    reasons,
    technical: {
      ok,
      code: ok ? undefined : "output_invalid",
      reasons,
      retryable: reasons.some((r) => r !== "output_missing"),
    },
  };
}
