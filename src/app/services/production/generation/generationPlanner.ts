import { usesSourceVisual } from "./visualMedia";
/**
 * Generation planner — ProductionSpec → ordered GenerationTask DAG nodes.
 * Aligns with specification/generationTask.ts (single contract).
 * Emits typed hard/soft dependency edges for the execution DAG.
 * Does NOT execute media generation.
 */

import type { ProductionSpec } from "../specification/productionSpec";
import type { ShotSpec } from "../specification/shotSpec";
import type {
  GenerationTask,
  TaskDependency,
  TaskPriority,
} from "../specification/generationTask";
import { syncDependsOn } from "../specification/generationTask";
import { strategyFromAlias } from "../specification/generationStrategy";
import { strategyToRequiredCapabilities } from "../routing/capabilityMatrix";
import { applyLongFormVisualPlanning } from "./strategyResolver";

import { resolveSceneGeneratePlan } from "../resolveGeneratePlan";
import { normalizeModeString } from "../resolveProductionMode";

export type { GenerationTask };
export type { GenerationTaskKind } from "../specification/generationTask";

function edge(
  taskId: string,
  reason: TaskDependency["reason"],
  strength: TaskDependency["strength"] = "hard",
  extra?: Partial<TaskDependency>
): TaskDependency {
  return { taskId, reason, strength, requirement: "completed", ...extra };
}

function sanitizeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function characterReferenceId(baseId: string): string {
  return `character_${sanitizeId(baseId)}_reference`;
}

function locationReferenceId(locationId: string): string {
  return `location_${sanitizeId(locationId)}_reference`;
}

/**
 * Plan generation tasks. Narrative order ≠ execution order unless CONTINUITY/SEQUENTIAL edges exist.
 */
