/**
 * Explicit GenerationExecution state machine.
 * Invalid transitions are rejected.
 */

import type { ExecutionStatus } from "./types";

const ALLOWED: Record<ExecutionStatus, ExecutionStatus[]> = {
  ready: ["preparing", "queued", "cancelled", "exhausted"],
  preparing: ["credit_reserved", "submitting", "failed", "cancelled", "exhausted"],
  credit_reserved: ["submitting", "failed", "cancelled", "exhausted"],
  submitting: ["submitted", "running", "polling", "succeeded", "failed", "unknown_submission", "cancelled", "exhausted"],
  submitted: ["running", "polling", "succeeded", "failed", "cancelled", "unknown_submission", "exhausted"],
  pending: ["queued", "preparing", "running", "cancelled", "exhausted"],
  queued: ["preparing", "submitting", "running", "cancelled", "exhausted"],
  running: ["polling", "succeeded", "failed", "unknown_submission", "cancelled"],
  polling: ["succeeded", "failed", "cancelled", "running", "unknown_submission"],
  unknown_submission: ["reconciling", "failed", "cancelled"],
  reconciling: ["submitted", "running", "polling", "succeeded", "failed", "retrying", "cancelled"],
  failed: ["retrying", "exhausted", "cancelled"],
  retrying: ["queued", "preparing", "submitting", "running", "exhausted", "cancelled"],
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
  return (
    status === "ready" ||
    status === "preparing" ||
    status === "credit_reserved" ||
    status === "submitting" ||
    status === "submitted" ||
    status === "queued" ||
    status === "running" ||
    status === "polling" ||
    status === "retrying" ||
    status === "unknown_submission" ||
    status === "reconciling"
  );
}
