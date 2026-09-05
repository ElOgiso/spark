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

/** Why a task depends on another — inspectable for scheduling and UI. */
export type DependencyReason =
  | "REFERENCE"
  | "CONTINUITY"
  | "SEQUENTIAL"
  | "ASSET"
  | "TEMPORAL"
  | "CAPABILITY"
  | "PROVIDER"
  | "RESOURCE"
  | "VALIDATION"
  | "EDITORIAL";

export type DependencyStrength = "hard" | "soft";

export interface TaskDependency {
  taskId: string;
  reason: DependencyReason;
  strength: DependencyStrength;
  /** Optional requirement on the upstream result (e.g. approved output). */
  requirement?: "completed" | "approved_output";
  detail?: string;
}

export type TaskPriority = "CRITICAL" | "HIGH" | "NORMAL" | "LOW";

export type TaskFailureKind =
  | "TRANSIENT"
  | "PERMANENT"
  | "VALIDATION"
  | "PROVIDER"
  | "CAPABILITY"
  | "DEPENDENCY"
  | "CANCELLATION";

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
  /**
   * Hard dependency task ids (backward-compatible).
   * Prefer `dependencies` for typed reasons; `dependsOn` stays the hard-edge projection.
   */
  dependsOn: string[];
  /** Typed dependency edges (hard + soft). */
  dependencies?: TaskDependency[];
  /** Scheduling priority — explicit policy, not magic numbers. */
  priority?: TaskPriority;
  status: GenerationTaskStatus;
  retryCount?: number;
  maxRetries?: number;
  lastError?: string;
  failureKind?: TaskFailureKind;
  /** When true, downstream CONTINUITY/VALIDATION edges wait for explicit approval. */
  requiresApproval?: boolean;
  /** Previs vs final — consumed by scheduler policies; does not pick providers. */
  executionMode?: "previs" | "final";
}

/** Project hard dependencies into `dependsOn` (deterministic, de-duplicated, stable order). */
export function syncDependsOn(task: GenerationTask): GenerationTask {
  const fromTyped = (task.dependencies || [])
    .filter((d) => d.strength === "hard")
    .map((d) => d.taskId);
  const merged = Array.from(new Set([...(task.dependsOn || []), ...fromTyped]));
  merged.sort();
  return { ...task, dependsOn: merged };
}

export function hardDependencyIds(task: GenerationTask): string[] {
  if (task.dependencies?.length) {
    return Array.from(
      new Set(task.dependencies.filter((d) => d.strength === "hard").map((d) => d.taskId))
    ).sort();
  }
  return [...(task.dependsOn || [])].sort();
}

export function softDependencyIds(task: GenerationTask): string[] {
  return Array.from(
    new Set((task.dependencies || []).filter((d) => d.strength === "soft").map((d) => d.taskId))
  ).sort();
}

export function validateGenerationTask(task: GenerationTask): string[] {
  const errors: string[] = [];
  if (!task.id) errors.push("generationTask.id required");
  if (!task.productionId) errors.push("generationTask.productionId required");
  if (!task.kind) errors.push("generationTask.kind required");
  if (!task.strategy?.modality) errors.push("generationTask.strategy.modality required");
  if (!Array.isArray(task.dependsOn)) errors.push("generationTask.dependsOn must be an array");
  if (task.dependencies) {
    for (const d of task.dependencies) {
      if (!d.taskId) errors.push(`${task.id}: dependency missing taskId`);
      if (d.taskId === task.id) errors.push(`${task.id}: self-dependency`);
      if (d.strength !== "hard" && d.strength !== "soft") {
        errors.push(`${task.id}: invalid dependency strength`);
      }
    }
  }
  return errors;
}
