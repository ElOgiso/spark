/**
 * Cinematography adherence — shot size, framing, angle, movement vs ShotSpec.
 * Distinguishes intent preserved vs material violation; ignores harmless variation.
 */

import type { ShotSpec } from "../../specification/shotSpec";
import type { ObservedVisualState, QCDimensionResult, QCFailure, QcEvidence } from "../types";
import { cameraMoveBucket, clampScore, shotSizeBucket, semanticOverlap } from "./helpers";

export function evaluateCinematography(params: {
  shot: ShotSpec;
  observed: ObservedVisualState;
  hasObservation: boolean;
}): { dimension: QCDimensionResult; failures: QCFailure[] } {
  const { shot, observed, hasObservation } = params;

  if (!hasObservation) {
    return {
      dimension: {
        id: "cinematography",
        applicability: "inconclusive",
        score: 72,
        status: "warn",
        evidence: [
          {
            expected: `${shot.camera.shotType} / ${shot.camera.cameraMovement}`,
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

  const plannedSize = shotSizeBucket(shot.camera.shotType || shot.camera.framing);
  const observedSize = shotSizeBucket(observed.shotSize || observed.framing);
  if (plannedSize && observedSize && plannedSize !== observedSize) {
    // Harmless: medium vs close-medium — still same bucket family check already done
    score -= 28;
    const ev: QcEvidence = {
      failureCode: "composition_mismatch",
      expected: shot.camera.shotType,
      observed: observed.shotSize || observed.framing || "unknown",
      confidence: conf,
      note: "material framing violation",
    };
    evidence.push(ev);
    failures.push({
      code: "composition_mismatch",
      dimension: "cinematography",
      message: "Shot size / framing materially differs from plan",
      confidence: conf,
      evidence: ev,
      retryable: true,
    });
  }

  const plannedMove = cameraMoveBucket(shot.camera.cameraMovement);
  const observedMove = cameraMoveBucket(observed.cameraMovement);
  if (plannedMove && observedMove && plannedMove !== observedMove) {
    // Static vs push-in is material; pan vs tilt both "moving-ish" — still mismatch
    score -= 30;
    const ev: QcEvidence = {
      failureCode: "camera_mismatch",
      expected: String(shot.camera.cameraMovement),
      observed: observed.cameraMovement || "unknown",
      confidence: conf,
      note: "instruction materially violated",
    };
    evidence.push(ev);
    failures.push({
      code: "camera_mismatch",
      dimension: "cinematography",
      message: "Camera movement does not match planned cinematography",
      confidence: conf,
      evidence: ev,
      retryable: true,
    });
  }

  if (shot.camera.composition && observed.composition) {
    if (semanticOverlap(shot.camera.composition, observed.composition) < 0.2) {
      score -= 12;
      evidence.push({
        failureCode: "composition_mismatch",
        expected: shot.camera.composition,
        observed: observed.composition,
        confidence: conf,
        note: "composition drift — may be harmless",
      });
    }
  }

  if (!failures.length) {
    evidence.push({
      expected: `${shot.camera.shotType}, ${shot.camera.cameraMovement}`,
      observed: "cinematography intent preserved",
      confidence: conf,
    });
  }

  score = clampScore(score);
  return {
    dimension: {
      id: "cinematography",
      applicability: "applicable",
      score,
      status: score >= 80 ? "pass" : score >= 65 ? "warn" : score >= 45 ? "retry" : "fail",
      evidence,
      failureCodes: failures.map((f) => f.code),
    },
    failures,
  };
}
