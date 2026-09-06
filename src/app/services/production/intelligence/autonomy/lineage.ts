/**
 * Decision lineage + learning snapshots (append-only).
 */

import type { CreativeLearning } from "../performance";
import type { DecisionRecord, LearningSnapshot } from "./types";

function makeId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

export function captureLearningSnapshot(
  learnings: CreativeLearning[],
  opts?: { version?: number; notes?: string[]; now?: Date }
): LearningSnapshot {
  const now = (opts?.now || new Date()).toISOString();
  return {
    id: makeId("lsnap"),
    version: opts?.version ?? 1,
    createdAt: now,
    learningIds: learnings.map((l) => l.id),
    learnings: learnings.map((l) => ({ ...l })),
    notes: opts?.notes,
  };
}

export function recordDecision(
  partial: Omit<DecisionRecord, "id" | "at"> & { at?: string }
): DecisionRecord {
  return {
    id: makeId("dec"),
    at: partial.at || new Date().toISOString(),
    kind: partial.kind,
    decision: partial.decision,
    reason: partial.reason,
    inputs: partial.inputs,
    evidenceIds: partial.evidenceIds,
    confidence: partial.confidence,
    policy: partial.policy,
    alternatives: partial.alternatives,
    selectedAction: partial.selectedAction,
    learningSnapshotId: partial.learningSnapshotId,
    productionId: partial.productionId,
  };
}

export function adviceFingerprint(advice: {
  recommendations: string[];
  explorationSuggestions: string[];
  overriddenByExplicitUserIntent: boolean;
}): string {
  return JSON.stringify({
    r: [...advice.recommendations].sort(),
    e: [...advice.explorationSuggestions].sort(),
    o: advice.overriddenByExplicitUserIntent,
  });
}
