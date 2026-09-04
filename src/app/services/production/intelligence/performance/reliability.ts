/**
 * Production reliability learning — consume Phase 4/5 telemetry, do not rebuild it.
 */

import type { ProductionReliabilitySignal, CreativeLearning } from "./types";
import { createLearning } from "./learning";

export interface ReliabilityInput {
  strategyKey: string;
  generationStrategy?: string;
  attempts: number;
  successes: number;
  retries: number;
  qcFailureCodes?: string[];
}

export function summarizeReliability(inputs: ReliabilityInput[]): ProductionReliabilitySignal[] {
  return inputs.map((i) => {
    const attempts = Math.max(1, i.attempts);
    const retryRate = i.retries / attempts;
    const firstPassSuccessRate = i.successes / attempts;
    const notes: string[] = [];
    if (retryRate >= 0.4) notes.push("High regeneration/retry rate observed");
    if (firstPassSuccessRate >= 0.8) notes.push("Strong first-pass success");
    if ((i.qcFailureCodes || []).length) {
      notes.push(`QC codes co-occur: ${(i.qcFailureCodes || []).slice(0, 5).join(", ")}`);
    }
    return {
      strategyKey: i.strategyKey,
      generationStrategy: i.generationStrategy,
      attemptCount: attempts,
      successCount: i.successes,
      retryRate,
      qcFailureCodes: i.qcFailureCodes || [],
      firstPassSuccessRate,
      notes,
    };
  });
}

export function reliabilityToLearning(
  signal: ProductionReliabilitySignal,
  scopeKey?: string
): CreativeLearning {
  const reliable = signal.firstPassSuccessRate >= 0.75 && signal.retryRate <= 0.25;
  return createLearning({
    kind: "reliability_pattern",
    scope: "brand",
    scopeKey,
    claim: reliable
      ? `Production strategy "${signal.strategyKey}" shows high first-pass success with modest retries`
      : `Production strategy "${signal.strategyKey}" shows elevated retries or QC pressure`,
    recommendation: reliable
      ? `Prefer "${signal.strategyKey}" when economics allow`
      : `Consider a simpler generation strategy when reliability matters more than peak fidelity`,
    evidenceCount: signal.attemptCount,
    consistency: reliable ? signal.firstPassSuccessRate : 1 - signal.retryRate,
    provenance: {
      evidenceType: "production_reliability",
      observationIds: [],
      snapshotIds: [],
      notes: signal.notes,
    },
  });
}

/** Link production issues to observed performance without claiming causality */
export function relateProductionIssueToPerformance(params: {
  issueCode: string;
  performanceLabel: "strong" | "mixed" | "weak" | "unknown";
  snapshotId: string;
}): CreativeLearning {
  return createLearning({
    kind: "failure_pattern",
    scope: "global",
    claim: `Production issue "${params.issueCode}" co-recorded with ${params.performanceLabel} audience performance`,
    recommendation: "Preserve the relationship for later analysis — do not treat as proven causation",
    evidenceCount: 1,
    supportingSnapshotIds: [params.snapshotId],
    consistency: 0.4,
    provenance: {
      evidenceType: "mixed",
      observationIds: [],
      snapshotIds: [params.snapshotId],
      notes: [`production_issue→observed_performance:${params.issueCode}`],
    },
  });
}