export function planGenerationTasks(spec: ProductionSpec): GenerationTask[] {
  spec = applyLongFormVisualPlanning(spec);
  const tasks: GenerationTask[] = [];
  const productionId = spec.project.id;
  const decisionByShot = new Map(spec.routing.shotDecisions.map((d) => [d.shotId, d]));

  const generatedShots = spec.scenes.flatMap(scene => scene.shots).filter(shot => !usesSourceVisual(shot));
  const hasSourcedShots = spec.scenes.some(scene => scene.shots.some(usesSourceVisual));
  const characterBaseIds = new Set(spec.characters.map((c) => c.identity.baseId));
  for (const character of spec.characters) {
    if (hasSourcedShots && !generatedShots.some(shot => shot.characterIds.some(ref => ref.split(":")[0] === character.identity.baseId))) continue;
    const id = characterReferenceId(character.identity.baseId);
    tasks.push(
      syncDependsOn({
        id,
        kind: "keyframe",
        productionId,
        strategy: strategyFromAlias("text_to_image"),
        requiredCapabilities: ["text_to_image"],
        preferredCapabilities: ["character_consistency", "multi_reference"],
        selectedProvider: spec.routing.preferredImageProvider || "openai",
        dependsOn: [],
        dependencies: [],
        priority: "CRITICAL",
        status: "planned",
        maxRetries: 2,
        qualityTarget: spec.quality.target,
      })
    );
  }

  const locationIds = new Set((spec.world.locations || []).map((l) => l.id));
  for (const location of spec.world.locations || []) {
    if (hasSourcedShots && !generatedShots.some(shot => shot.references.locationRefs.some(ref => ref.split(":")[0] === location.id))) continue;
    const id = locationReferenceId(location.id);
    tasks.push(
      syncDependsOn({
        id,
        kind: "keyframe",
        productionId,
        strategy: strategyFromAlias("text_to_image"),
        requiredCapabilities: ["text_to_image"],
        selectedProvider: spec.routing.preferredImageProvider || "openai",
        dependsOn: [],
        dependencies: [],
        priority: "CRITICAL",
        status: "planned",
        maxRetries: 2,
        qualityTarget: spec.quality.target,
      })
    );
  }

  if (normalizeModeString(String(spec.project.productionMode)) !== "deep" && spec.audio.hasNarration) {
    tasks.push(
      syncDependsOn({
        id: `${productionId}_voice`,
        kind: "voice",
        productionId,
        strategy: strategyFromAlias("voice"),
        requiredCapabilities: ["voice"],
        selectedProvider: spec.routing.preferredVoiceProvider || "elevenlabs",
        dependsOn: [],
        dependencies: [],
        priority: "HIGH",
        status: "planned",
        maxRetries: 2,
      })
    );
  }

  for (const scene of spec.scenes) {
    for (const shot of scene.shots) {
      const decision = decisionByShot.get(shot.id);
      const keyframeId = `${shot.id}_keyframe`;
      const stillOnly =
        shot.visualPlan ? shot.visualPlan.kind !== "VIDEO" :
          resolveSceneGeneratePlan(String(spec.project.productionMode), scene).stillOnly ||
          shot.generationStrategy === "slideshow_still" || shot.generationStrategy === "text_to_image";

      const keyframeDeps: TaskDependency[] = [];
      for (const cid of shot.characterIds || []) {
        const base = cid.includes(":") ? cid.split(":")[0]! : cid;
        if (characterBaseIds.has(base)) {
          keyframeDeps.push(
            edge(characterReferenceId(base), "REFERENCE", "hard", {
              detail: `Shot ${shot.id} requires character reference`,
            })
          );
        }
      }
      for (const lid of shot.references?.locationRefs || []) {
        const base = lid.includes(":") ? lid.split(":")[0]! : lid;
        if (locationIds.has(base)) {
          keyframeDeps.push(
            edge(locationReferenceId(base), "REFERENCE", "hard", {
              detail: `Shot ${shot.id} requires location reference`,
            })
          );
        }
      }

      const keyframePriority: TaskPriority = keyframeDeps.length ? "HIGH" : "NORMAL";

      tasks.push(
        syncDependsOn({
          id: keyframeId,
          kind: "keyframe",
          productionId,
          sceneId: scene.id,
          shotId: shot.id,
          strategy: strategyFromAlias("text_to_image"),
          requiredCapabilities: ["text_to_image"],
          preferredCapabilities: shot.characterIds.length
            ? ["character_consistency", "multi_reference"]
            : [],
          selectedProvider:
            usesSourceVisual(shot) ? "source_media" : !shot.visualPlan && stillOnly && shot.provider && shot.provider !== "unavailable"
              ? shot.provider
              : spec.routing.preferredImageProvider || "openai",
          fallbackProviders: shot.visualPlan ? undefined : decision?.fallbacks?.map((f) => f.provider).slice(0, 2),
          dependsOn: [],
          dependencies: usesSourceVisual(shot) ? [] : keyframeDeps,
          priority: keyframePriority,
          status: "planned",
          maxRetries: 2,
          qualityTarget: spec.quality.target,
        })
      );

      if (!stillOnly) {
        const previous = previousShot(spec, shot);
        const prevShot = previous && tasks.some(task => task.shotId === previous.id && task.kind === "video") ? previous : null;
        const videoDeps: TaskDependency[] = [
          edge(keyframeId, "ASSET", "hard", {
            detail: "Video requires its keyframe",
          }),
        ];

        const needsContinuity =
          !!prevShot &&
          (!prevShot.visualPlan || prevShot.visualPlan.kind === "VIDEO") &&
          (shot.generationStrategy === "first_last_frame" ||
            spec.continuity.lastFrameChainEnabled);

        if (needsContinuity && prevShot) {
          videoDeps.push(
            edge(`${prevShot.id}_video`, "CONTINUITY", "hard", {
              requirement: "approved_output",
              detail: `Requires approved end state from ${prevShot.id}`,
            })
          );
        } else if (prevShot && prevShot.sceneId === scene.id) {
          // Soft narrative adjacency — must NOT block parallel execution
          videoDeps.push(
            edge(`${prevShot.id}_video`, "SEQUENTIAL", "soft", {
              detail: "Preferred prior shot in scene (soft)",
            })
          );
        }

        const strategySpec = shot.generationStrategySpec || strategyFromAlias(shot.generationStrategy);
        const caps = strategyToRequiredCapabilities(shot.generationStrategy, shot).map(String);

        tasks.push(
          syncDependsOn({
            id: `${shot.id}_video`,
            kind: "video",
            productionId,
            sceneId: scene.id,
            shotId: shot.id,
            strategy: strategySpec,
            requiredCapabilities: caps,
            preferredCapabilities: caps.filter((c) =>
              ["character_consistency", "last_frame_conditioning", "motion_quality"].includes(c)
            ),
            selectedProvider:
              shot.provider && shot.provider !== "unavailable" ? shot.provider : undefined,
            selectedModel: shot.model,
            fallbackProviders: decision?.fallbacks?.map((f) => f.provider) || [],
            dependsOn: [],
            dependencies: videoDeps,
            priority: needsContinuity ? "HIGH" : "NORMAL",
            requiresApproval: true,
            status: "blocked",
            maxRetries: shot.retry?.maxAttempts ?? 2,
            qualityTarget: spec.quality.target,
            speedPriority: spec.routing.capabilityPolicy.preferSpeed,
            costPriority: spec.routing.capabilityPolicy.preferCost,
          })
        );
      }
    }
  }

  const leafIds = tasks
    .filter((t) => {
      if (t.id.includes("_reference")) return false;
      if (t.kind === "video") return true;
      if (t.kind === "keyframe") {
        return !tasks.some((v) => v.shotId === t.shotId && v.kind === "video");
      }
      return false;
    })
    .map((t) => t.id);

  const mergeDeps: TaskDependency[] = leafIds.map((id) =>
    edge(id, "EDITORIAL", "hard", { detail: "Master merge requires leaf media" })
  );
  if (tasks.some((t) => t.kind === "voice")) {
    mergeDeps.push(
      edge(`${productionId}_voice`, "EDITORIAL", "hard", { detail: "Master merge requires voice" })
    );
  }

  tasks.push(
    syncDependsOn({
      id: `${productionId}_master_merge`,
      kind: "merge",
      productionId,
      strategy: strategyFromAlias("mux_edit"),
      requiredCapabilities: ["editing"],
      dependsOn: [],
      dependencies: mergeDeps,
      priority: "HIGH",
      status: "blocked",
      maxRetries: 1,
    })
  );

  return tasks.map((t) => ({
    ...t,
    status: (t.dependsOn.length === 0 ? "queued" : "blocked") as GenerationTask["status"],
  }));
}

