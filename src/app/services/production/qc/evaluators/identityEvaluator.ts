/**
 * Identity consistency vs master characters / continuity identity pack.
 */

import type { ShotSpec } from "../../specification/shotSpec";
import type { ContinuityState } from "../../specification/continuitySpec";
import type { ObservedVisualState, QCDimensionResult, QCFailure, QcEvidence } from "../types";
import { clampScore, semanticOverlap } from "./helpers";

export function evaluateIdentity(params: {
  shot: ShotSpec;
  observed: ObservedVisualState;
  hasObservation: boolean;
  expectedContinuity?: ContinuityState;
}): { dimension: QCDimensionResult; failures: QCFailure[] } {
  const { shot, observed, hasObservation, expectedContinuity } = params;
  const hasCharacters = (shot.characterIds?.length || 0) > 0 || Boolean(expectedContinuity?.identity.characterRefs?.length);

  if (!hasCharacters) {
    return {
      dimension: {
        id: "identity",
        applicability: "not_applicable",
        score: 100,
        status: "pass",
        evidence: [{ expected: "no character subjects", observed: "n/a", confidence: 1 }],
        failureCodes: [],
      },
      failures: [],
    };
  }

  if (!hasObservation) {
    return {
      dimension: {
        id: "identity",
        applicability: "inconclusive",
        score: 70,
        status: "warn",
        evidence: [
          {
            expected: "identity lock",
            observed: "insufficient evidence",
            confidence: 0.2,
            failureCode: "insufficient_visual_evidence",
          },
        ],
        failureCodes: ["insufficient_visual_evidence"],
      },
      failures: [],
    };
  }

  const failures: QCFailure[] = [];
  const evidence: QcEvidence[] = [];
  const conf = observed.confidence ?? 0.85;
  let score = 100;

  if (observed.identity?.characterRefMatch === false) {
    score -= 40;
    const ev: QcEvidence = {
      failureCode: "identity_drift",
      expected: expectedContinuity?.identity.face || shot.subject,
      observed: observed.identity.face || "identity mismatch",
      confidence: conf,
    };
    evidence.push(ev);
    failures.push({
      code: "identity_drift",
      dimension: "identity",
      message: "Character identity drifted from master reference",
      confidence: conf,
      evidence: ev,
      retryable: true,
    });
  }

  const expectedFace = expectedContinuity?.identity.face;
  if (expectedFace && observed.identity?.face) {
    const ov = semanticOverlap(expectedFace, observed.identity.face);
    if (ov < 0.3) {
      score -= 35;
      const ev: QcEvidence = {
        failureCode: "identity_drift",
        expected: expectedFace,
        observed: observed.identity.face,
        confidence: conf,
      };
      evidence.push(ev);
      failures.push({
        code: "identity_drift",
        dimension: "identity",
        message: "Facial identity does not match continuity lock",
        confidence: conf,
        evidence: ev,
        retryable: true,
      });
    }
  }

  const expectedWardrobe = expectedContinuity?.wardrobe.clothing;
  if (expectedWardrobe && observed.identity?.clothing) {
    const ov = semanticOverlap(expectedWardrobe, observed.identity.clothing);
    if (ov < 0.25) {
      score -= 25;
      const ev: QcEvidence = {
        failureCode: "wardrobe_drift",
        expected: expectedWardrobe,
        observed: observed.identity.clothing,
        confidence: conf,
      };
      evidence.push(ev);
      failures.push({
        code: "wardrobe_drift",
        dimension: "identity",
        message: "Wardrobe drifted from continuity lock",
        confidence: conf,
        evidence: ev,
        retryable: true,
      });
    }
  }

  if (!failures.length) {
    evidence.push({
      expected: "identity lock preserved",
      observed: observed.identity?.face || "identity consistent",
      confidence: conf,
    });
  }

  score = clampScore(score);
  return {
    dimension: {
      id: "identity",
      applicability: "applicable",
      score,
      status: score >= 80 ? "pass" : score >= 65 ? "warn" : score >= 45 ? "retry" : "fail",
      evidence,
      failureCodes: failures.map((f) => f.code),
    },
    failures,
  };
}
