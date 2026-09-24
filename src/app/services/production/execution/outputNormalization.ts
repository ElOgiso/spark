/**
 * Normalize provider outputs + persist as ProductionAsset (existing system).
 */

import type { ProductionAsset } from "../../../domain/types";
import type { GenerationTask } from "../specification/generationTask";
import type { GenerationExecution, NormalizedMediaOutput } from "./types";

export interface AssetPersistPort {
  persist(asset: ProductionAsset): Promise<ProductionAsset>;
}

export function createMemoryAssetPersistPort(): AssetPersistPort & { assets: ProductionAsset[] } {
  const assets: ProductionAsset[] = [];
  return {
    assets,
    async persist(asset) {
      assets.push(asset);
      return asset;
    },
  };
}

export function mediaTypeToAssetType(
  mediaType: NormalizedMediaOutput["mediaType"],
  taskKind: GenerationTask["kind"]
): ProductionAsset["assetType"] {
  if (taskKind === "keyframe" && mediaType === "image") return "frame";
  if (mediaType === "audio") return "audio";
  if (mediaType === "image") return "image";
  return "video";
}

/** Reconstruct the existing asset reference on replay; never write another asset. */
export function restoreExecutionAsset(
  execution: GenerationExecution,
  task: GenerationTask,
  brandId?: string
): ProductionAsset | undefined {
  if (execution.status !== "succeeded" || execution.productionId !== task.productionId || execution.taskId !== task.id || execution.shotId !== task.shotId || execution.sceneId !== task.sceneId) return undefined;
  const output = execution.outputAssets[0];
  const url = output?.persistentUrl || output?.sourceUrl;
  if (!output?.productionAssetId || !url) return undefined;
  return {
    id: output.productionAssetId,
    brandId,
    productionId: execution.productionId,
    taskId: execution.taskId,
    sceneId: execution.sceneId,
    shotId: execution.shotId,
    role: task.kind === "voice" ? "narration" : task.kind === "music" ? "music" : task.kind === "sfx" ? "sfx" : undefined,
    assetType: mediaTypeToAssetType(output.mediaType, task.kind),
    publicUrl: url,
    provider: execution.provider,
    mimeType: output.mimeType,
    duration: output.durationSec != null ? `${output.durationSec}s` : undefined,
    status: "completed",
    createdAt: execution.completedAt,
    generationSettings: {
      taskId: task.id,
      executionId: execution.id,
      providerJobId: execution.providerJobId,
      attempt: execution.attempt,
      width: output.width,
      height: output.height,
      durationSec: output.durationSec,
    },
  };
}

export function checkpointTaskOutput(
  execution: GenerationExecution,
  asset?: ProductionAsset
): GenerationTask["completedOutput"] {
  if (execution.status !== "succeeded" || !asset?.publicUrl || asset.status !== "completed") return undefined;
  return {
    executionId: execution.id,
    inputHash: execution.inputHash,
    attempt: execution.attempt,
    completedAt: execution.completedAt,
    asset: { ...asset },
    lastFrameUrl: typeof execution.metadata?.lastFrameDataUrl === "string" ? execution.metadata.lastFrameDataUrl : undefined,
  };
}

/** Restore a saved completed result without a provider call or new persistence write. */
export function restoreTaskOutput(task: GenerationTask, brandId?: string): { execution: GenerationExecution; asset: ProductionAsset } | undefined {
  const saved = task.completedOutput;
  const asset = saved?.asset;
  if (task.status !== "succeeded" || task.reconciliationRequired || !saved?.executionId || !asset?.publicUrl || asset.status !== "completed") return undefined;
  if (asset.id !== task.productionAssetId || asset.productionId !== task.productionId || asset.taskId !== task.id || asset.shotId !== task.shotId || asset.sceneId !== task.sceneId) return undefined;
  if (brandId && asset.brandId && asset.brandId !== brandId) return undefined;
  const mediaType = asset.assetType === "audio" ? "audio" : asset.assetType === "video" ? "video" : "image";
  return {
    asset: { ...asset },
    execution: {
      id: saved.executionId, inputHash: saved.inputHash, taskId: task.id, productionId: task.productionId,
      sceneId: task.sceneId, shotId: task.shotId, provider: asset.provider || task.selectedProvider || "unknown",
      model: task.selectedModel, status: "succeeded", attempt: saved.attempt, maxAttempts: Math.max(saved.attempt, task.maxRetries ?? 3),
      completedAt: saved.completedAt, inputAssets: [],
      providerJobId: asset.generationSettings?.providerJobId,
      outputAssets: [{ productionAssetId: asset.id, persistentUrl: asset.publicUrl, mediaType, mimeType: asset.mimeType }],
      metadata: { restoredFromTask: true, lastFrameDataUrl: saved.lastFrameUrl },
    },
  };
}

