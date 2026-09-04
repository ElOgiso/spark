/**
 * PerformanceAnalyzer — snapshot + Creative DNA → structured analysis.
 * Correlation language only; never presents correlation as causation.
 */

import { availableValue, getMetric } from "./metrics";
import { makeDiagnosis } from "./diagnoses";
import { analyzeRetention, type RetentionCurvePoint } from "./retention";
import type {
  CreativeDNA,
  EvidenceStrength,
  PerformanceAnalysis,
  PerformanceDiagnosis,
  PerformanceSnapshot,
  AudiencePerformanceSummary,
  ProductionQualitySummary,
} from "./types";

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export interface AnalyzePerformanceInput {
  snapshot: PerformanceSnapshot;
  dna?: CreativeDNA;
  retentionCurve?: RetentionCurvePoint[];
  baseline?: {
    engagementRate?: number;
    completionRate?: number;
    views?: number;
  };
  productionQuality?: ProductionQualitySummary;
}

function scoreAudience(snapshot: PerformanceSnapshot, baseline?: AnalyzePerformanceInput["baseline"]): AudiencePerformanceSummary {
  const eng = availableValue(snapshot.metrics, "engagement_rate");
  const completion = availableValue(snapshot.metrics, "completion_rate");
  const views = availableValue(snapshot.metrics, "views");
  const shares = availableValue(snapshot.metrics, "shares");
  const primary: string[] = [];
  const notes: string[] = [];

  let points = 0;
  let signals = 0;

  if (eng != null) {
    primary.push("engagement_rate");
    signals++;
    const base = baseline?.engagementRate ?? 3;
    if (eng >= base * 1.25) points += 2;
    else if (eng >= base * 0.75) points += 1;
    else points += 0;
    notes.push(`Engagement rate observed at ${eng}% (baseline reference ${base}%)`);
  }
  if (completion != null) {
    primary.push("completion_rate");
    signals++;
    const base = baseline?.completionRate ?? 0.35;
    const c = completion > 1 ? completion / 100 : completion;
    if (c >= base * 1.2) points += 2;
    else if (c >= base * 0.8) points += 1;
    notes.push(`Completion observed at ${(c * 100).toFixed(1)}%`);
  }
  if (shares != null && views != null && views > 0) {
    primary.push("shares");
    signals++;
    const shareRate = shares / views;
    if (shareRate >= 0.02) points += 2;
    else if (shareRate >= 0.005) points += 1;
  }
  if (views != null) {
    primary.push("views");
    notes.push(`Views are platform-native and not cross-compared (${views})`);
  }

  if (signals === 0) {
    return { label: "unknown", primaryMetrics: primary, notes: ["Insufficient audience metrics"] };
  }

  const avg = points / Math.max(1, signals);
  const label: AudiencePerformanceSummary["label"] =
    avg >= 1.5 ? "strong" : avg >= 0.75 ? "mixed" : "weak";
  const score = Math.min(1, avg / 2);

  return { score, label, primaryMetrics: primary, notes };
}

