/**
 * Generation planner — turns routed shots into ordered generation tasks.
 */

import type { ProductionSpec } from "../specification/productionSpec";
import type { ShotSpec } from "../specification/shotSpec";

export type GenerationTaskKind =
  | "keyframe"
  | "video"
  | "voice"
  | "sfx"
  | "music"
  | "merge";

export interface GenerationTask {
  id: string;
  kind: GenerationTaskKind;
  productionId: string;
  sceneId?: string;
  shotId?: string;
  provider?: string;
  model?: string;
  strategy?: string;
  dependsOn: string[];
  status: "queued" | "ready" | "blocked";
  prompt?: string;
  negativePrompt?: string;
}

export function planGenerationTasks(spec: ProductionSpec): GenerationTask[] {
  const tasks: GenerationTask[] = [];
  const productionId = spec.project.id;

  if (spec.audio.hasNarration || spec.audio.hasDialogue) {
    tasks.push({
      id: `${productionId}_voice`,
      kind: "voice",
      productionId,
      provider: spec.routing.preferredVoiceProvider || "elevenlabs",
      dependsOn: [],
      status: "ready",
    });
  }

  for (const scene of spec.scenes) {
    for (const shot of scene.shots) {
      const keyframeId = `${shot.id}_keyframe`;
      tasks.push({
        id: keyframeId,
        kind: "keyframe",
        productionId,
        sceneId: scene.id,
        shotId: shot.id,
        provider: shot.generationStrategy === "slideshow_still" ? shot.provider || "openai" : "openai",
        strategy: "text_to_image",
        dependsOn: [],
        status: "ready",
        prompt: shot.compiledPrompt,
        negativePrompt: shot.compiledNegativePrompt,
      });

      if (shot.generationStrategy !== "slideshow_still") {
        const prevShot = previousShot(spec, shot);
        const dependsOn = [keyframeId];
        if (prevShot) dependsOn.push(`${prevShot.id}_video`);
        tasks.push({
          id: `${shot.id}_video`,
          kind: "video",
          productionId,
          sceneId: scene.id,
          shotId: shot.id,
          provider: shot.provider,
          model: shot.model,
          strategy: shot.generationStrategy,
          dependsOn,
          status: "blocked",
          prompt: shot.compiledPrompt,
          negativePrompt: shot.compiledNegativePrompt,
        });
      }
    }
  }

  tasks.push({
    id: `${productionId}_master_merge`,
    kind: "merge",
    productionId,
    dependsOn: tasks.filter((t) => t.kind === "video" || (t.kind === "keyframe" && !tasks.some((v) => v.shotId === t.shotId && v.kind === "video"))).map((t) => t.id),
    status: "blocked",
  });

  return tasks.map((t) => ({
    ...t,
    status: t.dependsOn.length === 0 ? "ready" : "blocked",
  }));
}

function previousShot(spec: ProductionSpec, shot: ShotSpec): ShotSpec | null {
  const all = spec.scenes.flatMap((s) => s.shots);
  const idx = all.findIndex((s) => s.id === shot.id);
  if (idx <= 0) return null;
  return all[idx - 1];
}
