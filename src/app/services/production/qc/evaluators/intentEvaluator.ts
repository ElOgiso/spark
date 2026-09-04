/**
 * Prompt / intent adherence — planned shot purpose vs observed media.
 */

import type { ShotSpec } from "../../specification/shotSpec";
import type { ObservedVisualState, QCDimensionResult, QCFailure, QcEvidence } from "../types";
import { clampScore, semanticOverlap } from "./helpers";

export function evaluateIntent(params: {
  shot: ShotSpec;
  observed: ObservedVisualState;
  hasObservation: boolean;
}): { dimension: QCDimensionResult; failures: QCFailure[] } {
  const { shot, observed, hasObservation } = params;
  const evidence: QcEvidence[] = [];
  const failures: QCFailure[] = [];

  if (!hasObservation) {
    return {
      dimension: {
        id: "intent",
        applicability: "inconclusive",
        score: 70,
        status: "warn",
        evidence: [
          {
            expected: "visual analysis of generated media",
            observed: "insufficient evidence",
            confidence: 0.2,
          },
        ],
        failureCodes: ["insufficient_visual_evidence"],
      },
      failures: [],
    };
  }

  let score = 100;
  const conf = observed.confidence ?? 0.8;

  if (observed.subjectPresent === false) {
    score -= 45;
    const ev: QcEvidence = {
      failureCode: "subject_missing",
      expected: shot.subject,
      observed: "subject not present",
      confidence: conf,
    };
    evidence.push(ev);
    failures.push({
      code: "subject_missing",
      dimension: "intent",
      message: "Planned subject missing from generated media",
      confidence: conf,
      evidence: ev,
      retryable: true,
    });
  } else {
    const subj = semanticOverlap(shot.subject, observed.subject || shot.subject);
    if (subj < 0.35 && observed.subject) {
      score -= 30;
      const ev: QcEvidence = {
        failureCode: "subject_missing",
        expected: shot.subject,
        observed: observed.subject,
        confidence: conf,
      };
      evidence.push(ev);
      failures.push({
        code: "subject_missing",
        dimension: "intent",
        message: "Subject does not match planned shot",
        confidence: conf,
        evidence: ev,
        retryable: true,
      });
    } else {
      evidence.push({
        expected: shot.subject,
        observed: observed.subject || "subject present",
        confidence: conf,
      });
    }
  }

  const actionOverlap = semanticOverlap(shot.subjectAction, observed.action);
  if (shot.subjectAction && actionOverlap < 0.25) {
    score -= 28;
    const ev: QcEvidence = {
      failureCode: "action_missing",
      expected: shot.subjectAction,
      observed: observed.action || "action not detected",
      confidence: conf,
    };
    evidence.push(ev);
    failures.push({
      code: "action_missing",
      dimension: "intent",
      message: "Intended action not observed",
      confidence: conf,
      evidence: ev,
      retryable: true,
    });
  }

  const envOverlap = semanticOverlap(shot.environment, observed.environment);
  if (shot.environment && observed.environment && envOverlap < 0.2) {
    score -= 18;
    const ev: QcEvidence = {
      failureCode: "prompt_mismatch",
      expected: shot.environment,
      observed: observed.environment,
      confidence: conf,
    };
    evidence.push(ev);
    failures.push({
      code: "prompt_mismatch",
      dimension: "intent",
      message: "Environment diverges from planned shot",
      confidence: conf,
      evidence: ev,
      retryable: true,
    });
  }

  score = clampScore(score);
  const status = score >= 80 ? "pass" : score >= 65 ? "warn" : score >= 45 ? "retry" : "fail";

  return {
    dimension: {
      id: "intent",
      applicability: "applicable",
      score,
      status,
      evidence,
      failureCodes: failures.map((f) => f.code),
    },
    failures,
  };
}
