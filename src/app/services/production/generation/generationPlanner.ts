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
  const tasks: GenerationTask[] = [];
  const productionId = spec.project.id;
  const decisionByShot = new Map(spec.routing.shotDecisions.map((d) => [d.shotId, d]));

  const characterBaseIds = new Set(spec.characters.map((c) => c.identity.baseId));
  for (const character of spec.characters) {
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

  if (spec.audio.hasNarration || spec.audio.hasDialogue) {
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
            stillOnly && shot.provider && shot.provider !== "unavailable"
              ? shot.provider
              : spec.routing.preferredImageProvider || "openai",
          fallbackProviders: decision?.fallbacks?.map((f) => f.provider).slice(0, 2),
          dependsOn: [],
          dependencies: keyframeDeps,
          priority: keyframePriority,
          status: "planned",
          maxRetries: 2,
          qualityTarget: spec.quality.target,
        })
      );

      if (!stillOnly) {
        const prevShot = previousShot(spec, shot);
        const videoDeps: TaskDependency[] = [
          edge(keyframeId, "ASSET", "hard", {
            detail: "Video requires its keyframe",
          }),
        ];

        const needsContinuity =
          !!prevShot &&
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
