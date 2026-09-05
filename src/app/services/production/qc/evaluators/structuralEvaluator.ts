/**
 * Structural QA — asset usability before expensive semantic analysis.
 * Deterministic / metadata checks only — never invents visual confidence.
 */

import type { ShotSpec } from "../../specification/shotSpec";
import type { TechnicalValidationResult } from "../../execution/types";
import type { ObservedVisualState, QCDimensionResult, QCFailure, QcEvidence } from "../types";
import { clampScore } from "./helpers";

export function evaluateStructural(params: {
  shot: ShotSpec;
  technical?: TechnicalValidationResult;
  sourceUrl?: string;
  mediaType?: "image" | "video" | "audio";
  observed?: ObservedVisualState;
}): { dimension: QCDimensionResult; failures: QCFailure[] } {
  const failures: QCFailure[] = [];
  const evidence: QcEvidence[] = [];
  let score = 100;

  const url = params.sourceUrl || params.shot.mediaUrl || params.shot.keyframeUrl;
  if (!url) {
    score = 0;
    const ev: QcEvidence = {
      failureCode: "asset_missing",
      expected: "generated media URL for shot",
      observed: "missing",
      confidence: 1,
    };
    evidence.push(ev);
    failures.push({
      code: "asset_missing",
      dimension: "structural",
      message: "Required media asset is missing",
      confidence: 1,
      evidence: ev,
      retryable: true,
      severity: "critical",
      requirementStrength: "hard",
    });
  } else {
    evidence.push({
      expected: "asset URL present",
      observed: url.slice(0, 120),
      confidence: 1,
    });
  }

  if (params.technical) {
    if (!params.technical.ok) {
      for (const reason of params.technical.reasons || []) {
        let code: QCFailure["code"] = "technical_failure";
        if (/duration/i.test(reason)) code = "duration_mismatch";
        else if (/aspect/i.test(reason)) code = "aspect_ratio_mismatch";
        else if (/resolution/i.test(reason)) code = "resolution_mismatch";
        else if (/orient/i.test(reason)) code = "orientation_mismatch";
        else if (/corrupt|unreadable|decode/i.test(reason)) code = "asset_unreadable";
        score -= 20;
        const ev: QcEvidence = {
          failureCode: code,
          expected: "technically valid media",
          observed: reason,
          confidence: 0.95,
        };
        evidence.push(ev);
        failures.push({
          code,
          dimension: "structural",
          message: reason,
          confidence: 0.95,
          evidence: ev,
          retryable: params.technical.retryable,
          severity: code === "asset_unreadable" ? "critical" : "fail",
          requirementStrength: "hard",
        });
      }
    } else {
      evidence.push({
        expected: "Phase 4 technical validation",
        observed: "passed",
        confidence: 0.95,
      });
    }
  } else {
    evidence.push({
      expected: "Phase 4 technical validation",
      observed: "not supplied",
      confidence: 0.3,
      note: "structural checks limited without technical validation",
      failureCode: "not_evaluated",
    });
  }

  if (params.observed?.notEvaluatedReasons?.length) {
    evidence.push({
      expected: "evaluable media",
      observed: params.observed.notEvaluatedReasons.join("; "),
      confidence: 0.2,
      failureCode: "not_evaluated",
    });
  }

  score = clampScore(score);
  const status = failures.some((f) => f.severity === "critical")
    ? "fail"
    : failures.length
      ? score >= 45
        ? "retry"
        : "fail"
      : params.technical
        ? "pass"
        : "warn";

  return {
    dimension: {
      id: "structural",
      applicability: "applicable",
      score: failures.some((f) => f.code === "asset_missing") ? 0 : score,
      status,
      evidence,
      failureCodes: failures.map((f) => f.code),
    },
    failures,
  };
}