export function analyzePerformance(input: AnalyzePerformanceInput): PerformanceAnalysis {
  const { snapshot, dna, baseline, productionQuality } = input;
  const audiencePerformance = scoreAudience(snapshot, baseline);

  const performedWell: string[] = [];
  const underperformed: string[] = [];
  const strongSignals: string[] = [];
  const weakSignals: string[] = [];
  const uncertain: string[] = [];
  const diagnoses: PerformanceDiagnosis[] = [];
  const likelyContributors: PerformanceAnalysis["likelyContributors"] = [];
  const nextTests: string[] = [];

  const eng = availableValue(snapshot.metrics, "engagement_rate");
  const completion = availableValue(snapshot.metrics, "completion_rate");
  const shares = availableValue(snapshot.metrics, "shares");
  const likes = availableValue(snapshot.metrics, "likes");
  const views = availableValue(snapshot.metrics, "views");

  const availableCount = snapshot.metrics.filter((m) => m.availability === "available" || m.availability === "estimated").length;

  let evidenceStrength: EvidenceStrength =
    availableCount >= 4 ? "observed" : availableCount >= 2 ? "correlated" : "insufficient_data";

  if (availableCount < 2) {
    diagnoses.push(
      makeDiagnosis("insufficient_evidence", "Too few available metrics for a confident diagnosis", {
        strength: "insufficient_data",
      })
    );
    uncertain.push("Most canonical metrics are unavailable for this platform/source");
  }

  if (audiencePerformance.label === "strong") {
    performedWell.push("Audience response looks strong on available rates");
    strongSignals.push(...audiencePerformance.primaryMetrics);
    if (eng != null && eng >= (baseline?.engagementRate ?? 3) * 1.25) {
      diagnoses.push(
        makeDiagnosis("strong_engagement", "Engagement rate is above the reference baseline", {
          strength: "observed",
          metricKeys: ["engagement_rate"],
        })
      );
    }
    if (shares != null && views != null && views > 0 && shares / views >= 0.02) {
      diagnoses.push(
        makeDiagnosis("strong_shareability", "Share rate is relatively high vs views", {
          strength: "correlated",
          metricKeys: ["shares", "views"],
        })
      );
      performedWell.push("Shareability signal is elevated");
    }
  } else if (audiencePerformance.label === "weak") {
    underperformed.push("Audience response looks weak on available rates");
    weakSignals.push(...audiencePerformance.primaryMetrics);
    diagnoses.push(
      makeDiagnosis("weak_engagement", "Engagement/completion signals sit below reference baselines", {
        strength: "observed",
        metricKeys: audiencePerformance.primaryMetrics,
      })
    );
  } else if (audiencePerformance.label === "mixed") {
    diagnoses.push(
      makeDiagnosis("mixed_signals", "Some metrics look healthy while others lag", {
        strength: "uncertain",
        metricKeys: audiencePerformance.primaryMetrics,
      })
    );
    uncertain.push("Mixed audience signals — avoid single-metric conclusions");
  }

  // Hook / retention hypotheses from DNA + metrics (never causal claims)
  if (dna?.hookType) {
    if (completion != null) {
      const c = completion > 1 ? completion / 100 : completion;
      if (c >= 0.5) {
        diagnoses.push(
          makeDiagnosis("strong_hook", `Hook type "${dna.hookType}" co-occurs with solid completion`, {
            strength: "correlated",
            metricKeys: ["completion_rate"],
            relatedDnaKeys: ["hookType"],
          })
        );
        likelyContributors.push({
          factor: `hook:${dna.hookType}`,
          strength: "correlated",
          note: "Correlated with completion; not proven causal",
        });
      } else if (c < 0.25) {
        diagnoses.push(
          makeDiagnosis("weak_hook", `Hook type "${dna.hookType}" co-occurs with weak completion`, {
            strength: "correlated",
            metricKeys: ["completion_rate"],
            relatedDnaKeys: ["hookType"],
          })
        );
        likelyContributors.push({
          factor: `hook:${dna.hookType}`,
          strength: "likely",
          note: "Possible opening weakness — treat as hypothesis",
        });
        nextTests.push("Test an alternate hook type with the same format and duration");
      }
    } else {
      uncertain.push("No completion_rate available to evaluate hook strength");
    }
  }

  if (dna?.format && audiencePerformance.label === "weak") {
    diagnoses.push(
      makeDiagnosis("format_mismatch", `Format "${dna.format}" may be a poor fit — insufficient alone to prove`, {
        strength: "uncertain",
        relatedDnaKeys: ["format"],
      })
    );
    nextTests.push(`Compare "${dna.format}" against one alternative format for this account`);
  }

  if (dna?.durationSec != null && completion != null) {
    const c = completion > 1 ? completion / 100 : completion;
    if (dna.durationSec > 90 && c < 0.3) {
      diagnoses.push(
        makeDiagnosis("duration_mismatch", "Longer duration co-occurs with low completion", {
          strength: "correlated",
          metricKeys: ["completion_rate"],
          relatedDnaKeys: ["durationSec"],
        })
      );
      nextTests.push("Test a shorter cut of the same narrative without changing the hook");
    } else if (dna.durationSec <= 45 && c >= 0.55) {
      // Not "shorter always better" — just an observation for this piece
      performedWell.push("Short duration co-occurs with strong completion on this item");
    }
  }

  const retention = analyzeRetention({
    durationSec: dna?.durationSec ?? snapshot.context?.durationSec,
    curve: input.retentionCurve,
    completionRate: completion,
  });

  if (retention.strength !== "insufficient_data") {
    if ((retention.openingDropOff || 0) >= 0.25) {
      diagnoses.push(
        makeDiagnosis("weak_retention", retention.explanation, {
          strength: retention.strength,
          metricKeys: ["retention"],
          relatedDnaKeys: ["hookType", "openingStyle"],
        })
      );
    } else if ((retention.completionRate || 0) >= 0.55) {
      diagnoses.push(
        makeDiagnosis("strong_retention", "Retention holds through completion", {
          strength: "observed",
          metricKeys: ["retention", "completion_rate"],
        })
      );
    }
  }

  // Quality vs performance distinction
  if (productionQuality?.label === "high" && audiencePerformance.label === "weak") {
    uncertain.push("High production quality with weak audience response — keep concepts separate");
  }
  if (productionQuality?.label === "low" && audiencePerformance.label === "strong") {
    uncertain.push("Strong audience response despite lower production QC — do not equate quality with performance");
  }

  if (productionQuality?.issueCodes?.length) {
    for (const code of productionQuality.issueCodes) {
      likelyContributors.push({
        factor: `production_issue:${code}`,
        strength: "uncertain",
        note: "Production issue co-recorded with this performance observation — not causal proof",
      });
    }
  }

  if (!nextTests.length && evidenceStrength !== "insufficient_data") {
    nextTests.push("Run a single-variable experiment on the weakest correlated factor");
  }

  const whatHappened =
    audiencePerformance.label === "unknown"
      ? "Limited metrics available; SPARK recorded what the platform exposed without inventing gaps."
      : `Audience performance looks ${audiencePerformance.label} for window=${snapshot.window} on ${snapshot.platform}.`;

  const explanations = [
    whatHappened,
    ...audiencePerformance.notes.slice(0, 2),
    ...diagnoses.slice(0, 2).map((d) => d.summary),
  ].filter(Boolean);

  const confidence =
    evidenceStrength === "insufficient_data"
      ? 0.2
      : Math.min(
          snapshot.confidence,
          snapshot.completeness,
          audiencePerformance.score != null ? 0.4 + audiencePerformance.score * 0.5 : 0.5
        );

  // unused vars silence — likes may inform future
  void likes;
  void getMetric;

  return {
    id: newId("panalysis"),
    snapshotId: snapshot.id,
    productionId: snapshot.productionId || snapshot.context?.productionId,
    whatHappened,
    performedWell,
    underperformed,
    strongSignals,
    weakSignals,
    uncertain,
    likelyContributors,
    nextTests,
    diagnoses,
    retention: retention.strength === "insufficient_data" ? undefined : retention,
    audiencePerformance,
    productionQuality,
    confidence,
    explanations,
    evidenceStrength,
  };
}