/**
 * Prefer persistent URL when available; never store credentials.
 */
export function toPersistentMediaUrl(output: NormalizedMediaOutput): string | undefined {
  return output.sourceUrl || output.localPath;
}

export async function persistNormalizedOutput(params: {
  output: NormalizedMediaOutput;
  execution: GenerationExecution;
  task: GenerationTask;
  brandId?: string;
  persistPort: AssetPersistPort;
}): Promise<ProductionAsset> {
  const { output, execution, task, brandId, persistPort } = params;
  const url = toPersistentMediaUrl(output);
  if (!url) {
    throw new Error("Cannot persist output without URL");
  }

  const asset: ProductionAsset = {
    id: `asset_${execution.id}`,
    brandId,
    productionId: execution.productionId,
    role: task.kind === "voice" ? "narration" : task.kind === "music" ? "music" : task.kind === "sfx" ? "sfx" : undefined,
    assetType: mediaTypeToAssetType(output.mediaType, task.kind),
    provider: execution.provider,
    storageBucket: "Spark",
    storagePath: `${execution.productionId}/tasks/${task.id}/${execution.attempt}`,
    publicUrl: url,
    mimeType: output.mimeType,
    duration: output.durationSec != null ? `${output.durationSec}s` : undefined,
    generationPrompt: typeof execution.metadata?.prompt === "string" ? execution.metadata.prompt : undefined,
    generationSettings: {
      taskId: task.id,
      executionId: execution.id,
      sceneId: execution.sceneId,
      shotId: execution.shotId,
      attempt: execution.attempt,
      providerJobId: output.providerJobId,
      modality: task.strategy?.modality,
      width: output.width,
      height: output.height,
      durationSec: output.durationSec,
      ...(execution.provider === "source_media" ? {
        visualKind: execution.metadata?.visualKind,
        sourceAttribution: execution.metadata?.attribution,
        sourceAssetId: execution.metadata?.sourceAssetId,
      } : {}),
      // usage only when actually provided
      ...(output.usage ? { usage: output.usage } : {}),
    },
    status: "completed",
    createdAt: new Date().toISOString(),
    // Optional association fields (non-breaking extensions)
    ...( {
      taskId: task.id,
      sceneId: execution.sceneId,
      shotId: execution.shotId,
    } as Partial<ProductionAsset> ),
  };

  return persistPort.persist(asset);
}

/**
 * Enrich normalized output with optional measured metadata (injectable).
 * Default: pass-through — real FFmpeg probing belongs to runtime finalize paths.
 */
export function enrichOutputMetadata(
  output: NormalizedMediaOutput,
  extras?: Partial<NormalizedMediaOutput>
): NormalizedMediaOutput {
  return {
    ...output,
    ...extras,
    metadata: { ...output.metadata, ...(extras?.metadata || {}) },
    fileSizeBytes: extras?.fileSizeBytes ?? output.fileSizeBytes ?? 1024,
  };
}

import { sanitizeDiagnostics } from "./errors";

/**
 * Bridges Phase 11 NormalizedProviderResult to NormalizedMediaOutput for canonical ProductionAsset persistence.
 */
export function normalizedResultToMediaOutput(
  result: import("./adapters/types").NormalizedProviderResult
): NormalizedMediaOutput {
  const primary = result.outputs[0];
  return {
    mediaType: primary?.type || "video",
    sourceUrl: primary?.url,
    mimeType:
      primary?.mimeType ||
      (primary?.type === "audio"
        ? "audio/mpeg"
        : primary?.type === "image"
        ? "image/png"
        : "video/mp4"),
    width: primary?.width,
    height: primary?.height,
    durationSec: primary?.durationSec,
    providerJobId: result.providerJobId,
    metadata:
      sanitizeDiagnostics({
        provider: result.provider,
        model: result.model,
        rawStatus: result.rawStatus,
        ...(result.metadata || {}),
      }) || {},
    usage: result.usage
      ? {
          estimatedCost: undefined,
          actualCost: undefined,
          inputUnits: result.usage.characterCount || result.usage.inputTokens,
          outputUnits: result.usage.durationSeconds || result.usage.imageCount || result.usage.outputTokens,
        }
      : undefined,
  };
}
