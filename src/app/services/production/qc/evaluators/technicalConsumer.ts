/**
 * Technical dimension — consumes Phase 4 technical validation; does not re-implement it.
 */

import type { TechnicalValidationResult } from "../../execution/types";
import type { QCDimensionResult, QCFailure, QcEvidence } from "../types";

export function evaluateTechnicalFromPhase4(params: {
  technical?: TechnicalValidationResult;
}): { dimension: QCDimensionResult; failures: QCFailure[] } {
  const { technical } = params;

  if (!technical) {
    return {
      dimension: {
        id: "technical",
        applicability: "inconclusive",
        score: 75,
        status: "warn",
        evidence: [
          {
            expected: "phase4 technical validation",
            observed: "not supplied",
            confidence: 0.3,
          },
        ],
        failureCodes: [],
      },
      failures: [],
    };
  }

  if (technical.ok) {
    return {
      dimension: {
        id: "technical",
        applicability: "applicable",
        score: 95,
        status: "pass",
        evidence: [
          {
            expected: "valid media file",
            observed: "phase4 technical validation passed",
            confidence: 0.95,
          },
        ],
        failureCodes: [],
      },
      failures: [],
    };
  }

  const failures: QCFailure[] = [];
  const evidence: QcEvidence[] = [];
  const reasons = technical.reasons || [];
  const codes: QCFailure["code"][] = [];

  for (const reason of reasons) {
    let code: QCFailure["code"] = "technical_failure";
    if (/duration/i.test(reason)) code = "duration_mismatch";
    else if (/aspect/i.test(reason)) code = "aspect_ratio_mismatch";
    codes.push(code);
    const ev: QcEvidence = {
      failureCode: code,
      expected: "spec-compliant media",
      observed: reason,
      confidence: 0.95,
    };
    evidence.push(ev);
    failures.push({
      code,
      dimension: "technical",
      message: reason,
      confidence: 0.95,
      evidence: ev,
      retryable: technical.retryable,
    });
  }

  return {
    dimension: {
      id: "technical",
      applicability: "applicable",
      score: Math.max(0, 40 - reasons.length * 5),
      status: "fail",
      evidence,
      failureCodes: [...new Set(codes)],
    },
    failures,
  };
}