/** One task selection policy for the live bridge and canonical executor. */
export function resolveGenerationTasks(
  spec: ProductionSpec,
  preferExistingTasks = true
): { spec: ProductionSpec; tasks: GenerationTask[] } {
  spec = applyLongFormVisualPlanning(spec);
  const planned = planGenerationTasks(spec);
  const byId = new Map(planned.map(task => [task.id, task]));
  if (preferExistingTasks) {
    const shotScenes = new Map(spec.scenes.flatMap(scene => scene.shots.map(shot => [shot.id, scene.id] as const)));
    const sceneIds = new Set(spec.scenes.map(scene => scene.id));
    const retain = (task: GenerationTask) => {
      const shot = spec.scenes.flatMap(scene => scene.shots).find(shot => shot.id === task.shotId);
      if (shot?.visualPlan && (task.kind === "video" || task.kind === "keyframe") &&
          (!byId.has(task.id) || (task.kind === "video" && shot.visualPlan.kind !== "VIDEO"))) {
        if (task.status === "running" || task.status === "succeeded" || task.reconciliationRequired) {
          throw new Error(`Visual replanning requires recovery/review of existing task ${task.id} before changing its generation plan`);
        }
        return;
      }
      if (task.kind === "video" && shot?.visualPlan && shot.visualPlan.kind !== "VIDEO") return;
      if (task.productionId !== spec.project.id) return;
      if (task.sceneId && !sceneIds.has(task.sceneId)) return;
      if (task.shotId && (!shotScenes.has(task.shotId) || (task.sceneId && shotScenes.get(task.shotId) !== task.sceneId))) return;
      if (task.kind === "voice" && !planned.some(item => item.kind === "voice")) return;
      if (task.kind === "video" && !planned.some(item => item.kind === "video" && item.shotId === task.shotId)) return;
      const current = byId.get(task.id);
      // A reused ID must still describe the same work.
      if (current && (current.kind !== task.kind || current.shotId !== task.shotId || current.sceneId !== task.sceneId)) return;
      const dependenciesChanged = current && [...current.dependsOn].sort().join("|") !== [...task.dependsOn].sort().join("|");
      const selected = current ? {
        ...task, dependencies: current.dependencies, dependsOn: current.dependsOn,
        ...(dependenciesChanged && task.status === "succeeded" ? {
          status: current.status, productionAssetId: undefined, completedOutput: undefined, retryCount: 0, lastError: undefined,
        } : {}),
      } : task;
      if (shot?.visualPlan && current && task.kind === "keyframe" && task.status !== "succeeded" && task.status !== "running") {
        byId.set(task.id, { ...selected, strategy: current.strategy, selectedProvider: current.selectedProvider,
          selectedModel: task.selectedProvider === current.selectedProvider ? task.selectedModel : undefined,
          fallbackProviders: current.fallbackProviders });
      } else byId.set(task.id, selected);
    };
    for (const task of spec.productionTasks || []) {
      if (!task.shotId) retain(task);
    }
    for (const scene of spec.scenes) {
      for (const shot of scene.shots) {
        for (const task of shot.generationTasks || []) {
          if (!task.shotId || task.shotId === shot.id) retain(task);
        }
      }
    }
  }
  const tasks = [...byId.values()];
  return { tasks, spec: attachGenerationTasksToSpec(spec, tasks) };
}

export function attachGenerationTasksToSpec(
  spec: ProductionSpec,
  tasks?: GenerationTask[]
): ProductionSpec {
  const all = tasks || planGenerationTasks(spec);
  const byShot = new Map<string, GenerationTask[]>();
  for (const t of all) {
    if (!t.shotId) continue;
    const list = byShot.get(t.shotId) || [];
    list.push(t);
    byShot.set(t.shotId, list);
  }

  return {
    ...spec,
    productionTasks: all.filter(task => !task.shotId),
    scenes: spec.scenes.map((scene) => ({
      ...scene,
      shots: scene.shots.map((shot) => ({
        ...shot,
        generationTasks: byShot.get(shot.id) || [],
      })),
    })),
  };
}

function previousShot(spec: ProductionSpec, shot: ShotSpec): ShotSpec | null {
  const all = spec.scenes.flatMap((s) => s.shots);
  const idx = all.findIndex((s) => s.id === shot.id);
  if (idx <= 0) return null;
  return all[idx - 1];
}
