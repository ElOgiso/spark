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
    } else if (shot?.references.firstFrameUrl) {
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
    if (shot?.references.lastFrameUrl) {
      inputs.push({ role: "last_frame", url: shot.references.lastFrameUrl, mimeType: "image/jpeg" });
    }
  }

  if (task.kind === "merge") {
    for (const dep of task.dependsOn) {
      const url = prior[dep];
      if (url) inputs.push({ role: "source_video", url, mimeType: "video/mp4", assetRef: dep });
    }
  }

  return {
    inputs,
    prompt: shot?.compiledPrompt || spec.creative.intent,
    negativePrompt: shot?.compiledNegativePrompt,
    aspectRatio: shot?.aspectRatio || String(spec.project.aspectRatio),
    durationSec: shot?.durationSec || (task.kind === "voice" ? undefined : 5),
    resolution: shot?.resolution,
    model: task.selectedModel || shot?.model,
    provider,
  };
}
