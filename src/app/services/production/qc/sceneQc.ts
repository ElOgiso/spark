/**
 * Scene-level QC — reuses shot QC results; no redundant expensive analysis.
 */

import type { ProductionSpec } from "../specification/productionSpec";
import type { SceneSpec } from "../specification/sceneSpec";
import type { ProductionQCResult, QCFailure, QCDimensionResult } from "./types";
import { aggregateScores, collectWarnings, deriveOverallStatus, defaultActionForStatus } from "./scoring";
import { thresholdsForQualityTarget } from "./thresholds";
import { userFacingQcAction, userFacingFailureSummary } from "./userMessages";

function newQcId(): string {
  return `qc_scene_${Math.random().toString(36).slice(2, 10)}`;
}

export function evaluateSceneQc(params: {
  spec: ProductionSpec;
  scene: SceneSpec;
  shotResults: ProductionQCResult[];
}): ProductionQCResult {
  const { scene, shotResults, spec } = params;
  const plannedShotIds = scene.shots.map((s) => s.id);
  const covered = new Set(shotResults.filter((r) => r.shotId).map((r) => r.shotId!));
  const missing = plannedShotIds.filter((id) => !covered.has(id));

  const failures: QCFailure[] = [];
  const dimensions: QCDimensionResult[] = [];

  // Aggregate child scores into synthetic dimensions
  const childOverall =
    shotResults.length === 0
      ? 0
      : Math.round(shotResults.reduce((a, r) => a + r.score, 0) / shotResults.length);

  for (const child of shotResults) {
    failures.push(...child.failures.filter((f) => f.code !== "insufficient_visual_evidence"));
  }

  if (missing.length) {
    failures.push({
      code: "coverage_gap",
      dimension: "intent",
      message: `Missing QC for planned shots: ${missing.join(", ")}`,
      confidence: 1,
      evidence: {
        failureCode: "coverage_gap",
        expected: plannedShotIds.join(","),
        observed: [...covered].join(","),
        confidence: 1,
      },
      retryable: true,
    });
  }

  const failedShots = shotResults.filter((r) => r.status === "fail" || r.status === "retry");
  dimensions.push({
    id: "intent",
    applicability: "applicable",
    score: missing.length ? Math.max(20, childOverall - 30) : childOverall,
    status: missing.length ? "retry" : failedShots.length ? "retry" : "pass",
    evidence: [
      {
        expected: `${plannedShotIds.length} shots`,
        observed: `${shotResults.length} evaluated`,
        confidence: 0.95,
      },
    ],
    failureCodes: missing.length ? ["coverage_gap"] : [],
  });

  dimensions.push({
    id: "continuity",
    applicability: "applicable",
    score: Math.round(
      shotResults
        .map((r) => r.scores.dimensions.continuity ?? r.score)
        .reduce((a, b, _, arr) => a + b / arr.length, 0) || childOverall
    ),
    status: shotResults.some((r) => (r.scores.dimensions.continuity ?? 100) < 60) ? "retry" : "pass",
    evidence: [
      {
        expected: "scene continuity integrity",
        observed: failedShots.length ? "continuity issues in child shots" : "ok",
        confidence: 0.85,
      },
    ],
    failureCodes: shotResults.flatMap((r) =>
      r.failures.filter((f) => f.dimension === "continuity").map((f) => f.code)
    ),
  });

  dimensions.push({
    id: "style",
    applicability: "applicable",
    score: Math.round(
      shotResults
        .map((r) => r.scores.dimensions.style ?? r.score)
        .reduce((a, b, _, arr) => a + b / arr.length, 0) || childOverall
    ),
    status: "pass",
    evidence: [
      {
        expected: spec.visualStyle.look,
        observed: "aggregated from shot QC",
        confidence: 0.7,
      },
    ],
    failureCodes: [],
  });

  // Narrative coherence proxy: all shots have productionReason already planned
  const incoherent = scene.shots.filter((s) => !s.productionReason?.trim());
  if (incoherent.length) {
    failures.push({
      code: "narrative_incoherence",
      dimension: "intent",
      message: "Scene contains shots without production purpose",
      confidence: 0.9,
      evidence: {
        failureCode: "narrative_incoherence",
        expected: "productionReason on every shot",
        observed: incoherent.map((s) => s.id).join(","),
        confidence: 0.9,
      },
      retryable: false,
    });
  }

  const scores = aggregateScores(dimensions);
  // Blend with child average
  scores.overall = Math.round((scores.overall + childOverall) / 2);
  const warnings = collectWarnings(dimensions);
  const thresholds = thresholdsForQualityTarget(spec.quality.target);
  const status = deriveOverallStatus({ scores, dimensions, failures, thresholds });
  const recommendedAction = defaultActionForStatus(status, failures);

  return {
    id: newQcId(),
    productionId: spec.project.id,
    sceneId: scene.id,
    level: "scene",
    status,
    score: scores.overall,
    scores,
    dimensions,
    failures,
    warnings,
    recommendedAction:
      recommendedAction === "regenerate_shot" && failedShots.length > 1
        ? "regenerate_dependent_shots"
        : recommendedAction,
    providerChange: shotResults.some((r) => r.providerChange),
    evaluatedAt: new Date().toISOString(),
    userMessage:
      status === "pass" ? userFacingFailureSummary([]) : userFacingQcAction(recommendedAction),
    metadata: {
      shotQcIds: shotResults.map((r) => r.id),
      missingShotIds: missing,
    },
  };
}
