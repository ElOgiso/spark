/**
 * Technical output validation — not intelligent QC.
 * Ensures provider HTTP success is not treated as task success.
 */

import type { NormalizedMediaOutput, TechnicalValidationResult } from "./types";
import type { PreparedTaskInputs } from "./inputPreparation";

export interface ValidationExpectations {
  mediaType: "image" | "video" | "audio";
  aspectRatio?: string;
  durationSec?: number;
  /** Allow duration tolerance in seconds */
  durationToleranceSec?: number;
  minFileSizeBytes?: number;
  /** When true, aspect/duration mismatches are soft warnings only */
  allowNormalization?: boolean;
}

function parseAspect(ratio?: string): number | undefined {
  if (!ratio) return undefined;
  const m = /^(\d+(?:\.\d+)?)\s*[:/x]\s*(\d+(?:\.\d+)?)$/i.exec(ratio.trim());
  if (!m) return undefined;
  const w = Number(m[1]);
  const h = Number(m[2]);
  if (!(w > 0 && h > 0)) return undefined;
  return w / h;
}

function aspectClose(a: number, b: number, tol = 0.08): boolean {
  return Math.abs(a - b) <= tol;
}

export function validateNormalizedOutput(
  output: NormalizedMediaOutput,
  expectations: ValidationExpectations
): TechnicalValidationResult {
  const reasons: string[] = [];

  if (!output.sourceUrl && !output.localPath) {
    reasons.push("missing_media_url");
  }
  if (!output.mimeType) {
    reasons.push("missing_mime_type");
  }
  if (output.mediaType !== expectations.mediaType) {
    reasons.push("media_type_mismatch");
  }
  if ((output.fileSizeBytes ?? 1) <= 0) {
    reasons.push("zero_file_size");
  }
  if (
    expectations.minFileSizeBytes != null &&
    output.fileSizeBytes != null &&
    output.fileSizeBytes < expectations.minFileSizeBytes
  ) {
    reasons.push("file_too_small");
  }

  // Image / video readability proxies when dimensions present
  if (expectations.mediaType === "image" || expectations.mediaType === "video") {
    if (output.width != null && !(output.width > 0)) reasons.push("invalid_width");
    if (output.height != null && !(output.height > 0)) reasons.push("invalid_height");
  }

  if (expectations.mediaType === "video" || expectations.mediaType === "audio") {
    if (output.durationSec != null && !(output.durationSec > 0)) {
      reasons.push("invalid_duration");
    }
  }

  // Duration match
  if (
    expectations.durationSec != null &&
    output.durationSec != null &&
    !expectations.allowNormalization
  ) {
    const tol = expectations.durationToleranceSec ?? Math.max(1, expectations.durationSec * 0.25);
    if (Math.abs(output.durationSec - expectations.durationSec) > tol) {
      reasons.push("duration_mismatch");
    }
  }

  // Aspect ratio match when both known
  if (
    expectations.aspectRatio &&
    output.width &&
    output.height &&
    !expectations.allowNormalization
  ) {
    const expected = parseAspect(expectations.aspectRatio);
    const actual = output.width / output.height;
    if (expected != null && !aspectClose(expected, actual)) {
      reasons.push("aspect_ratio_mismatch");
    }
  }

  // MIME sanity
  if (output.mimeType) {
    if (expectations.mediaType === "video" && !output.mimeType.startsWith("video/")) {
      reasons.push("mime_type_mismatch");
    }
    if (expectations.mediaType === "image" && !output.mimeType.startsWith("image/")) {
      reasons.push("mime_type_mismatch");
    }
    if (expectations.mediaType === "audio" && !output.mimeType.startsWith("audio/")) {
      reasons.push("mime_type_mismatch");
    }
  }

  const mismatch = reasons.some((r) =>
    ["duration_mismatch", "aspect_ratio_mismatch", "media_type_mismatch", "mime_type_mismatch"].includes(r)
  );
  const fatal = reasons.some((r) =>
    ["missing_media_url", "zero_file_size", "invalid_duration", "file_too_small"].includes(r)
  );

  if (reasons.length === 0) {
    return { ok: true, reasons: [], retryable: false };
  }

  return {
    ok: false,
    code: mismatch ? "output_mismatch" : "output_invalid",
    reasons,
    retryable: fatal || mismatch,
  };
}

export function expectationsFromPrepared(
  prepared: PreparedTaskInputs,
  mediaType: "image" | "video" | "audio"
): ValidationExpectations {
  return {
    mediaType,
    aspectRatio: prepared.aspectRatio,
    durationSec: prepared.durationSec,
    durationToleranceSec: mediaType === "video" ? 2 : 1,
    minFileSizeBytes: 64,
  };
}
