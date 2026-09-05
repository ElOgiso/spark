/**
 * Legal transitions for the Phase 10 production lifecycle conductor.
 */

import type { ProductionLifecyclePhase } from "./lifecycleTypes";
import type { ProjectSpec } from "../specification/productionSpec";

const ALLOWED: Record<ProductionLifecyclePhase, ProductionLifecyclePhase[]> = {
  created: ["planning", "planned", "cancelled", "failed"],
  planning: ["planned", "failed", "cancelled", "blocked"],
  planned: ["preflight", "cancelled", "failed"],
  preflight: ["ready", "blocked", "failed", "cancelled"],
  ready: ["generating", "paused", "cancelled", "failed"],
  generating: ["validating", "approved", "paused", "cancelled", "failed", "blocked"],
  validating: ["repairing", "approved", "awaiting_review", "failed", "cancelled", "paused"],
  repairing: ["validating", "awaiting_review", "failed", "cancelled", "paused"],
  approved: ["assembling", "completed", "cancelled", "failed"],
  assembling: ["mastering", "completed", "awaiting_review", "failed", "cancelled", "paused"],
  mastering: ["completed", "failed", "awaiting_review", "cancelled"],
  completed: [],
  paused: ["ready", "generating", "validating", "repairing", "assembling", "mastering", "cancelled", "failed"],
  cancelled: [],
  failed: [],
  blocked: ["preflight", "ready", "cancelled", "failed"],
  awaiting_review: ["approved", "repairing", "cancelled", "failed", "paused"],
};

export function canTransitionLifecycle(
  from: ProductionLifecyclePhase,
  to: ProductionLifecyclePhase
): boolean {
  if (from === to) return true;
  return (ALLOWED[from] || []).includes(to);
}

export function transitionLifecycle(
  from: ProductionLifecyclePhase,
  to: ProductionLifecyclePhase
): { ok: true; phase: ProductionLifecyclePhase } | { ok: false; error: string } {
  if (!canTransitionLifecycle(from, to)) {
    return { ok: false, error: `invalid_lifecycle_transition:${from}->${to}` };
  }
  return { ok: true, phase: to };
}

export function isTerminalLifecyclePhase(phase: ProductionLifecyclePhase): boolean {
  return phase === "completed" || phase === "cancelled" || phase === "failed";
}

/** Map lifecycle phase onto existing ProductionSpec.project.status values. */
export function projectStatusForPhase(phase: ProductionLifecyclePhase): ProjectSpec["status"] {
  switch (phase) {
    case "created":
    case "planning":
    case "planned":
    case "preflight":
    case "ready":
      return "planning";
    case "generating":
      return "generating";
    case "validating":
    case "repairing":
    case "approved":
    case "awaiting_review":
    case "paused":
      return "qc";
    case "assembling":
      return "editorial";
    case "mastering":
    case "completed":
      return "mastered";
    case "cancelled":
      return "cancelled";
    case "failed":
    case "blocked":
      return "failed";
    default:
      return "planning";
  }
}
