/**
 * Phase 2 — Production Execution Bridge
 *
 * Planning authority: ProductionSpec → SceneSpec → ShotSpec → GenerationTask
 * Execution machinery: existing ProductionAssetService (ModelRouter + providers)
 *
 * Does NOT invent a second orchestrator, provider router, QC system, or Review UI.
 */

import type {
  Brand,
  Character,
  GenerationProgress,
  MemoryItem,
  Production,
  ProductionBrief,
  ProductionScene,
} from "../../../domain/types";
import type { ProductionSpec } from "../specification/productionSpec";
import type { ShotSpec } from "../specification/shotSpec";
import type { GenerationTask } from "../specification/generationTask";
import {
  legacyProductionToSpec,
  productionSpecToBrief,
  sceneSpecToProductionScene,
} from "../specification/adapters";
import {
  attachGenerationTasksToSpec,
  planGenerationTasks,
} from "../generation/generationPlanner";
import {
  ProductionAssetService,
  type ProductionAssetGenerationResult,
} from "../productionAssetService";

export interface BridgeLogEvent {
  at: string;
  productionId: string;
  sceneId?: string;
  shotId?: string;
  taskId?: string;
  provider?: string;
  model?: string;
  attempt?: number;
  status: string;
  error?: string;
}

export type BridgeLogger = (event: BridgeLogEvent) => void;

export interface ProductionExecutionBridgeParams {
  production: Production;
  brand: Brand;
  character?: Character;
  characters?: Character[];
  memoryItems?: MemoryItem[];
  creditSettings?: import("../../../domain/types").GenerationCreditSettings;
  onProgress?: (progress: GenerationProgress) => void;
  forceRegenerate?: boolean;
  signal?: AbortSignal;
  logger?: BridgeLogger;
}

export interface ProductionExecutionBridgeResult {
  production: Production;
  brief: ProductionBrief;
  spec: ProductionSpec;
  tasks: GenerationTask[];
  assetResult: ProductionAssetGenerationResult;
  usedSpecBridge: true;
}

function defaultLogger(event: BridgeLogEvent): void {
  const parts = [
    "[ProductionExecutionBridge]",
    `production=${event.productionId}`,
    event.sceneId ? `scene=${event.sceneId}` : null,
    event.shotId ? `shot=${event.shotId}` : null,
    event.taskId ? `task=${event.taskId}` : null,
    `status=${event.status}`,
    event.error ? `error=${event.error}` : null,
  ].filter(Boolean);
  console.log(parts.join(" "));
}

export function resolveProductionSpec(
  production: Production,
  brand?: Brand,
  character?: Character
): ProductionSpec {
  const reasoning =
    typeof production.reasoning === "object" && production.reasoning
      ? (production.reasoning as Record<string, unknown>)
      : {};
  const existing = reasoning.productionSpec as ProductionSpec | undefined;
  if (existing && Array.isArray(existing.scenes) && existing.scenes.length > 0) {
    return existing;
  }
  return legacyProductionToSpec({ production, brand, character });
}

/** One storyboard panel per ShotSpec — stable shot identity into AssetService. */
export function buildSpecLinkedStoryboard(spec: ProductionSpec): ProductionScene[] {
  const panels: ProductionScene[] = [];
  for (const scene of spec.scenes) {
    const shots = scene.shots?.length ? scene.shots : [];
    if (shots.length === 0) {
      const base = sceneSpecToProductionScene(scene);
      panels.push({
        ...base,
        id: scene.id,
        sceneId: scene.id,
      });
      continue;
    }
    for (const shot of shots) {
      const base = sceneSpecToProductionScene({ ...scene, shots: [shot] });
      panels.push({
        ...base,
        id: shot.id,
        sceneId: scene.id,
        shotId: shot.id,
        duration: `${shot.durationSec || scene.durationSec || 5}s`,
        durationSec: shot.durationSec || scene.durationSec || 5,
        shotList: shot.camera?.shotType || base.shotList,
        cameraDirection: [
          shot.camera?.shotType,
          shot.camera?.cameraMovement,
          shot.camera?.framing,
        ]
          .filter(Boolean)
          .join(" / "),
        visualDescription:
          shot.environment ||
          shot.subjectAction ||
          base.visualDescription ||
          scene.visualDescription ||
          scene.environment ||
          "",
        startState: shot.motion?.beginState || base.startState,
        endState: shot.motion?.endState || base.endState,
        primaryChange: shot.subjectAction || base.primaryChange,
        action: shot.subjectAction || base.action,
        spokenLines: shot.narration || shot.dialogue || base.spokenLines,
        scriptSnippet: shot.narration || shot.dialogue || base.scriptSnippet,
        image: shot.keyframeUrl || base.image,
        keyframeImageUrl: shot.keyframeUrl || base.keyframeImageUrl,
        videoUrl: shot.mediaUrl || base.videoUrl,
        lastFrameUrl: shot.lastFrameUrl || base.lastFrameUrl,
      });
    }
  }
  return panels;
}

