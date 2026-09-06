/**
 * Cross-contract validators — wraps existing spec validators; no second schema system.
 */

import {
  validateProductionSpec,
  validateSceneSpec,
  validateShotSpec,
  type ProductionSpec,
  type SceneSpec,
  type ShotSpec,
} from "../specification";
import { validateProductionDag, type ProductionDag } from "../dag/productionDag";
import type { ContractIssue, ContractValidationReport } from "./types";

function issue(
  path: string,
  severity: "error" | "warning",
  code: string,
  message: string
): ContractIssue {
  return { path, severity, code, message };
}

export function validateProductionContracts(spec: ProductionSpec): ContractValidationReport {
  const errors: ContractIssue[] = [];
  const warnings: ContractIssue[] = [];

  const base = validateProductionSpec(spec);
  for (const e of base.errors) errors.push(issue("production", "error", "SPEC_INVALID", e));
  for (const w of base.warnings) warnings.push(issue("production", "warning", "SPEC_WARNING", w));

  const sceneIds = new Set<string>();
  const shotIds = new Set<string>();

  for (const scene of spec.scenes || []) {
    if (sceneIds.has(scene.id)) {
      errors.push(issue(`scene:${scene.id}`, "error", "DUPLICATE_SCENE_ID", "Duplicate scene id"));
    }
    sceneIds.add(scene.id);

    const sceneResult = validateSceneSpec(scene);
    for (const e of sceneResult.errors) {
      errors.push(issue(`scene:${scene.id}`, "error", "SCENE_INVALID", e));
    }

    for (const shot of scene.shots || []) {
      if (shotIds.has(shot.id)) {
        errors.push(issue(`shot:${shot.id}`, "error", "DUPLICATE_SHOT_ID", "Duplicate shot id"));
      }
      shotIds.add(shot.id);

      if (shot.sceneId && shot.sceneId !== scene.id) {
        errors.push(
          issue(
            `shot:${shot.id}`,
            "error",
            "SHOT_SCENE_MISMATCH",
            `shot.sceneId ${shot.sceneId} does not match parent scene ${scene.id}`
          )
        );
      }

      const shotResult = validateShotSpec(shot);
      for (const e of shotResult.errors) {
        errors.push(issue(`shot:${shot.id}`, "error", "SHOT_INVALID", e));
      }

      const purpose = (shot as { purpose?: string }).purpose;
      const productionReason = (shot as { productionReason?: string }).productionReason;
      if (!productionReason?.trim() && !purpose?.trim()) {
        errors.push(
          issue(`shot:${shot.id}`, "error", "MISSING_VISUAL_JOB", "Shot lacks production purpose / visual job")
        );
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

export function validateSceneContracts(scene: SceneSpec): ContractValidationReport {
  const r = validateSceneSpec(scene);
  return {
    ok: r.ok,
    errors: r.errors.map((e) => issue(`scene:${scene.id}`, "error", "SCENE_INVALID", e)),
    warnings: r.warnings.map((w) => issue(`scene:${scene.id}`, "warning", "SCENE_WARNING", w)),
  };
}

export function validateShotContracts(shot: ShotSpec): ContractValidationReport {
  const r = validateShotSpec(shot);
  return {
    ok: r.ok,
    errors: r.errors.map((e) => issue(`shot:${shot.id}`, "error", "SHOT_INVALID", e)),
    warnings: r.warnings.map((w) => issue(`shot:${shot.id}`, "warning", "SHOT_WARNING", w)),
  };
}

export function validateDagContracts(dag: ProductionDag): ContractValidationReport {
  const r = validateProductionDag(dag);
  const errors: ContractIssue[] = [];
  for (const item of r.issues || []) {
    const path = (item as { nodeId?: string }).nodeId
      ? `dag:${(item as { nodeId?: string }).nodeId}`
      : "dag";
    errors.push(issue(path, "error", item.code || "DAG_ISSUE", item.message));
  }
  return { ok: r.ok && errors.length === 0, errors, warnings: [] };
}
