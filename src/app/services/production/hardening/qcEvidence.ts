/**
 * QC evidence gate helpers — PASS requires evidence; otherwise UNVERIFIED.
 * Does not create a second QC engine.
 */

export type QcEvidenceStatus = "PASS" | "FAIL" | "UNVERIFIED";

export interface QcEvidenceInput {
  dimension: string;
  expected?: string;
  observed?: string;
  evidenceAvailable: boolean;
  matches?: boolean;
  confidence?: number;
  intentionalChange?: boolean;
}

export interface QcEvidenceResult {
  status: QcEvidenceStatus;
  dimension: string;
  reason: string;
  severity: "none" | "low" | "medium" | "high";
  recommendedAction: "accept" | "repair" | "human_review" | "collect_evidence";
}

/**
 * Deterministic evidence gate:
 * - intentional change → PASS (not a continuity failure)
 * - no evidence → UNVERIFIED (never PASS)
 * - evidence + mismatch → FAIL
 * - evidence + match → PASS
 */
export function evaluateQcEvidence(input: QcEvidenceInput): QcEvidenceResult {
  if (input.intentionalChange) {
    return {
      status: "PASS",
      dimension: input.dimension,
      reason: "Intentional creative change — not a continuity failure",
      severity: "none",
      recommendedAction: "accept",
    };
  }
  if (!input.evidenceAvailable) {
    return {
      status: "UNVERIFIED",
      dimension: input.dimension,
      reason: "Insufficient visual evidence — cannot claim PASS",
      severity: "medium",
      recommendedAction: "collect_evidence",
    };
  }
  if (input.matches === false) {
    return {
      status: "FAIL",
      dimension: input.dimension,
      reason: `Mismatch: expected=${input.expected ?? "?"} observed=${input.observed ?? "?"}`,
      severity: "high",
      recommendedAction: "repair",
    };
  }
  return {
    status: "PASS",
    dimension: input.dimension,
    reason: "Evidence supports expected production state",
    severity: "none",
    recommendedAction: "accept",
  };
}

export function assertNoFakePass(results: QcEvidenceResult[]): {
  ok: boolean;
  fakePasses: string[];
} {
  const fakePasses = results
    .filter((r) => r.status === "PASS" && /insufficient|unverified|no evidence/i.test(r.reason))
    .map((r) => r.dimension);
  return { ok: fakePasses.length === 0, fakePasses };
}
