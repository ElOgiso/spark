/**
 * Production execution DAG — single dependency-aware execution planner.
 * Parallelize independent work; serialize only when edges require it.
 * Extends (does not replace) the GenerationTask contract.
 */

import type {
  DependencyReason,
  DependencyStrength,
  GenerationTask,
  TaskDependency,
  TaskFailureKind,
  TaskPriority,
} from "../specification/generationTask";
import { hardDependencyIds, softDependencyIds, syncDependsOn } from "../specification/generationTask";
import { planGenerationTasks } from "../generation/generationPlanner";
import type { ProductionSpec } from "../specification/productionSpec";

export type DagNodeStatus =
  | "pending"
  | "ready"
  | "running"
  | "done"
  | "failed"
  | "skipped"
  | "cancelled"
  | "blocked"
  | "retry_pending";

export interface DagDependency {
  taskId: string;
  reason: DependencyReason;
  strength: DependencyStrength;
  requirement?: "completed" | "approved_output";
  detail?: string;
}

export interface DagNode {
  id: string;
  kind: string;
  /** Hard dependency ids (compat + fast path). */
  dependsOn: string[];
  /** Typed edges including soft deps. */
  dependencies: DagDependency[];
  status: DagNodeStatus;
  shotId?: string;
  sceneId?: string;
  provider?: string;
  error?: string;
  failureKind?: TaskFailureKind;
  priority: TaskPriority;
  /** Downstream CONTINUITY/VALIDATION may require this. */
  approved?: boolean;
  attempt?: number;
  startedAt?: string;
  completedAt?: string;
  /** Soft ownership for future durable workers — not a distributed lock. */
  leaseOwner?: string;
  leaseExpiresAt?: string;
}

export interface ProductionDag {
  productionId: string;
  nodes: DagNode[];
  /** Reverse index: dependencyId → dependent node ids (for O(neighbors) updates). */
  dependentsIndex: Record<string, string[]>;
  version: number;
}

export interface DagValidationIssue {
  code:
    | "duplicate_id"
    | "missing_dependency"
    | "self_dependency"
    | "cycle"
    | "invalid_status"
    | "orphan_dependency_edge";
  message: string;
  nodeId?: string;
  relatedIds?: string[];
}

export interface DagValidationResult {
  ok: boolean;
  issues: DagValidationIssue[];
}

export interface BlockedExplanation {
  nodeId: string;
  status: DagNodeStatus;
  waitingOn: Array<{
    taskId: string;
    reason: DependencyReason;
    strength: DependencyStrength;
    requirement?: string;
    currentStatus?: DagNodeStatus;
    approved?: boolean;
  }>;
  summary: string;
}

export interface ExecutionWave {
  index: number;
  taskIds: string[];
}

export interface CriticalPathResult {
  path: string[];
  length: number;
  criticalTaskIds: string[];
}

export interface FailurePropagationResult {
  dag: ProductionDag;
  blockedIds: string[];
  invalidatedIds: string[];
  independentIds: string[];
}

export interface RetryPlan {
  retryRootIds: string[];
  resetIds: string[];
  preservedIds: string[];
}

export interface ExecutionCheckpoint {
  productionId: string;
  version: number;
  createdAt: string;
  boundary:
    | "planning_complete"
    | "references_resolved"
    | "previsualization_complete"
    | "generation_wave_complete"
    | "scene_complete"
    | "production_complete"
    | "manual";
  nodeSnapshots: Array<{
    id: string;
    status: DagNodeStatus;
    approved?: boolean;
    attempt?: number;
    error?: string;
    failureKind?: TaskFailureKind;
    resultAssetId?: string;
  }>;
  completedWaveIndex?: number;
}

export type SoftDependencyPolicy = "wait" | "allow_with_fallback";

const TERMINAL_OK: ReadonlySet<DagNodeStatus> = new Set(["done", "skipped"]);
const TERMINAL_ALL: ReadonlySet<DagNodeStatus> = new Set([
  "done",
  "failed",
  "skipped",
  "cancelled",
]);

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

