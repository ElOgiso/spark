import { resolveSceneGeneratePlan } from "../resolveGeneratePlan";
/**
 * Resolve logical master-asset refs into provider-compatible execution inputs.
 * Planning layer stays storage-agnostic.
 */

import type { ProductionSpec } from "../specification/productionSpec";
import type { GenerationTask } from "../specification/generationTask";
import type { ShotSpec } from "../specification/shotSpec";
import type { ExecutionInputAsset } from "./types";

export interface PreparedTaskInputs {
  inputs: ExecutionInputAsset[];
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: string;
  durationSec?: number;
  resolution?: string;
  model?: string;
  provider: string;
}

function findShot(spec: ProductionSpec, shotId?: string): ShotSpec | undefined {
  if (!shotId) return undefined;
  for (const scene of spec.scenes) {
    const shot = scene.shots.find((s) => s.id === shotId);
    if (shot) return shot;
  }
  return undefined;
}

function resolveAssetUrl(
  spec: ProductionSpec,
  ref: string,
  assetUrlByRef?: Record<string, string>
): string | undefined {
  if (assetUrlByRef?.[ref]) return assetUrlByRef[ref];
  // Character masters may carry reference URLs
  const character = spec.characters.find(
    (c) => c.identity.ref === ref || c.identity.baseId === ref || ref.startsWith(c.identity.baseId)
  );
  if (character?.approvedReferenceUrls?.[0]) return character.approvedReferenceUrls[0];
  return undefined;
}

/**
 * Prepare provider inputs for a generation task from ProductionSpec + prior outputs.
 */
export function prepareTaskInputs(params: {
  spec: ProductionSpec;
  task: GenerationTask;
  /** URLs produced by prior succeeded tasks (taskId → url) */
  priorOutputs?: Record<string, string>;
  /** Optional resolved master asset URLs */
  assetUrlByRef?: Record<string, string>;
}): PreparedTaskInputs {
  const { spec, task } = params;
  const shot = findShot(spec, task.shotId);
  const prior = params.priorOutputs || {};
  const inputs: ExecutionInputAsset[] = [];

  const provider =
    task.selectedProvider ||
    (task.kind === "voice"
      ? spec.routing.preferredVoiceProvider || "elevenlabs"
      : task.kind === "keyframe"
        ? spec.routing.preferredImageProvider || "openai"
        : task.kind === "merge"
          ? "mux"
          : "kling");

  if (task.kind === "keyframe" || task.kind === "video") {
    const charRefs =
      shot?.references.characterRefs?.length
        ? shot.references.characterRefs
        : shot?.characterIds || [];
    for (const ref of charRefs) {
      const url = resolveAssetUrl(spec, ref, params.assetUrlByRef);
      inputs.push({ role: "character", assetRef: ref, url, mimeType: url ? "image/png" : undefined });
      if (url) inputs.push({ role: "reference", assetRef: ref, url, mimeType: "image/png" });
    }
    for (const ref of shot?.references.locationRefs || []) {
      const url = resolveAssetUrl(spec, ref, params.assetUrlByRef);
      if (url) inputs.push({ role: "reference", assetRef: ref, url });
    }
  }

  if (task.kind === "video") {
    // Keyframe dependency → first frame
    const keyframeDep = task.dependsOn.find((d) => d.endsWith("_keyframe"));
    if (keyframeDep && prior[keyframeDep]) {
      inputs.push({ role: "first_frame", url: prior[keyframeDep], mimeType: "image/png" });
    } else if (shot?.references?.firstFrameUrl) {
      inputs.push({ role: "first_frame", url: shot.references.firstFrameUrl, mimeType: "image/png" });
    } else if (shot?.keyframeUrl) {
      inputs.push({ role: "first_frame", url: shot.keyframeUrl, mimeType: "image/png" });
    }

    // Previous video last frame for continuity chain
    const prevVideoDep = task.dependsOn.find((d) => d.endsWith("_video") && d !== `${task.shotId}_video`);
    if (prevVideoDep && prior[`${prevVideoDep}__last_frame`]) {
      inputs.push({
        role: "first_frame",
        url: prior[`${prevVideoDep}__last_frame`],
        mimeType: "image/jpeg",
      });
    }
    if (shot?.references?.lastFrameUrl) {
      inputs.push({ role: "last_frame", url: shot.references.lastFrameUrl, mimeType: "image/jpeg" });
    }
  }

  if (task.kind === "merge") {
    // Dependency sets are sorted by ID; editorial order must come from the spec.
    const shotOrder = spec.scenes.flatMap(scene => scene.shots);
    const orderedDeps = [...task.dependsOn].sort((a, b) => {
      const index = (id: string) => { const i = shotOrder.findIndex(s => id === `${s.id}_keyframe` || id === `${s.id}_video` || s.generationTasks?.some(t => t.id === id)); return i < 0 ? Number.MAX_SAFE_INTEGER : i; };
      return index(a) - index(b);
    });
    for (const dep of orderedDeps) {
      const url = prior[dep];
      if (!url) continue;
      const depTask = spec.productionTasks?.find(t => t.id === dep) || spec.scenes.flatMap(s => s.shots.flatMap(s => s.generationTasks || [])).find(t => t.id === dep);
      const depShot = spec.scenes.flatMap(s => s.shots).find(s => s.id === depTask?.shotId || dep === `${s.id}_keyframe` || dep === `${s.id}_video`);
      const audio = depTask?.kind === "voice" || dep === `${spec.project.id}_voice`;
      const image = !audio && (depShot?.visualPlan ? depShot.visualPlan.kind !== "VIDEO" && depShot.visualPlan.source?.mediaType !== "video" : dep.endsWith("_keyframe"));
      inputs.push({ role: audio ? "audio" : image ? "other" : "source_video", url,
        mimeType: audio ? "audio/mpeg" : image ? "image/png" : "video/mp4", assetRef: dep,
        durationSec: depShot?.durationSec, visualPlan: depShot?.visualPlan });
    }
  }

  return {
    inputs,
    prompt: task.kind === "voice"
      ? spec.scenes.filter(scene => resolveSceneGeneratePlan(String(spec.project.productionMode), scene).audio === "vo")
        .map(scene => scene.narration || scene.spokenLines || scene.shots.map(item => item.narration).filter(Boolean).join(" "))
        .filter(Boolean).join("\n")
      : shot?.compiledPrompt || spec.creative?.intent || "",
    negativePrompt: shot?.compiledNegativePrompt,
    aspectRatio: task.outputRequirements?.aspectRatio || shot?.aspectRatio || String(spec.project.aspectRatio),
    durationSec: task.outputRequirements?.durationSec ?? shot?.durationSec ?? (task.kind === "voice" ? undefined : task.kind === "merge" ? spec.project.targetDurationSec : 5),
    resolution: task.outputRequirements?.resolutionClass || shot?.resolution,
    model: task.selectedModel || shot?.model,
    provider,
  };
}
