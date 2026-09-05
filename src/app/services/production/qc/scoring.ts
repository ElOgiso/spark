/**
 * Explainable QC scoring from dimension results + threshold application.
 */

import type {
  QCDimensionResult,
  QCFailure,
  QCWarning,
  QcRecommendedAction,
  QcResultStatus,
  QcScoreBreakdown,
} from "./types";
import { statusFromScore, type QcThresholdConfig, DEFAULT_QC_THRESHOLDS } from "./thresholds";
import { failureSeverity, requirementStrength } from "./failureTaxonomy";

const DIMENSION_WEIGHTS: Record<string, number> = {
  intent: 1.2,
  identity: 1.15,
  continuity: 1.1,
  cinematography: 1.0,
  motion: 1.0,
  technical: 1.25,
  audio: 0.9,
  style: 0.85,
  structural: 1.3,
  handoff: 1.2,
  coverage: 1.05,
};

export function aggregateScores(dimensions: QCDimensionResult[]): QcScoreBreakdown {
  const dims: QcScoreBreakdown["dimensions"] = {};
  let weighted = 0;
  let weightSum = 0;
  for (const d of dimensions) {
    if (d.applicability === "not_applicable") continue;
    dims[d.id] = d.score;
    const w = DIMENSION_WEIGHTS[d.id] ?? 1;
    // Inconclusive counts at reduced weight so it doesn't fake high confidence
    const factor = d.applicability === "inconclusive" ? 0.5 : 1;
    weighted += d.score * w * factor;
    weightSum += w * factor;
  }
  return {
    overall: weightSum ? Math.round(weighted / weightSum) : 0,
    dimensions: dims,
  };
}

export function collectWarnings(dimensions: QCDimensionResult[]): QCWarning[] {
  const warnings: QCWarning[] = [];
  for (const d of dimensions) {
    if (d.applicability === "inconclusive") {
      warnings.push({
        code: "inconclusive_analysis",
        dimension: d.id,
        message: `${d.id} inconclusive — insufficient visual evidence`,
        confidence: 0.3,
      });
    } else if (d.status === "warn") {
      warnings.push({
        code: d.failureCodes[0] || "low_confidence",
        dimension: d.id,
        message: `${d.id} below accept threshold`,
        confidence: 0.6,
      });
    }
  }
  return warnings;
}

export function deriveOverallStatus(params: {
  scores: QcScoreBreakdown;
  dimensions: QCDimensionResult[];
  failures: QCFailure[];
  thresholds?: QcThresholdConfig;
}): QcResultStatus {
    const partitioned = partitionFailures(params.failures);
  if (partitioned.hardFailures.some((f) => f.severity === "critical")) {
    return "fail";
  }
  if (partitioned.hardFailurePresent) {
    return partitioned.hardFailures.some((f) => f.confidence >= 0.7) ? "fail" : "retry";
  }

const thresholds = params.thresholds || DEFAULT_QC_THRESHOLDS;
  const applicable = params.dimensions.filter((d) => d.applicability === "applicable");
  const inconclusive = params.dimensions.filter((d) => d.applicability === "inconclusive");

  // No hard failures and only inconclusive visual evidence → warn (not infinite regenerate)
  if (!params.failures.length && applicable.every((d) => d.status === "pass" || d.id === "technical") && inconclusive.length > 0) {
    const tech = applicable.find((d) => d.id === "technical");
    if (!tech || tech.status === "pass") {
      return "warn";
    }
  }

  const critical = params.failures.filter(
    (f) =>
      f.code === "technical_failure" ||
      f.code === "subject_missing" ||
      f.code === "identity_drift" ||
      f.code === "duration_mismatch" ||
      f.code === "asset_missing" ||
      f.code === "product_mismatch" ||
      f.code === "handoff_failure"
  );
  if (thresholds.criticalCodesForceRetry && critical.length) {
    return critical.some((f) => f.code === "technical_failure") && params.scores.overall < 40
      ? "fail"
      : "retry";
  }

  for (const d of applicable) {
    if (d.score < thresholds.dimensionRetryFloor) {
      return d.score < thresholds.retryMin ? "fail" : "retry";
    }
  }

  return statusFromScore(params.scores.overall, thresholds);
}

export function defaultActionForStatus(
  status: QcResultStatus,
  failures: QCFailure[]
): QcRecommendedAction {
  if (status === "pass") return "accept";
  if (status === "warn") return failures.length ? "repair" : "accept";
  if (status === "fail" && failures.some((f) => !f.retryable)) return "manual_review";
  if (failures.some((f) => f.code === "identity_drift" || f.code === "wardrobe_drift" || f.code === "wardrobe_mismatch" || f.code === "product_mismatch")) {
    return "change_reference";
  }
  if (failures.some((f) => f.code === "motion_mismatch" || f.code === "quality_degradation")) {
    return "reroute_provider";
  }
  if (failures.some((f) => /continuity|location|prop|spatial|screen|lighting|time|handoff|eyeline|axis|blocking/.test(f.code))) {
    return "strengthen_continuity";
  }
  if (failures.some((f) => f.code === "camera_intent_mismatch" || f.code === "cinematic_purpose_mismatch" || f.code === "coverage_role_mismatch")) {
    return "repair_prompt";
  }
  if (status === "fail") return "regenerate_shot";
  return "repair_prompt";
}


export function annotateFailure(failure: QCFailure): QCFailure {
  return {
    ...failure,
    severity: failure.severity ?? failureSeverity(failure.code),
    requirementStrength: failure.requirementStrength ?? requirementStrength(failure.code),
  };
}

export function partitionFailures(failures: QCFailure[]): {
  hardFailures: QCFailure[];
  softFailures: QCFailure[];
  hardFailurePresent: boolean;
} {
  const annotated = failures.map(annotateFailure);
  const hardFailures = annotated.filter(
    (f) => (f.requirementStrength ?? "hard") === "hard" && (f.severity === "fail" || f.severity === "critical")
  );
  const softFailures = annotated.filter(
    (f) => (f.requirementStrength ?? "hard") === "soft" || f.severity === "warning" || f.severity === "unknown"
  );
  return { hardFailures, softFailures, hardFailurePresent: hardFailures.length > 0 };
}

export function gateDecisionFromQc(params: {
  status: QcResultStatus;
  failures: QCFailure[];
  hardFailurePresent: boolean;
}): "approve" | "approve_with_warnings" | "reject" | "needs_review" | "not_evaluated" {
  const annotated = params.failures.map(annotateFailure);
  if (annotated.some((f) => f.code === "not_evaluated") && !params.hardFailurePresent && params.status !== "fail") {
    return "not_evaluated";
  }
  if (annotated.some((f) => f.severity === "unknown") && !params.hardFailurePresent) {
    return "needs_review";
  }
  if (params.hardFailurePresent || params.status === "fail" || params.status === "retry") {
    return "reject";
  }
  if (params.status === "warn" || annotated.some((f) => f.severity === "warning")) {
    return "approve_with_warnings";
  }
  if (params.status === "pass") return "approve";
  return "needs_review";
}
