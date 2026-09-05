/**
 * Start/end/handoff QA — expected continuity bridges + motion begin/end
 * vs observed temporal snapshots when available.
 */

import type { ShotSpec } from "../../specification/shotSpec";
import type { ShotContinuityBridge } from "../../specification/continuitySpec";
import type {
  ObservedVisualState,
  QCDimensionResult,
  QCFailure,
  QcEvidence,
  HandoffQcFinding,
} from "../types";
import { clampScore, semanticOverlap, normalizeText } from "./helpers";

function frameText(
  frames: Array<{ role: string; description?: string }> | undefined,
  role: string
): string | undefined {
  return frames?.find((f) => f.role === role)?.description;
}

export function evaluateHandoff(params: {
  shot: ShotSpec;
  nextShot?: ShotSpec;
  bridge?: ShotContinuityBridge;
  nextBridge?: ShotContinuityBridge;
  observed: ObservedVisualState;
  hasObservation: boolean;
  frames?: Array<{ role: "begin" | "middle" | "end" | "representative"; description?: string; url?: string }>;
}): { dimension: QCDimensionResult; failures: QCFailure[]; handoff?: HandoffQcFinding } {
  const failures: QCFailure[] = [];
  const evidence: QcEvidence[] = [];
  const conf = params.observed.confidence ?? 0.8;
  let score = 100;

  if (!params.hasObservation) {
    return {
      dimension: {
        id: "handoff",
        applicability: "inconclusive",
        score: 70,
        status: "warn",
        evidence: [
          {
            expected: params.shot.motion.beginState || "start/end continuity",
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

  const expectedStart =
    params.shot.motion.beginState || params.bridge?.continuityIn.summary || params.shot.blocking;
  const observedStart =
    params.observed.beginState || frameText(params.frames, "begin") || params.observed.action;

  if (expectedStart && observedStart && semanticOverlap(expectedStart, observedStart) <= 0.25) {
    score -= 28;
    const ev: QcEvidence = {
      failureCode: "start_state_mismatch",
      expected: expectedStart,
      observed: observedStart,
      confidence: conf,
    };
    evidence.push(ev);
    failures.push({
      code: "start_state_mismatch",
      dimension: "handoff",
      message: "Generated start state does not match expected continuity start",
      confidence: conf,
      evidence: ev,
      retryable: true,
      severity: "fail",
      requirementStrength: "hard",
    });
  }

  const expectedEnd =
    params.shot.motion.endState || params.bridge?.continuityOut.summary || params.shot.subjectAction;
  const observedEnd =
    params.observed.endState || frameText(params.frames, "end") || params.observed.action;

  if (expectedEnd && observedEnd && semanticOverlap(expectedEnd, observedEnd) <= 0.25) {
    score -= 28;
    const ev: QcEvidence = {
      failureCode: "end_state_mismatch",
      expected: expectedEnd,
      observed: observedEnd,
      confidence: conf,
    };
    evidence.push(ev);
    failures.push({
      code: "end_state_mismatch",
      dimension: "handoff",
      message: "Generated end state does not match expected continuity end",
      confidence: conf,
      evidence: ev,
      retryable: true,
      severity: "fail",
      requirementStrength: "hard",
    });
  }

  const expectedProps = params.bridge?.continuityOut.props || [];
  if (expectedProps.length && (params.observed.props || params.observed.heldProps)) {
    for (const p of expectedProps) {
      const hay = `${(params.observed.props || []).join(" ")} ${(params.observed.heldProps || []).join(" ")} ${
        observedEnd || ""
      }`;
      const id = p.identity || p.propId;
      if (semanticOverlap(id, hay) < 0.2 && !normalizeText(hay).includes(normalizeText(id).slice(0, 4))) {
        score -= 18;
        const ev: QcEvidence = {
          failureCode: "prop_missing",
          expected: `${id} present (${p.state || "any state"})`,
          observed: hay || "none",
          confidence: conf,
        };
        evidence.push(ev);
        failures.push({
          code: "prop_missing",
          dimension: "handoff",
          message: `Expected prop ${id} missing at shot end`,
          confidence: conf,
          evidence: ev,
          retryable: true,
          severity: "fail",
          requirementStrength: "hard",
        });
      }
    }
  }

  let handoff: HandoffQcFinding | undefined;
  if (params.nextShot) {
    const nextExpectedStart =
      params.nextShot.motion.beginState ||
      params.nextBridge?.continuityIn.summary ||
      params.nextShot.blocking;
    if (expectedEnd && nextExpectedStart && observedEnd) {
      // Observed end must satisfy the next shot's expected start.
      // Planned end→start consistency alone must not pass a bad observation.
      const ok = semanticOverlap(observedEnd, nextExpectedStart) >= 0.25;
      if (!ok) {
        score -= 30;
        const ev: QcEvidence = {
          failureCode: "handoff_failure",
          expected: `end→start: ${expectedEnd} → ${nextExpectedStart}`,
          observed: observedEnd,
          confidence: conf,
        };
        evidence.push(ev);
        failures.push({
          code: "handoff_failure",
          dimension: "handoff",
          message: `Handoff continuity failure into ${params.nextShot.id}`,
          confidence: conf,
          evidence: ev,
          retryable: true,
          severity: "fail",
          requirementStrength: "hard",
        });
      }
      handoff = {
        fromShotId: params.shot.id,
        toShotId: params.nextShot.id,
        status: ok ? "pass" : "fail",
        failures: failures.filter((f) => f.code === "handoff_failure"),
        expectedEnd,
        expectedStart: nextExpectedStart,
        observedEnd,
      };
    }
  }

  if (!failures.length) {
    evidence.push({
      expected: "start/end/handoff compatible with continuity bridges",
      observed: "compatible",
      confidence: conf,
    });
  }

  score = clampScore(score);
  return {
    dimension: {
      id: "handoff",
      applicability: "applicable",
      score,
      status: score >= 80 ? "pass" : score >= 65 ? "warn" : score >= 45 ? "retry" : "fail",
      evidence,
      failureCodes: failures.map((f) => f.code),
    },
    failures,
    handoff,
  };
}
