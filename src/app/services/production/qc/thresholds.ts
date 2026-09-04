/**
 * Centralized QC acceptance thresholds — not scattered hard-codes.
 * Tolerance may vary by quality target / production mode later.
 */

import type { QualityTarget } from "../specification/qualitySpec";
import type { QcResultStatus } from "./types";

export interface QcThresholdConfig {
  /** Score >= accept → pass */
  acceptMin: number;
  /** Score >= warnMin and < acceptMin → warn */
  warnMin: number;
  /** Score >= retryMin and < warnMin → retry; below → fail */
  retryMin: number;
  /** Per-dimension minimum before that dimension alone forces retry */
  dimensionRetryFloor: number;
  /** Critical failure codes always force retry/fail regardless of score */
  criticalCodesForceRetry: boolean;
}

export const DEFAULT_QC_THRESHOLDS: QcThresholdConfig = {
  acceptMin: 80,
  warnMin: 70,
  retryMin: 50,
  dimensionRetryFloor: 55,
  criticalCodesForceRetry: true,
};

export function thresholdsForQualityTarget(target: QualityTarget): QcThresholdConfig {
  switch (target) {
    case "draft":
      return { ...DEFAULT_QC_THRESHOLDS, acceptMin: 65, warnMin: 55, retryMin: 40, dimensionRetryFloor: 45 };
    case "social":
      return { ...DEFAULT_QC_THRESHOLDS, acceptMin: 75, warnMin: 65, retryMin: 45, dimensionRetryFloor: 50 };
    case "broadcast":
      return { ...DEFAULT_QC_THRESHOLDS, acceptMin: 85, warnMin: 75, retryMin: 55, dimensionRetryFloor: 60 };
    case "cinema":
      return { ...DEFAULT_QC_THRESHOLDS, acceptMin: 88, warnMin: 78, retryMin: 58, dimensionRetryFloor: 62 };
    default:
      return { ...DEFAULT_QC_THRESHOLDS };
  }
}

export function statusFromScore(
  score: number,
  thresholds: QcThresholdConfig = DEFAULT_QC_THRESHOLDS
): QcResultStatus {
  if (score >= thresholds.acceptMin) return "pass";
  if (score >= thresholds.warnMin) return "warn";
  if (score >= thresholds.retryMin) return "retry";
  return "fail";
}
