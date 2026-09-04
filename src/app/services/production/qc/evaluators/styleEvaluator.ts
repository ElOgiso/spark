/**
 * Style / visual coherence vs VisualStyleSpec — not generic "cinematic" taste.
 */

import type { ProductionSpec } from "../../specification/productionSpec";
import type { ShotSpec } from "../../specification/shotSpec";
import type { ObservedVisualState, QCDimensionResult, QCFailure, QcEvidence } from "../types";
import { clampScore, semanticOverlap } from "./helpers";

export function evaluateStyle(params: {
  spec: ProductionSpec;
  shot: ShotSpec;
  observed: ObservedVisualState;
  hasObservation: boolean;
}): { dimension: QCDimensionResult; failures: QCFailure[] } {
  const { spec, shot, observed, hasObservation } = params;

  if (!hasObservation) {
    return {
      dimension: {
        id: "style",
        applicability: "inconclusive",
        score: 72,
        status: "warn",
        evidence: [
          {
            expected: spec.visualStyle.look || spec.visualStyle.lightingLanguage,
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
  const conf = observed.confidence ?? 0.8;
  let score = 100;

  const plannedStyle = [
    spec.visualStyle.look,
    spec.visualStyle.lightingLanguage,
    spec.visualStyle.colorLanguage,
    shot.atmosphere,
    shot.color,
  ]
    .filter(Boolean)
    .join(" ");

  if (observed.style || observed.colorIntent || observed.lighting) {
    const obs = [observed.style, observed.colorIntent, observed.lighting].filter(Boolean).join(" ");
    const ov = semanticOverlap(plannedStyle, obs);
    if (plannedStyle && ov < 0.15) {
      score -= 28;
      const ev: QcEvidence = {
        failureCode: "style_mismatch",
        expected: plannedStyle.slice(0, 160),
        observed: obs.slice(0, 160),
        confidence: conf,
      };
      evidence.push(ev);
      failures.push({
        code: "style_mismatch",
        dimension: "style",
        message: "Visual style diverges from planned VisualStyleSpec",
        confidence: conf,
        evidence: ev,
        retryable: true,
      });
    } else {
      evidence.push({
        expected: plannedStyle.slice(0, 120) || "planned style",
        observed: "style coherent with plan",
        confidence: conf,
      });
    }
  } else {
    evidence.push({
      expected: plannedStyle.slice(0, 120) || "planned style",
      observed: "style signals not reported — treated as inconclusive soft pass",
      confidence: 0.4,
    });
    score = 78;
  }

  score = clampScore(score);
  return {
    dimension: {
      id: "style",
      applicability: "applicable",
      score,
      status: score >= 80 ? "pass" : score >= 65 ? "warn" : score >= 45 ? "retry" : "fail",
      evidence,
      failureCodes: failures.map((f) => f.code),
    },
    failures,
  };
}
