/**
 * Motion / action adherence — semantic, not pixel-exact.
 */

import type { ShotSpec } from "../../specification/shotSpec";
import type { ObservedVisualState, QCDimensionResult, QCFailure, QcEvidence } from "../types";
import { cameraMoveBucket, clampScore, semanticOverlap } from "./helpers";

export function evaluateMotion(params: {
  shot: ShotSpec;
  observed: ObservedVisualState;
  hasObservation: boolean;
  mediaType: "image" | "video" | "audio";
}): { dimension: QCDimensionResult; failures: QCFailure[] } {
  const { shot, observed, hasObservation, mediaType } = params;

  if (mediaType === "image" || mediaType === "audio") {
    return {
      dimension: {
        id: "motion",
        applicability: "not_applicable",
        score: 100,
        status: "pass",
        evidence: [{ expected: "n/a for still/audio", observed: "n/a", confidence: 1 }],
        failureCodes: [],
      },
      failures: [],
    };
  }

  if (!hasObservation) {
    return {
      dimension: {
        id: "motion",
        applicability: "inconclusive",
        score: 70,
        status: "warn",
        evidence: [
          {
            expected: shot.subjectAction || shot.motion.beginState,
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

  const needsMotion =
    Boolean(shot.subjectAction?.trim()) ||
    cameraMoveBucket(shot.camera.cameraMovement) !== "static" ||
    Boolean(shot.motion.subjectMovement && shot.motion.subjectMovement !== "none");

  if (needsMotion && observed.motionOccurred === false) {
    score -= 35;
    const ev: QcEvidence = {
      failureCode: "motion_mismatch",
      expected: shot.subjectAction || shot.motion.subjectMovement || String(shot.camera.cameraMovement),
      observed: "no meaningful motion detected",
      confidence: conf,
    };
    evidence.push(ev);
    failures.push({
      code: "motion_mismatch",
      dimension: "motion",
      message: "Expected motion/action did not occur",
      confidence: conf,
      evidence: ev,
      retryable: true,
    });
  }

  const actionOverlap = semanticOverlap(
    `${shot.subjectAction} ${shot.motion.subjectMovement}`,
    observed.action
  );
  if (shot.subjectAction && observed.action && actionOverlap < 0.2) {
    score -= 25;
    const ev: QcEvidence = {
      failureCode: "action_missing",
      expected: shot.subjectAction,
      observed: observed.action,
      confidence: conf,
    };
    evidence.push(ev);
    failures.push({
      code: "action_missing",
      dimension: "motion",
      message: "Observed action diverges from planned motion direction",
      confidence: conf,
      evidence: ev,
      retryable: true,
    });
  }

  if (!failures.length) {
    evidence.push({
      expected: shot.motion.endState || shot.subjectAction,
      observed: observed.action || "motion intent satisfied",
      confidence: conf,
    });
  }

  score = clampScore(score);
  return {
    dimension: {
      id: "motion",
      applicability: "applicable",
      score,
      status: score >= 80 ? "pass" : score >= 65 ? "warn" : score >= 45 ? "retry" : "fail",
      evidence,
      failureCodes: failures.map((f) => f.code),
    },
    failures,
  };
}