function defaultPriority(task: GenerationTask, fanOut: number): TaskPriority {
  if (task.priority) return task.priority;
  if (task.kind === "merge") return "HIGH";
  if (fanOut >= 3) return "HIGH";
  if (task.kind === "keyframe" && task.id.includes("_reference")) return "CRITICAL";
  if (task.speedPriority) return "HIGH";
  if (task.costPriority) return "LOW";
  return "NORMAL";
}

function edgesFromTask(task: GenerationTask): DagDependency[] {
  if (task.dependencies?.length) {
    return task.dependencies.map((d) => ({
      taskId: d.taskId,
      reason: d.reason,
      strength: d.strength,
      requirement: d.requirement,
      detail: d.detail,
    }));
  }
  return (task.dependsOn || []).map((taskId) => ({
    taskId,
    reason: inferReason(task, taskId),
    strength: "hard" as const,
    requirement: "completed" as const,
  }));
}

function inferReason(task: GenerationTask, depId: string): DependencyReason {
  if (depId.includes("_reference")) return "REFERENCE";
  if (depId.endsWith("_keyframe") && task.kind === "video") return "ASSET";
  if (depId.endsWith("_video") && task.kind === "video") return "CONTINUITY";
  if (task.kind === "merge") return "EDITORIAL";
  return "SEQUENTIAL";
}

function buildDependentsIndex(nodes: DagNode[]): Record<string, string[]> {
  const index: Record<string, string[]> = {};
  for (const n of nodes) {
    for (const d of n.dependsOn) {
      if (!index[d]) index[d] = [];
      index[d].push(n.id);
    }
    for (const e of n.dependencies || []) {
      if (!index[e.taskId]) index[e.taskId] = [];
      if (!index[e.taskId].includes(n.id)) index[e.taskId].push(n.id);
    }
  }
  for (const key of Object.keys(index)) index[key].sort();
  return index;
}

function fanOutMap(tasks: GenerationTask[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const t of tasks) {
    for (const d of hardDependencyIds(syncDependsOn(t))) {
      counts.set(d, (counts.get(d) || 0) + 1);
    }
  }
  return counts;
}

export function buildProductionDag(
  spec: ProductionSpec,
  tasks?: GenerationTask[]
): ProductionDag {
  const planned = (tasks || planGenerationTasks(spec)).map(syncDependsOn);
  const fanOut = fanOutMap(planned);
  const nodes: DagNode[] = planned.map((t) => {
    const dependencies = edgesFromTask(t);
    const dependsOn = hardDependencyIds(t);
    return {
      id: t.id,
      kind: t.kind,
      dependsOn,
      dependencies,
      status: dependsOn.length ? "pending" : "ready",
      shotId: t.shotId,
      sceneId: t.sceneId,
      provider: t.selectedProvider,
      priority: defaultPriority(t, fanOut.get(t.id) || 0),
      approved: false,
      attempt: t.retryCount || 0,
    };
  });
  return {
    productionId: spec.project.id,
    nodes,
    dependentsIndex: buildDependentsIndex(nodes),
    version: 1,
  };
}

/** Build DAG directly from tasks (tests / resume) without re-planning. */
export function buildProductionDagFromTasks(
  productionId: string,
  tasks: GenerationTask[]
): ProductionDag {
  const planned = tasks.map(syncDependsOn);
  const fanOut = fanOutMap(planned);
  const nodes: DagNode[] = planned.map((t) => {
    const dependencies = edgesFromTask(t);
    const dependsOn = hardDependencyIds(t);
    const status: DagNodeStatus =
      t.status === "succeeded"
        ? "done"
        : t.status === "failed"
          ? "failed"
          : t.status === "skipped"
            ? "skipped"
            : t.status === "running"
              ? "running"
              : dependsOn.length
                ? "pending"
                : "ready";
    return {
      id: t.id,
      kind: t.kind,
      dependsOn,
      dependencies,
      status,
      shotId: t.shotId,
      sceneId: t.sceneId,
      provider: t.selectedProvider,
      priority: defaultPriority(t, fanOut.get(t.id) || 0),
      approved: t.status === "succeeded",
      attempt: t.retryCount || 0,
      error: t.lastError,
      failureKind: t.failureKind,
    };
  });
  return {
    productionId,
    nodes,
    dependentsIndex: buildDependentsIndex(nodes),
    version: 1,
  };
}

