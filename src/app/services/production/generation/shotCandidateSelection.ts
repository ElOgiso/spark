/**
 * Phase 6 — cherry-pick / local regeneration helpers.
 * Composes existing candidate ranking + partial regeneration; does not add a second QC or DAG.
 */

import type { ProductionSpec } from "../specification/productionSpec";
import {
  selectBestCandidate,
  type CandidateObservation,
} from "../preproduction/candidateStrategy";
import type { CandidateScore } from "../preproduction/types";
import type { GenerationIntent, GenerationIntentTrace } from "./generationIntent";
import {
  planPartialRegeneration,
  type PartialRegenerationPlan,
} from "./retryPlanner";

export interface SelectedCandidateRecord {
  intent: GenerationIntent;
  trace: GenerationIntentTrace;
  selected: CandidateScore;
}

/** Persist cherry-picked candidate (+ optional resulting asset) onto GenerationIntent.trace. */
export function recordSelectedCandidate(params: {
  intent: GenerationIntent;
  candidateId: string;
  assetId?: string;
  qcResultId?: string;
}): GenerationIntent {
  return {
    ...params.intent,
    trace: {
      ...params.intent.trace,
      candidateId: params.candidateId,
      assetId: params.assetId ?? params.intent.trace.assetId,
      qcResultId: params.qcResultId ?? params.intent.trace.qcResultId,
    },
  };
}

/**
 * Rank observations with existing QC-like scoring and record the winner on the intent trace.
 * Neighboring approved shots are untouched — selection is per-shot.
 */
export function selectAndRecordCandidate(params: {
  intent: GenerationIntent;
  observations: CandidateObservation[];
  assetId?: string;
}): SelectedCandidateRecord | null {
  const selected = selectBestCandidate(params.observations);
  if (!selected) return null;
  if (selected.shotId !== params.intent.shotId) {
    throw new Error(
      `Candidate shotId ${selected.shotId} does not match intent shot ${params.intent.shotId}`
    );
  }
  const intent = recordSelectedCandidate({
    intent: params.intent,
    candidateId: selected.candidateId,
    assetId: params.assetId,
  });
  return { intent, trace: intent.trace, selected };
}

/**
 * Regenerate only the failed shot (plus continuity-chain dependents when last-frame chain is on).
 * Approved neighbors appear in preserveShotIds — never forces full production regeneration.
 */
export function planShotLocalRegeneration(params: {
  spec: ProductionSpec;
  shotId: string;
  failure?: string;
}): PartialRegenerationPlan {
  return planPartialRegeneration({
    spec: params.spec,
    scope: "shot",
    targetId: params.shotId,
    failure: params.failure,
  });
}
