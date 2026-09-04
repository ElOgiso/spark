/**
 * Extensible performance diagnosis helpers.
 */

import type { DiagnosisCode, EvidenceStrength, PerformanceDiagnosis } from "./types";

export const KNOWN_DIAGNOSIS_CODES: DiagnosisCode[] = [
  "strong_hook",
  "weak_hook",
  "strong_retention",
  "weak_retention",
  "strong_shareability",
  "weak_shareability",
  "strong_conversion",
  "weak_conversion",
  "audience_mismatch",
  "format_mismatch",
  "duration_mismatch",
  "weak_payoff",
  "strong_payoff",
  "strong_brand_fit",
  "weak_brand_fit",
  "mixed_signals",
  "insufficient_evidence",
  "strong_engagement",
  "weak_engagement",
];

export function makeDiagnosis(
  code: DiagnosisCode,
  summary: string,
  opts?: {
    strength?: EvidenceStrength;
    metricKeys?: string[];
    relatedDnaKeys?: string[];
  }
): PerformanceDiagnosis {
  return {
    code,
    strength: opts?.strength ?? "observed",
    metricKeys: opts?.metricKeys ?? [],
    summary,
    relatedDnaKeys: opts?.relatedDnaKeys,
  };
}
