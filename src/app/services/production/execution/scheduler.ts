/**
 * Controlled concurrency scheduler for GenerationTask DAGs.
 * Independent ready tasks may run in parallel up to maxConcurrency.
 * Does NOT fire Promise.all over the entire production.
 *
 * Provider selection stays in the routing layer — this module only consumes
 * selectedProvider for optional concurrency caps, never chooses a provider.
 */

import type { GenerationTask, TaskPriority } from "../specification/generationTask";
import type { ProductionDag } from "../dag/productionDag";
import { readyNodes } from "../dag/productionDag";

export interface SchedulerConfig {
  maxConcurrency: number;
  /** Optional per-provider concurrency caps (consumed, not invented per call). */
  perProviderLimit?: Record<string, number>;
  /** Modality-aware caps — preferred over provider-specific tuning. */
  maxConcurrentVideoTasks?: number;
  maxConcurrentImageTasks?: number;
  maxConcurrentAudioTasks?: number;
}

export const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  maxConcurrency: 3,
  maxConcurrentVideoTasks: 2,
  maxConcurrentImageTasks: 3,
  maxConcurrentAudioTasks: 2,
  // Legacy per-provider caps retained for compatibility; modality caps preferred.
  perProviderLimit: {
    kling: 2,
    seedance: 2,
    grok: 2,
    openai: 3,
    elevenlabs: 2,
    mux: 1,
  },
};

export interface ScheduledBatch {
  taskIds: string[];
}

function priorityRank(p: TaskPriority | undefined): number {
  switch (p) {
    case "CRITICAL":
      return 0;
    case "HIGH":
      return 1;
    case "LOW":
      return 3;
    default:
      return 2;
  }
}

function modalityOf(task: GenerationTask): "video" | "image" | "audio" | "other" {
  if (task.kind === "video" || task.kind === "extend") return "video";
  if (task.kind === "keyframe") return "image";
  if (task.kind === "voice" || task.kind === "sfx" || task.kind === "music") return "audio";
  return "other";
}

/**
 * Select next batch of executable tasks from DAG + task list.
 * Honors hard-dependency readiness, priority, and concurrency limits.
 * Soft dependencies never block eligibility (they are excluded from dependsOn).
 */
export function selectReadyBatch(params: {
  dag: ProductionDag;
  tasks: GenerationTask[];
  runningTaskIds: Set<string>;
  cancelledTaskIds?: Set<string>;
  config?: SchedulerConfig;
}): ScheduledBatch {
  const config = params.config || DEFAULT_SCHEDULER_CONFIG;
  const taskById = new Map(params.tasks.map((t) => [t.id, t]));
  const succeeded = new Set(
    params.tasks.filter((t) => t.status === "succeeded" || t.status === "skipped").map((t) => t.id)
  );
  const failed = new Set(params.tasks.filter((t) => t.status === "failed").map((t) => t.id));

  const candidates = params.tasks.filter((t) => {
    if (params.cancelledTaskIds?.has(t.id)) return false;
    if (params.runningTaskIds.has(t.id)) return false;
    if (t.status === "succeeded" || t.status === "failed" || t.status === "skipped") return false;
    if (t.status === "running") return false;
    const dagNode = params.dag?.nodes?.find((n) => n.id === t.id);
    const effectiveDeps = dagNode ? dagNode.dependsOn : t.dependsOn;
    if (effectiveDeps.some((d) => failed.has(d))) return false;
    if (
      !effectiveDeps.every((d) => {
        if (succeeded.has(d)) return true;
        if (!taskById.has(d)) {
          const dagDep = params.dag?.nodes?.find((n) => n.id === d);
          return !dagDep || dagDep.status === "done" || dagDep.status === "ready";
        }
        return false;
      })
    ) {
      return false;
    }
    return true;
  });

  const dagReady = new Set(readyNodes(params.dag).map((n) => n.id));
  candidates.sort((a, b) => {
    const pr = priorityRank(a.priority) - priorityRank(b.priority);
    if (pr !== 0) return pr;
    const ar = dagReady.has(a.id) ? 0 : 1;
    const br = dagReady.has(b.id) ? 0 : 1;
    if (ar !== br) return ar - br;
    const rank = (k: string) => (k === "keyframe" ? 0 : k === "voice" ? 1 : k === "video" ? 2 : 3);
    const kr = rank(a.kind) - rank(b.kind);
    if (kr !== 0) return kr;
    return a.id.localeCompare(b.id);
  });

  const selected: string[] = [];
  const providerCounts = new Map<string, number>();
  const modalityCounts = { video: 0, image: 0, audio: 0, other: 0 };
  for (const id of params.runningTaskIds) {
    const t = taskById.get(id);
    if (t) modalityCounts[modalityOf(t)]++;
  }

  const slots = Math.max(0, config.maxConcurrency - params.runningTaskIds.size);
  if (slots <= 0) return { taskIds: [] };

  for (const task of candidates) {
    if (selected.length >= slots) break;

    const modality = modalityOf(task);
    if (modality === "video" && config.maxConcurrentVideoTasks != null) {
      if (modalityCounts.video >= config.maxConcurrentVideoTasks) continue;
    }
    if (modality === "image" && config.maxConcurrentImageTasks != null) {
      if (modalityCounts.image >= config.maxConcurrentImageTasks) continue;
    }
    if (modality === "audio" && config.maxConcurrentAudioTasks != null) {
      if (modalityCounts.audio >= config.maxConcurrentAudioTasks) continue;
    }

    const provider = (task.selectedProvider || "unknown").toLowerCase();
    const used = providerCounts.get(provider) || 0;
    let runningSame = 0;
    for (const id of params.runningTaskIds) {
      const t = taskById.get(id);
      if ((t?.selectedProvider || "").toLowerCase() === provider) runningSame++;
    }
    const limit = config.perProviderLimit?.[provider] ?? config.maxConcurrency;
    if (used + runningSame >= limit) continue;

    selected.push(task.id);
    providerCounts.set(provider, used + 1);
    modalityCounts[modality]++;
  }

  return { taskIds: selected };
}

export function allTasksTerminal(tasks: GenerationTask[]): boolean {
  return tasks.every(
    (t) => t.status === "succeeded" || t.status === "failed" || t.status === "skipped"
  );
}

export function deriveProductionState(
  tasks: GenerationTask[]
):
  | "planned"
  | "queued"
  | "running"
  | "partially_complete"
  | "completed"
  | "failed"
  | "cancelled" {
  if (!tasks.length) return "planned";
  const statuses = tasks.map((t) => t.status);
  if (statuses.every((s) => s === "planned" || s === "blocked")) return "planned";
  if (statuses.some((s) => s === "running" || s === "queued")) {
    if (statuses.some((s) => s === "succeeded")) return "running";
    return statuses.some((s) => s === "queued") && !statuses.some((s) => s === "running")
      ? "queued"
      : "running";
  }
  const succeeded = statuses.filter((s) => s === "succeeded" || s === "skipped").length;
  const failed = statuses.filter((s) => s === "failed").length;
  if (failed === 0 && succeeded === tasks.length) return "completed";
  if (succeeded > 0 && failed > 0) return "partially_complete";
  if (failed === tasks.length) return "failed";
  if (succeeded > 0) return "partially_complete";
  return "failed";
}
