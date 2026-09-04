/**
 * Generation task — unit of executable work under a Shot (or production-level audio/merge).
 * Provider selection is deferred; this is the data contract only.
 */

import type { GenerationStrategySpec } from "./generationStrategy";

export type GenerationTaskKind =
  | "keyframe"
  | "video"
  | "voice"
  | "sfx"
  | "music"
  | "merge"
  | "edit"
  | "extend";

export type GenerationTaskStatus =
  | "planned"
  | "queued"
  | "blocked"
  | "running"
  | "succeeded"
  | "failed"
  | "skipped";

export interface GenerationTask {
  id: string;
  kind: GenerationTaskKind;
  productionId: string;
  sceneId?: string;
  shotId?: string;
  /** Optional link to existing persisted ProductionAsset row */
  productionAssetId?: string;
  strategy: GenerationStrategySpec;
  /** Provider-independent requirement labels */
  requiredCapabilities: string[];
  preferredCapabilities?: string[];
  qualityTarget?: string;
  speedPriority?: boolean;
  costPriority?: boolean;
  /** Filled by later routing phase — optional now */
  selectedProvider?: string;
  selectedModel?: string;
  fallbackProviders?: string[];
  dependsOn: string[];
  status: GenerationTaskStatus;
  retryCount?: number;
  maxRetries?: number;
  lastError?: string;
}

export function validateGenerationTask(task: GenerationTask): string[] {
  const errors: string[] = [];
  if (!task.id) errors.push("generationTask.id required");
  if (!task.productionId) errors.push("generationTask.productionId required");
  if (!task.kind) errors.push("generationTask.kind required");
  if (!task.strategy?.modality) errors.push("generationTask.strategy.modality required");
  if (!Array.isArray(task.dependsOn)) errors.push("generationTask.dependsOn must be an array");
  return errors;
}