export function validateProductionDag(dag: ProductionDag): DagValidationResult {
  const issues: DagValidationIssue[] = [];
  const ids = new Set<string>();
  for (const n of dag.nodes) {
    if (ids.has(n.id)) {
      issues.push({ code: "duplicate_id", message: `Duplicate node id ${n.id}`, nodeId: n.id });
    }
    ids.add(n.id);
  }
  for (const n of dag.nodes) {
    for (const d of n.dependsOn) {
      if (d === n.id) {
        issues.push({
          code: "self_dependency",
          message: `${n.id} depends on itself`,
          nodeId: n.id,
        });
      }
      if (!ids.has(d)) {
        issues.push({
          code: "missing_dependency",
          message: `${n.id} missing dependency ${d}`,
          nodeId: n.id,
          relatedIds: [d],
        });
      }
    }
    for (const e of n.dependencies || []) {
      if (e.taskId === n.id) {
        issues.push({
          code: "self_dependency",
          message: `${n.id} typed self-dependency`,
          nodeId: n.id,
        });
      }
      if (!ids.has(e.taskId)) {
        issues.push({
          code: "orphan_dependency_edge",
          message: `${n.id} edge to unknown ${e.taskId}`,
          nodeId: n.id,
          relatedIds: [e.taskId],
        });
      }
    }
  }
  const cycle = findCycle(dag);
  if (cycle) {
    issues.push({
      code: "cycle",
      message: `Dependency cycle: ${cycle.join(" → ")}`,
      relatedIds: cycle,
    });
  }
  return { ok: issues.length === 0, issues };
}

