/**
 * Live generate execute port: ProductionSpec → AssetService via bridge.
 * Keeps Phase 10 lifecycle as conductor without dual media spenders.
 */

import type { Brand, Character, GenerationProgress, MemoryItem, Production } from "../../../domain/types";
import type { ProductionSpec } from "../specification/productionSpec";
import { buildProductionDag } from "../dag/productionDag";
import type { ExecuteProductionOptions, ExecuteProductionResult } from "./productionExecutor";
import { executeProduction } from "./productionExecutor";
import {
  executeProductionViaAssetBridge,
  type ProductionExecutionBridgeResult,
} from "./productionExecutionBridge";

export interface LiveAssetExecuteContext {
  production: Production;
  brand: Brand;
  character?: Character;
  characters?: Character[];
  memoryItems?: MemoryItem[];
  creditSettings?: import("../../../domain/types").GenerationCreditSettings;
  onProgress?: (progress: GenerationProgress) => void;
  forceRegenerate?: boolean;
  signal?: AbortSignal;
}

export interface LiveAssetExecuteAdapter {
  executeProduction: (
    spec: ProductionSpec,
    options?: ExecuteProductionOptions
  ) => Promise<ExecuteProductionResult>;
  getLastBridgeResult: () => ProductionExecutionBridgeResult | null;
}

/**
 * Map Spec-driven AssetService runs into ExecuteProductionResult for lifecycle.
 * dryRun falls through to the DAG executor (no live provider spend).
 */
export function createLiveAssetExecuteAdapter(
  ctx: LiveAssetExecuteContext
): LiveAssetExecuteAdapter {
  let lastBridgeResult: ProductionExecutionBridgeResult | null = null;

  const executeViaBridge = async (
    spec: ProductionSpec,
    options: ExecuteProductionOptions = {}
  ): Promise<ExecuteProductionResult> => {
    if (options.dryRun === true) {
      return executeProduction(spec, { ...options, dryRun: true });
    }

    const bridge = await executeProductionViaAssetBridge({
      production: {
        ...ctx.production,
        reasoning: {
          ...(typeof ctx.production.reasoning === "object" && ctx.production.reasoning
            ? ctx.production.reasoning
            : {}),
          productionSpec: spec,
        },
      },
      brand: ctx.brand,
      character: ctx.character,
      characters: ctx.characters,
      memoryItems: ctx.memoryItems,
      creditSettings: ctx.creditSettings,
      onProgress: ctx.onProgress,
      forceRegenerate: ctx.forceRegenerate,
      signal: ctx.signal,
    });
    lastBridgeResult = bridge;

    const masterOk = Boolean(bridge.assetResult.videoUrl);
    const anyTaskFailed = bridge.tasks.some((t) => t.status === "failed");
    const ok = masterOk && !anyTaskFailed;
    const now = new Date().toISOString();
    const dag = buildProductionDag(bridge.spec, bridge.tasks);

    const executions = bridge.tasks.map((t) => ({
      id: `exec_${t.id}`,
      taskId: t.id,
      productionId: bridge.production.id,
      sceneId: t.sceneId,
      shotId: t.shotId,
      provider: t.selectedProvider || "asset_service",
      model: t.selectedModel,
      status: (t.status === "succeeded"
        ? "succeeded"
        : t.status === "failed"
          ? "failed"
          : t.status === "running"
            ? "running"
            : "queued") as ExecuteProductionResult["executions"][number]["status"],
      attempt: (t.retryCount || 0) + 1,
      maxAttempts: 3,
      startedAt: now,
      completedAt: t.status === "succeeded" || t.status === "failed" ? now : undefined,
      inputAssets: [],
      outputAssets: [],
      error: t.lastError
        ? {
            code: "generation_failed" as const,
            message: t.lastError,
            retryable: true,
          }
        : undefined,
    }));

    const assets = [];
    for (const scene of bridge.spec.scenes) {
      for (const shot of scene.shots) {
        if (shot.keyframeUrl) {
          assets.push({
            id: `asset_kf_${shot.id}`,
            productionId: bridge.production.id,
            sceneId: scene.id,
            shotId: shot.id,
            assetType: "image" as const,
            publicUrl: shot.keyframeUrl,
            status: "completed" as const,
            createdAt: now,
          });
        }
        if (shot.mediaUrl) {
          assets.push({
            id: `asset_vid_${shot.id}`,
            productionId: bridge.production.id,
            sceneId: scene.id,
            shotId: shot.id,
            assetType: "video" as const,
            publicUrl: shot.mediaUrl,
            status: "completed" as const,
            createdAt: now,
          });
        }
      }
    }
    if (bridge.assetResult.videoUrl) {
      assets.push({
        id: `asset_master_${bridge.production.id}`,
        productionId: bridge.production.id,
        assetType: "video" as const,
        publicUrl: bridge.assetResult.videoUrl,
        status: "completed" as const,
        createdAt: now,
        role: "master",
      });
    }
    if (bridge.assetResult.audioUrl) {
      assets.push({
        id: `asset_audio_${bridge.production.id}`,
        productionId: bridge.production.id,
        assetType: "audio" as const,
        publicUrl: bridge.assetResult.audioUrl,
        status: "completed" as const,
        createdAt: now,
      });
    }

    return {
      ok,
      state: ok ? "completed" : "failed",
      productionState: ok ? "completed" : "failed",
      spec: bridge.spec,
      tasks: bridge.tasks,
      executions,
      assets,
      dag,
      errors: ok
        ? []
        : [
            bridge.production.lastError ||
              bridge.assetResult.brief.lastError ||
              "AssetService bridge generation failed",
          ],
    };
  };

  return {
    executeProduction: executeViaBridge,
    getLastBridgeResult: () => lastBridgeResult,
  };
}
