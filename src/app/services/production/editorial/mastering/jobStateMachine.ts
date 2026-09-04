/**
 * Mastering job state machine — mirrors Phase 4 execution discipline.
 */

import type { MasteringJobStatus } from "./types";

const ALLOWED: Record<MasteringJobStatus, MasteringJobStatus[]> = {
  planned: ["queued", "cancelled"],
  queued: ["running", "cancelled"],
  running: ["succeeded", "failed", "cancelled", "retrying"],
  retrying: ["queued", "exhausted", "cancelled"],
  succeeded: [],
  failed: ["retrying", "exhausted"],
  cancelled: [],
  exhausted: [],
};

export function canTransitionMastering(
  from: MasteringJobStatus,
  to: MasteringJobStatus
): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export function transitionMastering(
  from: MasteringJobStatus,
  to: MasteringJobStatus
): { ok: true; status: MasteringJobStatus } | { ok: false; error: string } {
  if (!canTransitionMastering(from, to)) {
    return { ok: false, error: `Invalid mastering transition ${from} → ${to}` };
  }
  return { ok: true, status: to };
}

export function isTerminalMastering(status: MasteringJobStatus): boolean {
  return status === "succeeded" || status === "cancelled" || status === "exhausted";
}