export function buildSpecDrivenBrief(
  spec: ProductionSpec,
  existing?: ProductionBrief
): ProductionBrief {
  const fromSpec = productionSpecToBrief(spec, existing);
  return {
    ...fromSpec,
    storyboardGridUrl: existing?.storyboardGridUrl || fromSpec.storyboardGridUrl,
    takeGrids: existing?.takeGrids || fromSpec.takeGrids,
    audioUrl: existing?.audioUrl || fromSpec.audioUrl,
    videoUrl: existing?.videoUrl || fromSpec.videoUrl,
    thumbnailUrl: existing?.thumbnailUrl || fromSpec.thumbnailUrl,
    generationProgress: existing?.generationProgress || fromSpec.generationProgress,
    storyboard: buildSpecLinkedStoryboard(spec),
  };
}

export function collectSpecShots(spec: ProductionSpec): ShotSpec[] {
  return spec.scenes.flatMap((scene) => scene.shots || []);
}

export function ensureGenerationTasks(spec: ProductionSpec): {
  spec: ProductionSpec;
  tasks: GenerationTask[];
} {
  const shotIds = new Set(
    spec.scenes.flatMap((s) => (s.shots || []).map((sh) => sh.id))
  );
  const attached = spec.scenes.flatMap((s) =>
    (s.shots || []).flatMap((sh) => sh.generationTasks || [])
  );
  // Ignore stale attached tasks that reference shot ids no longer present on the Spec
  const attachedValid = attached.filter((t) => !t.shotId || shotIds.has(t.shotId));
  const planned = planGenerationTasks(spec);
  const tasks = attachedValid.length >= 2 ? attachedValid : planned;
  const nextSpec = attachGenerationTasksToSpec(spec, tasks);
  // Re-plan against the attached spec so production-level voice/merge tasks remain present
  // without reintroducing orphaned pre-rename shot tasks.
  const refreshed = planGenerationTasks(nextSpec);
  const byId = new Map<string, GenerationTask>();
  for (const t of refreshed) byId.set(t.id, t);
  for (const t of tasks) {
    if (!t.shotId || shotIds.has(t.shotId)) byId.set(t.id, t);
  }
  return { spec: nextSpec, tasks: Array.from(byId.values()) };
}

/** Retries keep the same ShotSpec.id — only attempt metadata changes. */
export function markShotRetry(spec: ProductionSpec, shotId: string, reason: string): ProductionSpec {
  return {
    ...spec,
    scenes: spec.scenes.map((scene) => ({
      ...scene,
      shots: scene.shots.map((shot) => {
        if (shot.id !== shotId) return shot;
        const attempt = (shot.retry?.attempt || 0) + 1;
        return {
          ...shot,
          id: shotId,
          generationStatus: "queued" as ShotSpec["generationStatus"],
          retry: {
            attempt,
            maxAttempts: shot.retry?.maxAttempts ?? 2,
            lastFailureReasons: [reason],
            remediation: shot.retry?.remediation,
            providerChanged: shot.retry?.providerChanged,
          },
        };
      }),
    })),
  };
}

/** If a dependency failed or is blocked, dependents become blocked — never silent success. */
export function applyTaskDependencyFailures(tasks: GenerationTask[]): GenerationTask[] {
  const byId = new Map(tasks.map((t) => [t.id, { ...t }]));
  let changed = true;
  while (changed) {
    changed = false;
    for (const task of byId.values()) {
      if (task.status === "succeeded" || task.status === "skipped" || task.status === "failed") {
        continue;
      }
      const deps = task.dependsOn || [];
      const blockingDep = deps.find((id) => {
        const status = byId.get(id)?.status;
        return status === "failed" || status === "blocked";
      });
      if (blockingDep && task.status !== "blocked") {
        const depStatus = byId.get(blockingDep)?.status;
        task.status = "blocked";
        task.lastError =
          depStatus === "blocked"
            ? `Blocked by blocked dependency: ${blockingDep}`
            : `Blocked by failed dependency: ${blockingDep}`;
        changed = true;
      }
    }
  }
  return Array.from(byId.values());
}

