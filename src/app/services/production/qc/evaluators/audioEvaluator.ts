/**
 * Audio / dialogue QC — N/A for silent productions.
 */

import type { ProductionSpec } from "../../specification/productionSpec";
import type { ShotSpec } from "../../specification/shotSpec";
import type { ObservedVisualState, QCDimensionResult, QCFailure, QcEvidence } from "../types";
import { clampScore } from "./helpers";

export function evaluateAudio(params: {
  spec: ProductionSpec;
  shot?: ShotSpec;
  observed: ObservedVisualState;
  hasObservation: boolean;
  hasVoiceAsset?: boolean;
}): { dimension: QCDimensionResult; failures: QCFailure[] } {
  const { spec, shot, observed, hasObservation, hasVoiceAsset } = params;
  const silent =
    !spec.audio.hasNarration &&
    !spec.audio.hasDialogue &&
    !shot?.dialogue &&
    !shot?.narration;

  if (silent) {
    return {
      dimension: {
        id: "audio",
        applicability: "not_applicable",
        score: 100,
        status: "pass",
        evidence: [{ expected: "silent production", observed: "n/a", confidence: 1 }],
        failureCodes: [],
      },
      failures: [],
    };
  }

  const failures: QCFailure[] = [];
  const evidence: QcEvidence[] = [];
  let score = 100;
  const conf = observed.confidence ?? 0.8;

  const needsDialogue = Boolean(shot?.dialogue) || spec.audio.hasDialogue;
  const needsNarration = Boolean(shot?.narration) || spec.audio.hasNarration;

  if (needsNarration && hasVoiceAsset === false) {
    score -= 40;
    push("audio_missing", "Narration/voice asset missing", "narration present", "missing");
  }

  if (hasObservation) {
    if (needsDialogue && observed.dialoguePresent === false) {
      score -= 35;
      push("dialogue_missing", "Expected dialogue not present", shot?.dialogue || "dialogue", "absent");
    }
    if (needsNarration && observed.narrationPresent === false && hasVoiceAsset !== true) {
      score -= 30;
      push("audio_missing", "Expected narration not present", shot?.narration || "narration", "absent");
    }
    if (spec.audio.lipSyncRequired && observed.lipSyncOk === false) {
      score -= 30;
      push("lip_sync_failure", "Lip-sync failure", "lip sync ok", "failed");
    }
  } else if (hasVoiceAsset === undefined) {
    return {
      dimension: {
        id: "audio",
        applicability: "inconclusive",
        score: 72,
        status: "warn",
        evidence: [
          {
            expected: "audio presence check",
            observed: "insufficient evidence",
            confidence: 0.3,
            failureCode: "insufficient_visual_evidence",
          },
        ],
        failureCodes: ["insufficient_visual_evidence"],
      },
      failures: [],
    };
  }

  if (!failures.length) {
    evidence.push({
      expected: needsDialogue ? "dialogue" : "narration",
      observed: "audio requirements satisfied",
      confidence: conf,
    });
  }

  score = clampScore(score);
  return {
    dimension: {
      id: "audio",
      applicability: "applicable",
      score,
      status: score >= 80 ? "pass" : score >= 65 ? "warn" : score >= 45 ? "retry" : "fail",
      evidence,
      failureCodes: failures.map((f) => f.code),
    },
    failures,
  };

  function push(code: QCFailure["code"], message: string, expected: string, observedVal: string) {
    const ev: QcEvidence = { failureCode: code, expected, observed: observedVal, confidence: conf };
    evidence.push(ev);
    failures.push({ code, dimension: "audio", message, confidence: conf, evidence: ev, retryable: true });
  }
}
