/**
 * Production execution DAG — parallelize independent tasks; respect dependencies.
 * Uses specification GenerationTask contract.
 */

import type { GenerationTask } from "../specification/generationTask";
import { planGenerationTasks } from "../generation/generationPlanner";
import type { ProductionSpec } from "../specification/productionSpec";

export type DagNodeStatus = "pending" | "ready" | "running" | "done" | "failed" | "skipped";

export interface DagNode {
  id: string;
  kind: string;
  dependsOn: string[];
  status: DagNodeStatus;
  shotId?: string;
  sceneId?: string;
  provider?: string;
  error?: string;
}

export interface ProductionDag {
  productionId: string;
  nodes: DagNode[];
}

export function buildProductionDag(
  spec: ProductionSpec,
  tasks?: GenerationTask[]
): ProductionDag {
  const planned = tasks || planGenerationTasks(spec);
  return {
    productionId: spec.project.id,
    nodes: planned.map((t) => ({
      id: t.id,
      kind: t.kind,
      dependsOn: t.dependsOn,
      status: t.dependsOn.length ? "pending" : "ready",
      shotId: t.shotId,
      sceneId: t.sceneId,
      provider: t.selectedProvider,
    })),
  };
}

export function readyNodes(dag: ProductionDag): DagNode[] {
  const done = new Set(
    dag.nodes.filter((n) => n.status === "done" || n.status === "skipped").map((n) => n.id)
  );
  return dag.nodes.filter(
    (n) =>
      (n.status === "ready" || n.status === "pending") &&
      n.dependsOn.every((d) => done.has(d))
  );
}

export function markNode(
  dag: ProductionDag,
  nodeId: string,
  status: DagNodeStatus,
  error?: string
): ProductionDag {
  return {
    ...dag,
    nodes: dag.nodes.map((n) => {
      if (n.id !== nodeId) return n;
      return { ...n, status, error };
    }),
  };
}

export function failedNodes(dag: ProductionDag): DagNode[] {
  return dag.nodes.filter((n) => n.status === "failed");
}

/** Collect task ids that must regenerate when a shot fails (shot + dependents + merge). */
export function dependentTaskIds(dag: ProductionDag, failedNodeId: string): string[] {
  const affected = new Set<string>([failedNodeId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of dag.nodes) {
      if (affected.has(n.id)) continue;
      if (n.dependsOn.some((d) => affected.has(d))) {
        affected.add(n.id);
        changed = true;
      }
    }
  }
  return Array.from(affected);
}