function panelByShotId(panels: ProductionScene[] | undefined): Map<string, ProductionScene> {
  const map = new Map<string, ProductionScene>();
  for (const panel of panels || []) {
    const shotId = panel.shotId || panel.id;
    if (shotId) map.set(shotId, panel);
  }
  return map;
}

export function projectAssetsOntoSpec(params: {
  spec: ProductionSpec;
  tasks: GenerationTask[];
  assetResult: ProductionAssetGenerationResult;
  productionId: string;
  logger: BridgeLogger;
}): { spec: ProductionSpec; tasks: GenerationTask[] } {
  const { assetResult, productionId, logger } = params;
  let tasks = params.tasks.map((t) => ({ ...t }));
  const panels = panelByShotId(assetResult.productionScenes || assetResult.brief.storyboard);
  const masterOk = Boolean(assetResult.videoUrl);

  const nextScenes = params.spec.scenes.map((scene) => ({
    ...scene,
    shots: scene.shots.map((shot) => {
      const panel = panels.get(shot.id);
      const imageUrl = panel?.image || panel?.keyframeImageUrl || shot.keyframeUrl;
      const videoUrl = panel?.videoUrl || panel?.mediaUrl || shot.mediaUrl;
      const lastFrameUrl = panel?.lastFrameUrl || shot.lastFrameUrl;
      const shotFailed = Boolean(panel?.lastError);

      const keyframeTask = tasks.find((t) => t.shotId === shot.id && t.kind === "keyframe");
      const videoTask = tasks.find((t) => t.shotId === shot.id && t.kind === "video");

      if (keyframeTask) {
        if (imageUrl) {
          keyframeTask.status = "succeeded";
          keyframeTask.lastError = undefined;
        } else if (shotFailed || (!imageUrl && !masterOk)) {
          keyframeTask.status = "failed";
          keyframeTask.lastError = panel?.lastError || "Keyframe generation produced no image";
        }
        logger({
          at: new Date().toISOString(),
          productionId,
          sceneId: scene.id,
          shotId: shot.id,
          taskId: keyframeTask.id,
          status: keyframeTask.status,
          error: keyframeTask.lastError,
        });
      }

      if (videoTask) {
        if (videoUrl || (imageUrl && masterOk)) {
          videoTask.status = "succeeded";
          videoTask.lastError = undefined;
        } else if (shotFailed) {
          videoTask.status = "failed";
          videoTask.lastError = panel?.lastError || "Video generation produced no mediaUrl";
        }
        logger({
          at: new Date().toISOString(),
          productionId,
          sceneId: scene.id,
          shotId: shot.id,
          taskId: videoTask.id,
          status: videoTask.status,
          error: videoTask.lastError,
        });
      }

      return {
        ...shot,
        id: shot.id,
        sceneId: shot.sceneId || scene.id,
        keyframeUrl: imageUrl || shot.keyframeUrl,
        mediaUrl: videoUrl || shot.mediaUrl,
        lastFrameUrl: lastFrameUrl || shot.lastFrameUrl,
        generationStatus: shotFailed
          ? ("failed" as const)
          : imageUrl || videoUrl || masterOk
            ? ("generated" as const)
            : shot.generationStatus,
        generationTasks: (shot.generationTasks || []).map(
          (t) => tasks.find((x) => x.id === t.id) || t
        ),
      };
    }),
  }));

  for (const task of tasks) {
    if (task.kind === "voice") {
      if (assetResult.audioUrl) {
        task.status = "succeeded";
        task.lastError = undefined;
      } else if (masterOk) {
        task.status = "skipped";
      } else {
        task.status = "failed";
        task.lastError = task.lastError || "Voice asset missing";
      }
    }
    if (task.kind === "merge") {
      task.status = masterOk ? "succeeded" : "failed";
      if (!masterOk) task.lastError = task.lastError || "Master video missing";
    }
  }

  tasks = applyTaskDependencyFailures(tasks);

  return {
    spec: {
      ...params.spec,
      scenes: nextScenes,
      project: {
        ...params.spec.project,
        status: masterOk ? "generating" : "failed",
        updatedAt: new Date().toISOString(),
      },
    },
    tasks,
  };
}

export function isSpecLinkedStoryboard(storyboard?: ProductionScene[] | null): boolean {
  if (!Array.isArray(storyboard) || storyboard.length === 0) return false;
  return storyboard.every((s) => typeof s.shotId === "string" && s.shotId.length > 0);
}

