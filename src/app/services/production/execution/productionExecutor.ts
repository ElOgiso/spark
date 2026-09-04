/**
 * Production-level execution entry point.
 * executeProduction(spec) → validate → DAG → scheduler → assets → state
 */

import type { ProductionSpec } from "../specification/productionSpec";
import { validateProductionSpec } from "../specification";
import { planGenerationTasks, attachGenerationTasksToSpec } from "../generation/generationPlanner";
import { buildProductionDag } from "../dag/productionDag";
import type { GenerationTask } from "../specification/generationTask";
import {
  GenerationExecutionEngine,
  type ExecutionEngineOptions,
  type ExecutionEngineResult,
} from "./executionEngine";
import type { ProductionExecutionState } from "./types";

export interface ExecuteProductionOptions extends ExecutionEngineOptions {
  /** Use tasks already on the spec when present */
  preferExistingTasks?: boolean;
}

export interface ExecuteProductionResult extends ExecutionEngineResult {
  spec: ProductionSpec;
  productionState: ProductionExecutionState;
}

/**
 * Canonical production media execution.
 * Does not redesign UI — returns structured state for existing surfaces.
 */
export async function executeProduction(
  spec: ProductionSpec,
  options: ExecuteProductionOptions = {}
): Promise<ExecuteProductionResult> {
  const validation = validateProductionSpec(spec);
  if (!validation.ok) {
    return {
      ok: false,
      state: "failed",
      productionState: "failed",
      spec,
      tasks: [],
      executions: [],
      assets: [],
      dag: { productionId: spec.project.id, nodes: [] },
      errors: validation.errors,
    };
  }

  let tasks: GenerationTask[] = [];
  if (options.preferExistingTasks !== false) {
    tasks = spec.scenes.flatMap((s) => s.shots.flatMap((sh) => sh.generationTasks || []));
    // Include production-level tasks (voice/merge) if attached on any shot only —
    // prefer full planGenerationTasks when incomplete
    const hasMerge = tasks.some((t) => t.kind === "merge");
    const hasKeyframe = tasks.some((t) => t.kind === "keyframe");
    if (!hasMerge || !hasKeyframe || tasks.length < 2) {
      tasks = planGenerationTasks(spec);
    }
  } else {
    tasks = planGenerationTasks(spec);
  }

  // Dedupe by id
  const seen = new Set<string>();
  tasks = tasks.filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });

  const dag = buildProductionDag(spec, tasks);
  const engine = new GenerationExecutionEngine(options);
  const result = await engine.executePlan({ spec, tasks, dag });

  // Attach updated task statuses back onto a cloned spec (non-destructive to callers who keep old)
  const taskById = new Map(result.tasks.map((t) => [t.id, t]));
  const updatedSpec: ProductionSpec = {
    ...attachGenerationTasksToSpec(spec, result.tasks),
    project: {
      ...spec.project,
      status:
        result.state === "completed"
          ? "generating"
          : result.state === "failed"
            ? "failed"
            : spec.project.status,
      updatedAt: new Date().toISOString(),
    },
    scenes: spec.scenes.map((scene) => ({
      ...scene,
      shots: scene.shots.map((shot) => ({
        ...shot,
        generationTasks: (shot.generationTasks || []).map((t) => taskById.get(t.id) || t),
        generationStatus:
          result.tasks.find((t) => t.shotId === shot.id && t.kind === "video")?.status === "succeeded"
            ? "generated"
            : shot.generationStatus,
        mediaUrl:
          result.assets.find((a) => a.shotId === shot.id && a.assetType === "video")?.publicUrl ||
          shot.mediaUrl,
        keyframeUrl:
          result.assets.find((a) => a.shotId === shot.id && a.assetType === "frame")?.publicUrl ||
          shot.keyframeUrl,
      })),
    })),
  };

  return {
    ...result,
    spec: updatedSpec,
    productionState: result.state,
  };
}

export type { ExecutionEngineResult, ExecutionEngineOptions };
