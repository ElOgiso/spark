/**
 * Coverage / cinematic-purpose QA — planned shot purpose & coverage role vs observed framing.
 */

import type { ShotSpec } from "../../specification/shotSpec";
import type { SceneSpec } from "../../specification/sceneSpec";
import type {
  ObservedVisualState,
  ProductionQCResult,
  QCDimensionResult,
  QCFailure,
  QcEvidence,
} from "../types";
import { clampScore, cameraMoveBucket, shotSizeBucket } from "./helpers";

function purposeBucket(purpose: string | undefined): string {
  const p = (purpose || "").toLowerCase();
  if (/establish|wide|master|location/.test(p)) return "establish";
  if (/reaction|close|ecu|detail/.test(p)) return "reaction";
  if (/insert|product|prop/.test(p)) return "insert";
  if (/coverage|medium|two.?shot|ots|over/.test(p)) return "coverage";
  if (/action|move|walk|enter/.test(p)) return "action";
  return p || "general";
}

export function evaluateCinematicCoverage(params: {
  shot: ShotSpec;
  observed: ObservedVisualState;
  hasObservation: boolean;
}): { dimension: QCDimensionResult; failures: QCFailure[] } {
  const failures: QCFailure[] = [];
  const evidence: QcEvidence[] = [];
  const conf = params.observed.confidence ?? 0.8;

  if (!params.hasObservation) {
    return {
      dimension: {
        id: "coverage",
        applicability: "inconclusive",
        score: 72,
        status: "warn",
        evidence: [
          {
            expected: params.shot.purpose || "cinematic purpose",
            observed: "insufficient visual evidence",
            confidence: 0.2,
            failureCode: "insufficient_visual_evidence",
          },
        ],
        failureCodes: ["insufficient_visual_evidence"],
      },
      failures: [],
    };
  }

  let score = 100;
  const plannedPurpose = purposeBucket(params.shot.purpose || params.shot.productionReason);
  const observedSize = shotSizeBucket(params.observed.shotSize || params.observed.framing);
  const plannedSize = shotSizeBucket(params.shot.camera.shotType || params.shot.camera.framing);

  if (plannedPurpose === "establish" && observedSize === "ecu") {
    score -= 35;
    const ev: QcEvidence = {
      failureCode: "cinematic_purpose_mismatch",
      expected: `purpose=${params.shot.purpose} (establish)`,
      observed: `framing=${params.observed.shotSize || params.observed.framing}`,
      confidence: conf,
    };
    evidence.push(ev);
    failures.push({
      code: "cinematic_purpose_mismatch",
      dimension: "coverage",
      message: "Shot does not perform its establishing purpose",
      confidence: conf,
      evidence: ev,
      retryable: true,
      severity: "fail",
      requirementStrength: "hard",
    });
  }

  if (plannedPurpose === "reaction" && observedSize === "wide") {
    score -= 30;
    const ev: QcEvidence = {
      failureCode: "coverage_role_mismatch",
      expected: `purpose=${params.shot.purpose}`,
      observed: `framing=${params.observed.shotSize || "wide"}`,
      confidence: conf,
    };
    evidence.push(ev);
    failures.push({
      code: "coverage_role_mismatch",
      dimension: "coverage",
      message: "Coverage role does not match planned reaction/close framing",
      confidence: conf,
      evidence: ev,
      retryable: true,
      severity: "fail",
      requirementStrength: "hard",
    });
  }

  if (plannedSize && observedSize && plannedSize !== observedSize) {
    score -= 15;
    const ev: QcEvidence = {
      failureCode: "framing_mismatch",
      expected: String(params.shot.camera.shotType),
      observed: params.observed.shotSize || params.observed.framing || "unknown",
      confidence: conf,
      note: "framing deviation vs planned coverage",
    };
    evidence.push(ev);
    failures.push({
      code: "framing_mismatch",
      dimension: "coverage",
      message: "Framing diverges from planned coverage",
      confidence: conf,
      evidence: ev,
      retryable: true,
      severity: "warning",
      requirementStrength: "soft",
    });
  }

  const plannedMove = cameraMoveBucket(String(params.shot.camera.cameraMovement));
  const observedMove = cameraMoveBucket(params.observed.cameraMovement);
  if (plannedMove === "push_in" && observedMove === "static") {
    score -= 25;
    const ev: QcEvidence = {
      failureCode: "camera_intent_mismatch",
      expected: String(params.shot.camera.cameraMovement),
      observed: params.observed.cameraMovement || "static",
      confidence: conf,
    };
    evidence.push(ev);
    failures.push({
      code: "camera_intent_mismatch",
      dimension: "coverage",
      message: "Camera movement does not perform planned cinematic intent",
      confidence: conf,
      evidence: ev,
      retryable: true,
      severity: "fail",
      requirementStrength: "hard",
    });
  }

  if (!failures.length) {
    evidence.push({
      expected: params.shot.purpose,
      observed: "cinematic purpose / coverage role satisfied",
      confidence: conf,
    });
  }

  score = clampScore(score);
  return {
    dimension: {
      id: "coverage",
      applicability: "applicable",
      score,
      status: score >= 80 ? "pass" : score >= 65 ? "warn" : score >= 45 ? "retry" : "fail",
      evidence,
      failureCodes: failures.map((f) => f.code),
    },
    failures,
  };
}

/** Scene-level coverage completeness against planned shots */
export function evaluateSceneCoverageCompleteness(params: {
  scene: SceneSpec;
  shotResults: ProductionQCResult[];
}): { failures: QCFailure[]; evidence: QcEvidence[] } {
  const failures: QCFailure[] = [];
  const evidence: QcEvidence[] = [];
  const purposes = params.scene.shots.map((s) => purposeBucket(s.purpose || s.productionReason));
  const approved = new Set(
    params.shotResults.filter((r) => r.status === "pass" || r.status === "warn").map((r) => r.shotId)
  );
  const missingRequired = params.scene.shots.filter((s) => {
    const bucket = purposeBucket(s.purpose || s.productionReason);
    const required = bucket === "establish" || bucket === "coverage" || bucket === "action" || bucket === "reaction";
    return required && !approved.has(s.id);
  });
  if (missingRequired.length) {
    const ev: QcEvidence = {
      failureCode: "coverage_gap",
      expected: `required coverage for ${purposes.join(",")}`,
      observed: `missing/failed: ${missingRequired.map((s) => s.id).join(",")}`,
      confidence: 0.95,
    };
    evidence.push(ev);
    failures.push({
      code: "coverage_gap",
      dimension: "coverage",
      message: "Required scene coverage incomplete",
      confidence: 0.95,
      evidence: ev,
      retryable: true,
      severity: "fail",
      requirementStrength: "hard",
    });
  } else {
    evidence.push({
      expected: "required coverage present",
      observed: "ok",
      confidence: 0.9,
    });
  }
  return { failures, evidence };
}