/**
 * Live generate spine: ProductionSpec → GenerationTask → ProductionAssetService → Review fields.
 */
export async function executeProductionViaAssetBridge(
  params: ProductionExecutionBridgeParams
): Promise<ProductionExecutionBridgeResult> {
  const logger = params.logger || defaultLogger;
  const productionId = params.production.id;

  let spec = resolveProductionSpec(params.production, params.brand, params.character);
  const ensured = ensureGenerationTasks(spec);
  spec = ensured.spec;
  let tasks: GenerationTask[] = ensured.tasks.map((t) => ({
    ...t,
    status: (t.status === "blocked" ? "blocked" : "queued") as GenerationTask["status"],
  }));

  logger({
    at: new Date().toISOString(),
    productionId,
    status: "bridge_start",
  });

  const brief = buildSpecDrivenBrief(spec, params.production.brief);
  if (!brief.storyboard?.length) {
    throw new Error("ProductionSpec produced an empty storyboard — cannot generate assets");
  }

  tasks = tasks.map((t) =>
    t.kind === "keyframe" || t.kind === "voice" || t.kind === "video" || t.kind === "merge"
      ? {
          ...t,
          status: (t.status === "blocked" ? "blocked" : "running") as GenerationTask["status"],
        }
      : t
  );

  for (const t of tasks) {
    logger({
      at: new Date().toISOString(),
      productionId,
      sceneId: t.sceneId,
      shotId: t.shotId,
      taskId: t.id,
      provider: t.selectedProvider,
      model: t.selectedModel,
      attempt: (t.retryCount || 0) + 1,
      status: t.status,
    });
  }

  const assetResult = await ProductionAssetService.generateAssets({
    production: {
      ...params.production,
      brief,
      reasoning: {
        ...(typeof params.production.reasoning === "object" && params.production.reasoning
          ? params.production.reasoning
          : {}),
        productionSpec: spec,
      },
    },
    brief,
    brand: params.brand,
    character: params.character,
    characters: params.characters,
    memoryItems: params.memoryItems,
    creditSettings: params.creditSettings,
    onProgress: params.onProgress,
    forceRegenerate: params.forceRegenerate,
    signal: params.signal,
  });

  const projected = projectAssetsOntoSpec({
    spec,
    tasks,
    assetResult,
    productionId,
    logger,
  });
  spec = projected.spec;
  tasks = projected.tasks;

  const anyTaskFailed = tasks.some((t) => t.status === "failed");
  const masterOk = Boolean(assetResult.videoUrl);
  const finalStatus = masterOk && !anyTaskFailed ? "Ready for Review" : "Failed";

  const updatedProduction: Production = {
    ...params.production,
    status: finalStatus,
    brief: assetResult.brief,
    scenes: assetResult.scenes,
    productionScenes: assetResult.productionScenes || assetResult.brief.storyboard,
    audioUrl: assetResult.audioUrl,
    videoUrl: assetResult.videoUrl,
    isGeneratingAssets: false,
    generationProgress: assetResult.brief.generationProgress,
    targetDurationSec:
      assetResult.brief.targetDurationSec ||
      params.production.targetDurationSec ||
      spec.project.targetDurationSec,
    productionMode:
      assetResult.brief.productionMode ||
      params.production.productionMode ||
      params.production.mode ||
      String(spec.project.productionMode || "standard"),
    formatSettings: assetResult.brief.formatSettings || params.production.formatSettings,
    lastError: masterOk
      ? undefined
      : assetResult.brief.lastError || "Master video missing after Spec-driven generation",
    reasoning: {
      ...(typeof params.production.reasoning === "object" && params.production.reasoning
        ? params.production.reasoning
        : {}),
      productionSpec: spec,
      generationSpine: {
        bridge: "productionExecutionBridge",
        usedSpecBridge: true,
        taskStatuses: tasks.map((t) => ({
          id: t.id,
          kind: t.kind,
          shotId: t.shotId,
          sceneId: t.sceneId,
          status: t.status,
          lastError: t.lastError,
        })),
        shotCount: collectSpecShots(spec).length,
        masterVideo: Boolean(assetResult.videoUrl),
      },
    },
  };

  logger({
    at: new Date().toISOString(),
    productionId,
    status: masterOk ? "bridge_complete" : "bridge_failed",
    error: masterOk ? undefined : updatedProduction.lastError,
  });

  return {
    production: updatedProduction,
    brief: assetResult.brief,
    spec,
    tasks,
    assetResult,
    usedSpecBridge: true,
  };
}