function findCycle(dag: ProductionDag): string[] | null {
  const byId = new Map(dag.nodes.map((n) => [n.id, n]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  function dfs(id: string): string[] | null {
    if (visiting.has(id)) {
      const idx = stack.indexOf(id);
      return stack.slice(idx).concat(id);
    }
    if (visited.has(id)) return null;
    visiting.add(id);
    stack.push(id);
    const node = byId.get(id);
    for (const d of node?.dependsOn || []) {
      const c = dfs(d);
      if (c) return c;
    }
    stack.pop();
    visiting.delete(id);
    visited.add(id);
    return null;
  }

  for (const n of dag.nodes) {
    const c = dfs(n.id);
    if (c) return c;
  }
  return null;
}

function isHardSatisfied(
  edge: DagDependency,
  dep: DagNode | undefined,
  softPolicy: SoftDependencyPolicy
): boolean {
  if (edge.strength === "soft") {
    if (softPolicy === "allow_with_fallback") return true;
    // soft + wait: prefer completed, but do not hard-fail if missing
    if (!dep) return true;
    return TERMINAL_OK.has(dep.status);
  }
  if (!dep) return false;
  if (dep.status === "failed" || dep.status === "cancelled") return false;
  if (edge.requirement === "approved_output") {
    return dep.status === "done" && dep.approved === true;
  }
  return TERMINAL_OK.has(dep.status);
}

export function refreshReadyStates(
  dag: ProductionDag,
  opts?: { softPolicy?: SoftDependencyPolicy }
): ProductionDag {
  const softPolicy = opts?.softPolicy || "wait";
  const byId = new Map(dag.nodes.map((n) => [n.id, n]));
  const nodes = dag.nodes.map((n) => {
    if (TERMINAL_ALL.has(n.status) || n.status === "running" || n.status === "retry_pending") {
      return n;
    }
    const hard = (n.dependencies || []).filter((d) => d.strength === "hard");
    const edges = hard.length
      ? hard
      : (n.dependsOn || []).map((taskId) => ({
      taskId,
      reason: "SEQUENTIAL" as const,
      strength: "hard" as const,
      requirement: "completed" as const,
    }));
    const blockedByFailure = edges.some((e) => {
      const dep = byId.get(e.taskId);
      return dep && (dep.status === "failed" || dep.status === "cancelled");
    });
    if (blockedByFailure) return { ...n, status: "blocked" as const };
    const ready = edges.every((e) => isHardSatisfied(e, byId.get(e.taskId), softPolicy));
    if (ready) return { ...n, status: "ready" as const };
    return { ...n, status: n.status === "ready" ? "pending" : n.status === "blocked" ? "pending" : n.status };
  });
  return { ...dag, nodes, version: dag.version + 1 };
}

/**
 * Ready queue: only hard-satisfied, non-terminal, non-running nodes.
 * Deterministic: priority, then kind rank, then id.
 */
export function readyNodes(
  dag: ProductionDag,
  opts?: { softPolicy?: SoftDependencyPolicy }
): DagNode[] {
  const refreshed = refreshReadyStates(dag, opts);
  const byId = new Map(refreshed.nodes.map((n) => [n.id, n]));
  const softPolicy = opts?.softPolicy || "wait";
  const ready = refreshed.nodes.filter((n) => {
    if (n.status !== "ready" && n.status !== "pending") return false;
    const hard = (n.dependencies || []).filter((d) => d.strength === "hard");
    const edges = hard.length
      ? hard
      : n.dependsOn.map((taskId) => ({
          taskId,
          reason: "SEQUENTIAL" as DependencyReason,
          strength: "hard" as DependencyStrength,
          requirement: "completed" as const,
        }));
    if (edges.some((e) => {
      const dep = byId.get(e.taskId);
      return dep && (dep.status === "failed" || dep.status === "cancelled");
    })) {
      return false;
    }
    return edges.every((e) => isHardSatisfied(e, byId.get(e.taskId), softPolicy));
  });
  ready.sort((a, b) => {
    const pr = priorityRank(a.priority) - priorityRank(b.priority);
    if (pr !== 0) return pr;
    const rank = (k: string) =>
      k === "keyframe" ? 0 : k === "voice" ? 1 : k === "video" ? 2 : k === "merge" ? 4 : 3;
    const kr = rank(a.kind) - rank(b.kind);
    if (kr !== 0) return kr;
    return a.id.localeCompare(b.id);
  });
  return ready;
}

export function markNode(
  dag: ProductionDag,
  nodeId: string,
  status: DagNodeStatus,
  error?: string,
  extras?: Partial<Pick<DagNode, "approved" | "failureKind" | "attempt" | "leaseOwner" | "leaseExpiresAt">>
): ProductionDag {
  const now = new Date().toISOString();
  const nodes = dag.nodes.map((n) => {
    if (n.id !== nodeId) return n;
    return {
      ...n,
      status,
      error,
      ...extras,
      startedAt: status === "running" ? n.startedAt || now : n.startedAt,
      completedAt: TERMINAL_ALL.has(status) ? now : n.completedAt,
      // Completion ≠ approval. Continuity/VALIDATION edges that require
      // approved_output must wait for approveNode() (or explicit extras.approved).
      approved:
        extras?.approved !== undefined
          ? extras.approved
          : status === "failed" || status === "cancelled"
            ? false
            : n.approved,
    };
  });
  const next = refreshReadyStates({
    ...dag,
    nodes,
    dependentsIndex: buildDependentsIndex(nodes),
    version: dag.version + 1,
  });
  return next;
}

export function approveNode(dag: ProductionDag, nodeId: string): ProductionDag {
  return markNode(dag, nodeId, "done", undefined, { approved: true });
}

export function failedNodes(dag: ProductionDag): DagNode[] {
  return dag.nodes.filter((n) => n.status === "failed");
}

/** Transitive dependents of a node (includes the root). */
export function dependentTaskIds(dag: ProductionDag, failedNodeId: string): string[] {
  const affected = new Set<string>([failedNodeId]);
  const queue = [failedNodeId];
  while (queue.length) {
    const id = queue.shift()!;
    for (const child of dag.dependentsIndex[id] || []) {
      if (affected.has(child)) continue;
      affected.add(child);
      queue.push(child);
    }
  }
  return Array.from(affected);
}

export function explainBlocked(
  dag: ProductionDag,
  nodeId: string,
  opts?: { softPolicy?: SoftDependencyPolicy }
): BlockedExplanation {
  const softPolicy = opts?.softPolicy || "wait";
  const byId = new Map(dag.nodes.map((n) => [n.id, n]));
  const node = byId.get(nodeId);
  if (!node) {
    return { nodeId, status: "pending", waitingOn: [], summary: `Unknown node ${nodeId}` };
  }
  const waitingOn = (node.dependencies || [])
    .filter((e) => !isHardSatisfied(e, byId.get(e.taskId), softPolicy))
    .map((e) => {
      const dep = byId.get(e.taskId);
      return {
        taskId: e.taskId,
        reason: e.reason,
        strength: e.strength,
        requirement: e.requirement,
        currentStatus: dep?.status,
        approved: dep?.approved,
      };
    });
  const summary =
    waitingOn.length === 0
      ? `${nodeId} is not waiting on unmet hard dependencies`
      : `${nodeId} BLOCKED waiting for ${waitingOn.map((w) => w.taskId).join(", ")} (${waitingOn
          .map((w) => w.reason)
          .join(", ")})`;
  return { nodeId, status: node.status, waitingOn, summary };
}

/**
 * Execution waves: simultaneous eligibility under dependency constraints.
 * Not narrative scene order.
 */
export function computeExecutionWaves(
  dag: ProductionDag,
  opts?: { softPolicy?: SoftDependencyPolicy }
): ExecutionWave[] {
  const softPolicy = opts?.softPolicy || "wait";
  let sim: ProductionDag = {
    ...dag,
    nodes: dag.nodes.map((n) => ({
      ...n,
      status:
        n.status === "done" || n.status === "skipped"
          ? n.status
          : n.dependsOn.length
            ? "pending"
            : "ready",
      approved: n.status === "done" ? n.approved !== false : false,
    })),
  };
  sim = refreshReadyStates(sim, { softPolicy });
  const waves: ExecutionWave[] = [];
  const remaining = new Set(
    sim.nodes.filter((n) => !TERMINAL_OK.has(n.status)).map((n) => n.id)
  );
  let guard = 0;
  while (remaining.size && guard++ < sim.nodes.length + 2) {
    const ready = readyNodes(sim, { softPolicy }).filter((n) => remaining.has(n.id));
    if (!ready.length) break;
    const ids = ready.map((n) => n.id).sort();
    waves.push({ index: waves.length, taskIds: ids });
    for (const id of ids) {
      sim = markNode(sim, id, "done", undefined, { approved: true });
      remaining.delete(id);
    }
  }
  return waves;
}

export function computeCriticalPath(dag: ProductionDag): CriticalPathResult {
  const byId = new Map(dag.nodes.map((n) => [n.id, n]));
  const memo = new Map<string, string[]>();

  function longestTo(id: string, stack: Set<string>): string[] {
    if (memo.has(id)) return memo.get(id)!;
    if (stack.has(id)) return [id];
    stack.add(id);
    const node = byId.get(id);
    const deps = node?.dependsOn || [];
    if (!deps.length) {
      const path = [id];
      memo.set(id, path);
      stack.delete(id);
      return path;
    }
    let best: string[] = [];
    for (const d of deps) {
      const p = longestTo(d, stack);
      if (p.length > best.length) best = p;
    }
    const path = best.concat(id);
    memo.set(id, path);
    stack.delete(id);
    return path;
  }

  let bestPath: string[] = [];
  for (const n of dag.nodes) {
    const p = longestTo(n.id, new Set());
    if (p.length > bestPath.length) bestPath = p;
  }
  return {
    path: bestPath,
    length: bestPath.length,
    criticalTaskIds: bestPath,
  };
}

export function propagateFailure(
  dag: ProductionDag,
  failedNodeId: string,
  opts?: { failureKind?: TaskFailureKind; error?: string }
): FailurePropagationResult {
  let next = markNode(dag, failedNodeId, "failed", opts?.error, {
    failureKind: opts?.failureKind || "PERMANENT",
    approved: false,
  });
  const dependents = dependentTaskIds(next, failedNodeId).filter((id) => id !== failedNodeId);
  const blockedIds: string[] = [];
  const invalidatedIds: string[] = [];
  const independentIds = next.nodes
    .map((n) => n.id)
    .filter((id) => id !== failedNodeId && !dependents.includes(id));

  for (const id of dependents) {
    const node = next.nodes.find((n) => n.id === id)!;
    // Hard dependents become blocked (not permanently failed) so retry can unblock them.
    const hardEdge = (node.dependencies || []).some(
      (d) => d.taskId === failedNodeId && d.strength === "hard"
    ) || node.dependsOn.includes(failedNodeId);
    if (hardEdge || dependents.some((d) => node.dependsOn.includes(d))) {
      if (node.status !== "done" && node.status !== "skipped") {
        next = markNode(next, id, "blocked", `dependency_failed:${failedNodeId}`, {
          failureKind: "DEPENDENCY",
        });
        blockedIds.push(id);
        if (node.status === "ready" || node.status === "running") {
          invalidatedIds.push(id);
        }
      }
    }
  }
  return { dag: next, blockedIds, invalidatedIds, independentIds };
}

export function planRetry(
  dag: ProductionDag,
  failedNodeId: string,
  mode: "task" | "task_and_deps" | "affected_descendants" | "from_checkpoint" = "task"
): RetryPlan {
  const byId = new Map(dag.nodes.map((n) => [n.id, n]));
  const root = byId.get(failedNodeId);
  if (!root) return { retryRootIds: [], resetIds: [], preservedIds: dag.nodes.map((n) => n.id) };

  const retryRootIds = [failedNodeId];
  let resetIds = new Set<string>([failedNodeId]);

  if (mode === "task_and_deps") {
    for (const d of root.dependsOn) resetIds.add(d);
  }
  if (mode === "affected_descendants" || mode === "from_checkpoint") {
    for (const id of dependentTaskIds(dag, failedNodeId)) resetIds.add(id);
  }

  // Never reset succeeded upstream unless explicitly task_and_deps
  if (mode === "task" || mode === "affected_descendants") {
    resetIds = new Set(
      [...resetIds].filter((id) => {
        const n = byId.get(id)!;
        if (id === failedNodeId) return true;
        if (n.status === "done" && !dependentTaskIds(dag, failedNodeId).includes(id)) return false;
        return dependentTaskIds(dag, failedNodeId).includes(id);
      })
    );
  }

  const preservedIds = dag.nodes.map((n) => n.id).filter((id) => !resetIds.has(id));
  return { retryRootIds, resetIds: [...resetIds], preservedIds };
}

export function applyRetry(dag: ProductionDag, plan: RetryPlan): ProductionDag {
  let next = dag;
  for (const id of plan.resetIds) {
    next = markNode(next, id, "retry_pending", undefined, {
      approved: false,
      failureKind: undefined,
      attempt: (next.nodes.find((n) => n.id === id)?.attempt || 0) + 1,
    });
    // Move retry_pending → pending/ready via refresh
    next = {
      ...next,
      nodes: next.nodes.map((n) =>
        n.id === id ? { ...n, status: "pending", error: undefined } : n
      ),
    };
  }
  return refreshReadyStates(next);
}

export function cancelNode(
  dag: ProductionDag,
  nodeId: string,
  opts?: { descendants?: boolean }
): ProductionDag {
  let next = markNode(dag, nodeId, "cancelled", "cancelled", {
    failureKind: "CANCELLATION",
    approved: false,
  });
  if (opts?.descendants) {
    for (const id of dependentTaskIds(next, nodeId)) {
      if (id === nodeId) continue;
      const n = next.nodes.find((x) => x.id === id)!;
      if (!TERMINAL_ALL.has(n.status) || n.status === "running") {
        next = markNode(next, id, "cancelled", "ancestor_cancelled", {
          failureKind: "CANCELLATION",
        });
      }
    }
  }
  return refreshReadyStates(next);
}

export function claimNode(
  dag: ProductionDag,
  nodeId: string,
  owner: string,
  leaseMs = 60_000
): { ok: boolean; dag: ProductionDag; reason?: string } {
  const node = dag.nodes.find((n) => n.id === nodeId);
  if (!node) return { ok: false, dag, reason: "not_found" };
  if (node.status === "running" && node.leaseOwner && node.leaseOwner !== owner) {
    if (node.leaseExpiresAt && Date.parse(node.leaseExpiresAt) > Date.now()) {
      return { ok: false, dag, reason: "lease_held" };
    }
  }
  if (node.status !== "ready" && node.status !== "pending" && node.status !== "retry_pending") {
    return { ok: false, dag, reason: `status_${node.status}` };
  }
  const expires = new Date(Date.now() + leaseMs).toISOString();
  return {
    ok: true,
    dag: markNode(dag, nodeId, "running", undefined, {
      leaseOwner: owner,
      leaseExpiresAt: expires,
    }),
  };
}

export function createCheckpoint(
  dag: ProductionDag,
  boundary: ExecutionCheckpoint["boundary"],
  resultAssetIds?: Record<string, string>,
  completedWaveIndex?: number
): ExecutionCheckpoint {
  return {
    productionId: dag.productionId,
    version: dag.version,
    createdAt: new Date().toISOString(),
    boundary,
    completedWaveIndex,
    nodeSnapshots: dag.nodes.map((n) => ({
      id: n.id,
      status: n.status,
      approved: n.approved,
      attempt: n.attempt,
      error: n.error,
      failureKind: n.failureKind,
      resultAssetId: resultAssetIds?.[n.id],
    })),
  };
}

export function resumeFromCheckpoint(
  dag: ProductionDag,
  checkpoint: ExecutionCheckpoint
): ProductionDag {
  const snap = new Map(checkpoint.nodeSnapshots.map((s) => [s.id, s]));
  const nodes = dag.nodes.map((n) => {
    const s = snap.get(n.id);
    if (!s) return n;
    return {
      ...n,
      status: s.status,
      approved: s.approved,
      attempt: s.attempt,
      error: s.error,
      failureKind: s.failureKind,
    };
  });
  // Recover interrupted running → retry_pending
  const recovered = nodes.map((n) =>
    n.status === "running" ? { ...n, status: "retry_pending" as const, leaseOwner: undefined } : n
  );
  return refreshReadyStates({
    ...dag,
    nodes: recovered.map((n) =>
      n.status === "retry_pending" ? { ...n, status: "pending" } : n
    ),
    dependentsIndex: buildDependentsIndex(recovered),
    version: dag.version + 1,
  });
}

export function parallelOpportunities(dag: ProductionDag): string[][] {
  return computeExecutionWaves(dag).map((w) => w.taskIds);
}

/** Test helper: materialize TaskDependency list onto a task and sync dependsOn. */
export function withDependencies(
  task: GenerationTask,
  dependencies: TaskDependency[]
): GenerationTask {
  return syncDependsOn({ ...task, dependencies, dependsOn: task.dependsOn || [] });
}
