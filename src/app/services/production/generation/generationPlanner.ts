/**
 * Generation planner — ProductionSpec → ordered GenerationTask DAG nodes.
 * Aligns with specification/generationTask.ts (single contract).
 * Does NOT execute media generation.
 */

import type { ProductionSpec } from "../specification/productionSpec";
import type { ShotSpec } from "../specification/shotSpec";
import type { GenerationTask } from "../specification/generationTask";
import { strategyFromAlias } from "../specification/generationStrategy";
import { strategyToRequiredCapabilities } from "../routing/capabilityMatrix";

export type { GenerationTask };
export type { GenerationTaskKind } from "../specification/generationTask";

export function planGenerationTasks(spec: ProductionSpec): GenerationTask[] {
  const tasks: GenerationTask[] = [];
  const productionId = spec.project.id;
  const decisionByShot = new Map(spec.routing.shotDecisions.map((d) => [d.shotId, d]));

  if (spec.audio.hasNarration || spec.audio.hasDialogue) {
    tasks.push({
      id: `${productionId}_voice`,
      kind: "voice",
      productionId,
      strategy: strategyFromAlias("voice"),
      requiredCapabilities: ["voice"],
      selectedProvider: spec.routing.preferredVoiceProvider || "elevenlabs",
      dependsOn: [],
      status: "planned",
      maxRetries: 2,
    });
  }

  for (const scene of spec.scenes) {
    for (const shot of scene.shots) {
      const decision = decisionByShot.get(shot.id);
      const keyframeId = `${shot.id}_keyframe`;
      const stillOnly =
        shot.generationStrategy === "slideshow_still" || shot.generationStrategy === "text_to_image";

      tasks.push({
        id: keyframeId,
        kind: "keyframe",
        productionId,
        sceneId: scene.id,
        shotId: shot.id,
        strategy: strategyFromAlias("text_to_image"),
        requiredCapabilities: ["text_to_image"],
        preferredCapabilities: shot.characterIds.length ? ["character_consistency", "multi_reference"] : [],
        selectedProvider:
          stillOnly && shot.provider && shot.provider !== "unavailable"
            ? shot.provider
            : spec.routing.preferredImageProvider || "openai",
        fallbackProviders: decision?.fallbacks?.map((f) => f.provider).slice(0, 2),
        dependsOn: [],
        status: "planned",
        maxRetries: 2,
        qualityTarget: spec.quality.target,
      });

      if (!stillOnly) {
        const prevShot = previousShot(spec, shot);
        const dependsOn = [keyframeId];
        // Continuity: wait for previous video when first/last frame chaining
        if (
          prevShot &&
          (shot.generationStrategy === "first_last_frame" || spec.continuity.lastFrameChainEnabled)
        ) {
          dependsOn.push(`${prevShot.id}_video`);
        }

        const strategySpec = shot.generationStrategySpec || strategyFromAlias(shot.generationStrategy);
        const caps = strategyToRequiredCapabilities(shot.generationStrategy, shot).map(String);

        tasks.push({
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
          selectedProvider: shot.provider && shot.provider !== "unavailable" ? shot.provider : undefined,
          selectedModel: shot.model,
          fallbackProviders: decision?.fallbacks?.map((f) => f.provider) || [],
          dependsOn,
          status: "blocked",
          maxRetries: shot.retry?.maxAttempts ?? 2,
          qualityTarget: spec.quality.target,
          speedPriority: spec.routing.capabilityPolicy.preferSpeed,
          costPriority: spec.routing.capabilityPolicy.preferCost,
        });
      }
    }
  }

  const leafIds = tasks
    .filter((t) => {
      if (t.kind === "video") return true;
      if (t.kind === "keyframe") {
        return !tasks.some((v) => v.shotId === t.shotId && v.kind === "video");
      }
      return false;
    })
    .map((t) => t.id);

  const mergeDepends = [...leafIds];
  if (tasks.some((t) => t.kind === "voice")) mergeDepends.push(`${productionId}_voice`);

  tasks.push({
    id: `${productionId}_master_merge`,
    kind: "merge",
    productionId,
    strategy: strategyFromAlias("mux_edit"),
    requiredCapabilities: ["editing"],
    dependsOn: mergeDepends,
    status: "blocked",
    maxRetries: 1,
  });

  return tasks.map((t) => ({
    ...t,
    status: t.dependsOn.length === 0 ? "queued" : "blocked",
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
