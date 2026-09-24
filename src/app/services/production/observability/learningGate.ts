/**
 * SPARK Phase 17 — Production Learning Gate & Memory Bridge.
 * Principle: Store evidence first, learn second.
 * Never guess outcomes, never learn from missing metrics, protect sample size.
 */

import type { CreativeLearning } from "../intelligence/performance/types";
import type { MemoryItem } from "../../../domain/types";
import { memoryItemsFromLearnings } from "../intelligence/performance/memoryBridge";
import type {
  ProductionTrace,
  ProductionTraceExecution,
  ProductionTraceRepair,
} from "./productionTrace";

export interface LearningGateOptions {
  minSamplesForPreference?: number;
  minEvidenceForValidated?: number;
}

const DEFAULT_MIN_SAMPLES = 2;

/**
 * Derives provider reliability learnings strictly from measured execution attempts.
 * Protects against single-sample overconfidence.
 */
export function deriveProviderReliabilityFromTrace(
  trace: ProductionTrace,
  options?: LearningGateOptions
): CreativeLearning[] {
  const minSamples = options?.minSamplesForPreference ?? DEFAULT_MIN_SAMPLES;
  const learnings: CreativeLearning[] = [];
  const executionsByProvider = new Map<string, ProductionTraceExecution[]>();

  for (const exec of trace.executions) {
    if (exec.isUnknownSubmission) {
      // UNKNOWN_SUBMISSION must not be silently treated as a standard failure
      continue;
    }
    const key = `${exec.providerId}${exec.modelId ? `:${exec.modelId}` : ""}`;
    const list = executionsByProvider.get(key) || [];
    list.push(exec);
    executionsByProvider.set(key, list);
  }

  for (const [providerKey, execs] of executionsByProvider.entries()) {
    if (execs.length < minSamples) {
      // Sample-size protection: do NOT create global preferences from a single run
      continue;
    }

    const successes = execs.filter((e) => e.status === "succeeded").length;
    const failures = execs.filter((e) => e.status === "failed").length;
    const successRate = successes / execs.length;
    const now = new Date().toISOString();

    const scope = trace.brandId ? "brand" : "global";
    const scopeKey = trace.brandId || undefined;

    learnings.push({
      id: `learn-provider-${providerKey}-${Date.now()}`,
      kind: "reliability_pattern",
      scope: scope as any,
      scopeKey,
      claim: `Provider ${providerKey} has ${Math.round(successRate * 100)}% success rate across ${execs.length} attempts`,
      recommendation:
        successRate >= 0.8
          ? `Prefer ${providerKey} for similar tasks`
          : `Monitor or deprioritize ${providerKey} due to ${failures} failure(s)`,
      confidence: {
        score: Math.min(0.95, 0.5 + 0.1 * execs.length),
        evidenceCount: execs.length,
        recency: 1.0,
        consistency: successRate >= 0.8 || successRate <= 0.2 ? 0.9 : 0.5,
        scope: scope as any,
      },
      evidenceCount: execs.length,
      supportingObservationIds: execs.map((e) => e.executionId),
      supportingSnapshotIds: [],
      productionIds: [trace.productionId],
      provenance: {
        evidenceType: "production_reliability",
        observationIds: execs.map((e) => e.executionId),
        snapshotIds: [],
        notes: [`measured attempts=${execs.length}`, `successes=${successes}`],
      },
      createdAt: now,
      updatedAt: now,
    });
  }

  return learnings;
}

/**
 * Derives repair effectiveness learnings strictly from complete repair lineages:
 * Failure → Repair Action → Replacement Asset → Second QC Result.
 */
