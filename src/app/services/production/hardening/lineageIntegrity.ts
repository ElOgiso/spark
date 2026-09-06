/**
 * Lineage integrity — trace production ancestry without inventing a second asset registry.
 */

import type { ProductionSpec } from "../specification";
import type { LineageIntegrityReport, LineageNode } from "./types";

export interface LineageGraphInput {
  spec: ProductionSpec;
  panelByShotId?: Record<string, string>;
  tasksByShotId?: Record<string, string[]>;
  candidatesByTaskId?: Record<string, string[]>;
  approvedAssetIds?: string[];
  masterId?: string;
  deliveryIds?: string[];
  performanceIds?: string[];
  learningIds?: string[];
}

export function buildProductionLineageGraph(input: LineageGraphInput): LineageNode[] {
  const nodes: LineageNode[] = [];
  const productionId = input.spec.id || input.spec.project?.id || "unknown_production";
  nodes.push({ kind: "production", id: productionId, parentIds: [] });

  for (const scene of input.spec.scenes || []) {
    nodes.push({ kind: "scene", id: scene.id, parentIds: [productionId] });
    for (const shot of scene.shots || []) {
      nodes.push({ kind: "shot", id: shot.id, parentIds: [scene.id] });

      const panelId =
        input.panelByShotId?.[shot.id] ||
        (shot as { storyboardPanelId?: string }).storyboardPanelId;
      if (panelId) {
        nodes.push({ kind: "storyboard_panel", id: String(panelId), parentIds: [shot.id] });
      }

      const taskIds =
        input.tasksByShotId?.[shot.id] ||
        ((shot as { generationTasks?: Array<{ id: string }> }).generationTasks || [])
          .map((t) => t.id)
          .filter(Boolean);
      for (const taskId of taskIds) {
        nodes.push({ kind: "generation_task", id: taskId, parentIds: [shot.id] });
        for (const candidateId of input.candidatesByTaskId?.[taskId] || []) {
          nodes.push({ kind: "candidate_asset", id: candidateId, parentIds: [taskId] });
        }
      }
    }
  }

  for (const assetId of input.approvedAssetIds || []) {
    if (!nodes.some((n) => n.id === assetId)) {
      nodes.push({ kind: "candidate_asset", id: assetId, parentIds: [productionId] });
    }
  }

  if (input.masterId) {
    nodes.push({
      kind: "master",
      id: input.masterId,
      parentIds: input.approvedAssetIds?.length ? input.approvedAssetIds : [productionId],
    });
  }
  for (const d of input.deliveryIds || []) {
    nodes.push({ kind: "delivery", id: d, parentIds: [input.masterId || productionId] });
  }
  for (const p of input.performanceIds || []) {
    nodes.push({ kind: "performance", id: p, parentIds: [productionId] });
  }
  for (const l of input.learningIds || []) {
    nodes.push({ kind: "learning", id: l, parentIds: [productionId] });
  }

  return nodes;
}

export function validateLineageIntegrity(nodes: LineageNode[]): LineageIntegrityReport {
  const byId = new Map<string, LineageNode>();
  const duplicateIds: string[] = [];
  for (const n of nodes) {
    if (byId.has(n.id)) duplicateIds.push(n.id);
    else byId.set(n.id, n);
  }

  const brokenEdges: LineageIntegrityReport["brokenEdges"] = [];
  for (const n of nodes) {
    for (const parentId of n.parentIds) {
      if (!byId.has(parentId)) {
        brokenEdges.push({ from: n.id, to: parentId, reason: "missing_parent" });
      }
    }
  }

  const referenced = new Set<string>();
  for (const n of nodes) for (const p of n.parentIds) referenced.add(p);
  const orphanIds = nodes
    .filter((n) => n.kind !== "production" && n.parentIds.length === 0 && !referenced.has(n.id))
    .map((n) => n.id);

  return {
    ok: duplicateIds.length === 0 && brokenEdges.length === 0 && orphanIds.length === 0,
    nodes,
    orphanIds,
    brokenEdges,
    duplicateIds: [...new Set(duplicateIds)],
  };
}

export function assertCandidateLineagePreserved(params: {
  priorCandidateIds: string[];
  nextCandidateIds: string[];
}): { ok: boolean; missing: string[] } {
  const next = new Set(params.nextCandidateIds);
  const missing = params.priorCandidateIds.filter((id) => !next.has(id));
  return { ok: missing.length === 0, missing };
}

export function assertApprovedAssetsProtected(params: {
  approvedAssetIds: string[];
  currentAssetIds: string[];
  replacements?: Record<string, string>;
}): { ok: boolean; violations: string[] } {
  const current = new Set(params.currentAssetIds);
  const violations: string[] = [];
  for (const id of params.approvedAssetIds) {
    if (!current.has(id)) {
      const replacement = params.replacements?.[id];
      violations.push(
        replacement
          ? `approved asset ${id} silently replaced by ${replacement}`
          : `approved asset ${id} missing without explicit replacement record`
      );
    }
  }
  return { ok: violations.length === 0, violations };
}
