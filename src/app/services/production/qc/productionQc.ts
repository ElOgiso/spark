/**
 * Production-level QC — hierarchy root; reuses scene/shot results.
 */

import type { ProductionSpec } from "../specification/productionSpec";
import type { ProductionQCResult, ProductionQcVerdict, QCFailure } from "./types";
import { aggregateScores, collectWarnings, deriveOverallStatus, defaultActionForStatus } from "./scoring";
import { thresholdsForQualityTarget } from "./thresholds";
import { userFacingQcAction } from "./userMessages";

function newQcId(): string {
  return `qc_prod_${Math.random().toString(36).slice(2, 10)}`;
}

export function evaluateProductionQc(params: {
  spec: ProductionSpec;
  sceneResults: ProductionQCResult[];
  shotResults: ProductionQCResult[];
}): { result: ProductionQCResult; verdict: ProductionQcVerdict } {
  const { spec, sceneResults, shotResults } = params;
  const plannedScenes = spec.scenes.length;
  const plannedShots = spec.scenes.reduce((n, s) => n + s.shots.length, 0);

  const failures: QCFailure[] = [];
  for (const s of sceneResults) failures.push(...s.failures);
  // Prefer scene-level; avoid duplicating every shot failure in production payload
  if (!sceneResults.length) {
    for (const s of shotResults) failures.push(...s.failures);
  }

  const criticalUnresolved = [...sceneResults, ...shotResults].filter(
    (r) => r.status === "fail" || r.status === "retry"
  );

  const childScore =
    sceneResults.length > 0
      ? Math.round(sceneResults.reduce((a, r) => a + r.score, 0) / sceneResults.length)
      : shotResults.length
        ? Math.round(shotResults.reduce((a, r) => a + r.score, 0) / shotResults.length)
        : 0;

  if (shotResults.length < plannedShots) {
    failures.push({
      code: "coverage_gap",
      dimension: "intent",
      message: `Production missing shot QC coverage (${shotResults.length}/${plannedShots})`,
      confidence: 1,
      evidence: {
        failureCode: "coverage_gap",
        expected: String(plannedShots),
        observed: String(shotResults.length),
        confidence: 1,
      },
      retryable: true,
    });
  }

  const dimensions = [
    {
      id: "intent" as const,
      applicability: "applicable" as const,
      score: childScore,
      status: (criticalUnresolved.length ? "retry" : "pass") as ProductionQCResult["status"],
      evidence: [
        {
          expected: `${plannedScenes} scenes / ${plannedShots} shots`,
          observed: `${sceneResults.length} scene QC / ${shotResults.length} shot QC`,
          confidence: 0.95,
        },
      ],
      failureCodes: failures.filter((f) => f.code === "coverage_gap").map((f) => f.code),
    },
    {
      id: "continuity" as const,
      applicability: "applicable" as const,
      score: Math.round(
        shotResults
          .map((r) => r.scores.dimensions.continuity ?? r.score)
          .reduce((a, b, _, arr) => a + b / (arr.length || 1), 0) || childScore
      ),
      status: "pass" as const,
      evidence: [
        {
          expected: "production continuity integrity",
          observed: criticalUnresolved.some((r) =>
            r.failures.some((f) => f.dimension === "continuity")
          )
            ? "continuity issues remain"
            : "ok",
          confidence: 0.85,
        },
      ],
      failureCodes: [] as ProductionQCResult["failures"][number]["code"][],
    },
    {
      id: "audio" as const,
      applicability:
        spec.audio.hasNarration || spec.audio.hasDialogue
          ? ("applicable" as const)
          : ("not_applicable" as const),
      score: 90,
      status: "pass" as const,
      evidence: [
        {
          expected: spec.audio.hasNarration ? "narration" : "silent ok",
          observed: "aggregated",
          confidence: 0.7,
        },
      ],
      failureCodes: [],
    },
    {
      id: "style" as const,
      applicability: "applicable" as const,
      score: Math.round(
        shotResults
          .map((r) => r.scores.dimensions.style ?? r.score)
          .reduce((a, b, _, arr) => a + b / (arr.length || 1), 0) || childScore
      ),
      status: "pass" as const,
      evidence: [
        {
          expected: spec.visualStyle.look,
          observed: "aggregated style coherence",
          confidence: 0.7,
        },
      ],
      failureCodes: [],
    },
    {
      id: "technical" as const,
      applicability: "applicable" as const,
      score: shotResults.every((r) => (r.scores.dimensions.technical ?? 100) >= 80) ? 95 : 50,
      status: shotResults.some((r) => (r.scores.dimensions.technical ?? 100) < 80)
        ? ("retry" as const)
        : ("pass" as const),
      evidence: [
        {
          expected: "all assets technically valid",
          observed: "from shot QC technical dimensions",
          confidence: 0.9,
        },
      ],
      failureCodes: [],
    },
  ];

  const scores = aggregateScores(dimensions);
  scores.overall = Math.round((scores.overall + childScore) / 2);
  const warnings = collectWarnings(dimensions);
  const thresholds = thresholdsForQualityTarget(spec.quality.target);
  let status = deriveOverallStatus({ scores, dimensions, failures, thresholds });

  if (criticalUnresolved.some((r) => r.status === "fail") && !canWaive(criticalUnresolved)) {
    status = status === "pass" ? "retry" : status;
  }

  const recommendedAction = defaultActionForStatus(status, failures);
  const result: ProductionQCResult = {
    id: newQcId(),
    productionId: spec.project.id,
    level: "production",
    status,
    score: scores.overall,
    scores,
    dimensions,
    failures,
    warnings,
    recommendedAction,
    providerChange: false,
    evaluatedAt: new Date().toISOString(),
    userMessage: userFacingQcAction(recommendedAction === "accept" ? "accept" : recommendedAction),
    metadata: {
      sceneQcIds: sceneResults.map((r) => r.id),
      shotQcCount: shotResults.length,
    },
  };

  const verdict: ProductionQcVerdict =
    status === "pass" || (status === "warn" && !criticalUnresolved.some((r) => r.status === "fail"))
      ? "production_ready"
      : status === "fail" && !criticalUnresolved.some((r) => r.failures.some((f) => f.retryable))
        ? "production_failed"
        : criticalUnresolved.length || status === "retry" || status === "fail"
          ? "production_needs_review"
          : "production_ready";

  // Refine verdict
  let finalVerdict = verdict;
  if (status === "pass") finalVerdict = "production_ready";
  else if (status === "warn" && failures.filter((f) => f.retryable && f.code !== "insufficient_visual_evidence").length === 0) {
    finalVerdict = "production_ready";
  } else if (status === "fail" && failures.every((f) => !f.retryable)) finalVerdict = "production_failed";
  else if (status === "warn" || status === "retry" || status === "fail") {
    finalVerdict = "production_needs_review";
  }

  return { result, verdict: finalVerdict };
}

function canWaive(results: ProductionQCResult[]): boolean {
  return results.every((r) => r.status === "warn");
}