export function deriveRepairEffectivenessFromTrace(
  trace: ProductionTrace
): CreativeLearning[] {
  const learnings: CreativeLearning[] = [];
  const now = new Date().toISOString();

  for (const repair of trace.repairs) {
    if (!repair.failureCode || !repair.repairAction) {
      continue;
    }

    const scope = trace.brandId ? "brand" : "global";
    const scopeKey = trace.brandId || undefined;

    if (repair.succeeded) {
      learnings.push({
        id: `learn-repair-success-${repair.failureCode}-${Date.now()}`,
        kind: "reliability_pattern",
        scope: scope as any,
        scopeKey,
        claim: `Repair action "${repair.repairAction}" successfully resolved failure "${repair.failureCode}"`,
        recommendation: `Use "${repair.repairAction}" when encountering "${repair.failureCode}"`,
        confidence: {
          score: 0.85,
          evidenceCount: 1,
          recency: 1.0,
          consistency: 0.9,
          scope: scope as any,
        },
        evidenceCount: 1,
        supportingObservationIds: [repair.originalAssetId, repair.replacementAssetId || ""].filter(Boolean),
        supportingSnapshotIds: [],
        productionIds: [trace.productionId],
        provenance: {
          evidenceType: "production_reliability",
          observationIds: [repair.originalAssetId],
          snapshotIds: [],
          notes: [
            `originalAsset=${repair.originalAssetId}`,
            `replacementAsset=${repair.replacementAssetId}`,
            `secondQcVerdict=${repair.secondQcVerdict}`,
          ],
        },
        createdAt: now,
        updatedAt: now,
      });
    } else {
      // Failed repair remains recorded — DO NOT HIDE IT
      learnings.push({
        id: `learn-repair-fail-${repair.failureCode}-${Date.now()}`,
        kind: "failure_pattern",
        scope: scope as any,
        scopeKey,
        claim: `Repair action "${repair.repairAction}" failed to resolve failure "${repair.failureCode}"`,
        recommendation: `Investigate alternative repair strategies or rerouting for "${repair.failureCode}"`,
        confidence: {
          score: 0.8,
          evidenceCount: 1,
          recency: 1.0,
          consistency: 0.8,
          scope: scope as any,
        },
        evidenceCount: 1,
        supportingObservationIds: [repair.originalAssetId],
        supportingSnapshotIds: [],
        productionIds: [trace.productionId],
        provenance: {
          evidenceType: "production_reliability",
          observationIds: [repair.originalAssetId],
          snapshotIds: [],
          notes: [`repair failed to pass second QC`],
        },
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  return learnings;
}

/**
 * Learning Gate: Filters and guards audience performance learnings.
 * If analytics evidence is missing, returns empty list — never hallucinates learnings.
 */
export function gateAudiencePerformanceLearnings(
  trace: ProductionTrace,
  candidateLearnings: CreativeLearning[]
): CreativeLearning[] {
  if (trace.performance.performanceStatus !== "measured" || trace.performance.snapshots.length === 0) {
    // GATE CLOSED: Missing analytics metrics must NOT produce audience performance learnings
    return [];
  }

  return candidateLearnings.filter((l) => {
    // Learning must have supporting snapshots
    return l.supportingSnapshotIds.length > 0 || l.provenance.snapshotIds.length > 0;
  });
}

/**
 * Deduplicates and converts qualified CreativeLearning items into MemoryItems.
 * Raw telemetry events NEVER reach MemoryItem directly.
 */
export function bridgeQualifiedLearningsToMemory(
  learnings: CreativeLearning[],
  existingMemoryItems: MemoryItem[] = []
): {
  newMemoryItems: MemoryItem[];
  allMemoryItems: MemoryItem[];
} {
  const converted = memoryItemsFromLearnings(learnings);
  const existingFingerprints = new Set(
    existingMemoryItems.map((m) => m.fingerprint || m.text)
  );

  const newMemoryItems: MemoryItem[] = [];
  for (const item of converted) {
    const key = item.fingerprint || item.text;
    if (!existingFingerprints.has(key)) {
      existingFingerprints.add(key);
      newMemoryItems.push(item);
    }
  }

  return {
    newMemoryItems,
    allMemoryItems: [...newMemoryItems, ...existingMemoryItems],
  };
}
