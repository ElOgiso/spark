/**
 * DAG / continuity feedback after QC reject or approved-asset replacement.
 * Does not silently mutate ContinuityState — only plans revalidation / blocks.
 */

import type { ProductionSpec } from "../specification/productionSpec";
import {
  buildProductionDag,
  dependentTaskIds,
  type ProductionDag,
} from "../dag/productionDag";
import type { DownstreamRevalidationPlan, ProductionQCResult, RepairDecision } from "./types";

/** Plan downstream revalidation when a shot asset is replaced or fails hard QC */
export function planDownstreamRevalidation(params: {
  spec: ProductionSpec;
  replacedShotId: string;
  replacedAssetVersion?: string;
  qc?: ProductionQCResult;
  repair?: RepairDecision;
  dag?: ProductionDag;
}): DownstreamRevalidationPlan {
  const dag = params.dag || buildProductionDag(params.spec);
  const seedNode = dag.nodes.find((n) => n.shotId === params.replacedShotId);
  const blockedTaskIds = seedNode
    ? dependentTaskIds(dag, seedNode.id).filter((id) => id !== seedNode.id)
    : [];

  const revalidateShotIds = [
    ...new Set(
      dag.nodes
        .filter((n) => blockedTaskIds.includes(n.id) && n.shotId && n.shotId !== params.replacedShotId)
        .map((n) => n.shotId!)
    ),
  ];

  const regenerateShotIds: string[] = [];
  const hardHandoff = params.qc?.failures.some(
    (f) => f.code === "handoff_failure" || f.code === "end_state_mismatch" || f.code === "start_state_mismatch"
  );
  if (hardHandoff && params.repair?.scope === "shot_and_dependents") {
    regenerateShotIds.push(...revalidateShotIds.slice(0, 1));
  }

  return {
    replacedShotId: params.replacedShotId,
    replacedAssetVersion: params.replacedAssetVersion,
    revalidateShotIds,
    regenerateShotIds,
    blockedTaskIds,
    reason: hardHandoff
      ? "Upstream end-state/handoff failure — dependents blocked until revalidated"
      : "Approved asset replaced — dependents marked for revalidation (not auto-regenerated)",
  };
}

/** Continuity feedback record — findings only; does not mutate ContinuityState */
export function continuityFeedbackFromQc(qc: ProductionQCResult): {
  shotId?: string;
  findings: Array<{ code: string; message: string; confidence: number }>;
  mutatesContinuityState: false;
} {
  return {
    shotId: qc.shotId,
    findings: qc.failures
      .filter((f) => f.dimension === "continuity" || f.dimension === "handoff" || f.dimension === "identity")
      .map((f) => ({ code: f.code, message: f.message, confidence: f.confidence })),
    mutatesContinuityState: false,
  };
}
