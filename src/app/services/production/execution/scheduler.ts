/**
 * Controlled concurrency scheduler for GenerationTask DAGs.
 * Independent ready tasks may run in parallel up to maxConcurrency.
 * Does NOT fire Promise.all over the entire production.
 */

import type { GenerationTask } from "../specification/generationTask";
import type { ProductionDag } from "../dag/productionDag";
import { readyNodes } from "../dag/productionDag";

export interface SchedulerConfig {
  maxConcurrency: number;
  /** Optional per-provider concurrency caps */
  perProviderLimit?: Record<string, number>;
}

export const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  maxConcurrency: 3,
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

/**
 * Select next batch of executable tasks from DAG + task list.
 * Honors dependency readiness and concurrency limits.
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

  // Dependency-ready: all dependsOn succeeded (not merely "not running")
  const candidates = params.tasks.filter((t) => {
    if (params.cancelledTaskIds?.has(t.id)) return false;
    if (params.runningTaskIds.has(t.id)) return false;
    if (t.status === "succeeded" || t.status === "failed" || t.status === "skipped") return false;
    if (t.status === "running") return false;
    // blocked/planned/queued ok if deps met
    if (t.dependsOn.some((d) => failed.has(d))) return false;
    if (!t.dependsOn.every((d) => succeeded.has(d))) return false;
    return true;
  });

  // Prefer DAG readyNodes intersection when statuses align
  const dagReady = new Set(readyNodes(params.dag).map((n) => n.id));
  candidates.sort((a, b) => {
    const ar = dagReady.has(a.id) ? 0 : 1;
    const br = dagReady.has(b.id) ? 0 : 1;
    if (ar !== br) return ar - br;
    // keyframes before videos before merge
    const rank = (k: string) => (k === "keyframe" ? 0 : k === "voice" ? 1 : k === "video" ? 2 : 3);
    return rank(a.kind) - rank(b.kind);
  });

  const selected: string[] = [];
  const providerCounts = new Map<string, number>();
  const slots = Math.max(1, config.maxConcurrency - params.runningTaskIds.size);

  for (const task of candidates) {
    if (selected.length >= slots) break;
    const provider = (task.selectedProvider || "unknown").toLowerCase();
    const used = providerCounts.get(provider) || 0;
    // Count running of same provider
    let runningSame = 0;
    for (const id of params.runningTaskIds) {
      const t = taskById.get(id);
      if ((t?.selectedProvider || "").toLowerCase() === provider) runningSame++;
    }
    const limit = config.perProviderLimit?.[provider] ?? config.maxConcurrency;
    if (used + runningSame >= limit) continue;
    selected.push(task.id);
    providerCounts.set(provider, used + 1);
  }

  return { taskIds: selected };
}

export function allTasksTerminal(tasks: GenerationTask[]): boolean {
  return tasks.every((t) =>
    t.status === "succeeded" || t.status === "failed" || t.status === "skipped"
  );
}

export function deriveProductionState(tasks: GenerationTask[]):
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
