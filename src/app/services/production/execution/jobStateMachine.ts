/**
 * Explicit GenerationExecution state machine.
 * Invalid transitions are rejected.
 */

import type { ExecutionStatus } from "./types";

const ALLOWED: Record<ExecutionStatus, ExecutionStatus[]> = {
  pending: ["queued", "cancelled", "exhausted"],
  queued: ["running", "cancelled", "exhausted"],
  running: ["polling", "succeeded", "failed", "cancelled"],
  polling: ["succeeded", "failed", "cancelled", "running"],
  failed: ["retrying", "exhausted", "cancelled"],
  retrying: ["queued", "exhausted", "cancelled"],
  succeeded: [],
  cancelled: [],
  exhausted: [],
};

export function canTransition(from: ExecutionStatus, to: ExecutionStatus): boolean {
  if (from === to) return true;
  return (ALLOWED[from] || []).includes(to);
}

export function transitionStatus(
  from: ExecutionStatus,
  to: ExecutionStatus
): { ok: true; status: ExecutionStatus } | { ok: false; error: string } {
  if (!canTransition(from, to)) {
    return { ok: false, error: `invalid_transition:${from}->${to}` };
  }
  return { ok: true, status: to };
}

export function isTerminalStatus(status: ExecutionStatus): boolean {
  return status === "succeeded" || status === "cancelled" || status === "exhausted";
}

export function isActiveStatus(status: ExecutionStatus): boolean {
  return status === "queued" || status === "running" || status === "polling" || status === "retrying";
}
