/**
 * Phase 10 — End-to-end production lifecycle contracts.
 * Extends existing ProductionSpec / execution / QC / editorial — does not replace them.
 */

import type { ProductionSpec } from "../specification/productionSpec";
import type { ProductionAsset } from "../../../domain/types";
import type { ProductionExecutionState } from "./types";
import type { ExecuteProductionResult } from "./productionExecutor";
import type { QcRepairLoopResult, ProductionQcReport } from "../qc/qcOrchestrator";
import type { EditorialPipelineResult } from "../editorial/pipeline";

/** Canonical production lifecycle phases (conductor-level). */
export type ProductionLifecyclePhase =
  | "created"
  | "planning"
  | "planned"
  | "preflight"
  | "ready"
  | "generating"
  | "validating"
  | "repairing"
  | "approved"
  | "assembling"
  | "mastering"
  | "completed"
  | "paused"
  | "cancelled"
  | "failed"
  | "blocked"
  | "awaiting_review";

export type ProductionLifecycleEventType =
  | "lifecycle_started"
  | "phase_entered"
  | "phase_exited"
  | "preflight_started"
  | "preflight_passed"
  | "preflight_failed"
  | "generation_started"
  | "generation_progress"
  | "generation_completed"
  | "generation_failed"
  | "qc_started"
  | "qc_completed"
  | "repair_started"
  | "repair_completed"
  | "repair_exhausted"
  | "approval_granted"
  | "approval_blocked"
  | "assembly_started"
  | "assembly_completed"
  | "mastering_started"
  | "mastering_completed"
  | "mastering_failed"
  | "checkpoint_saved"
  | "lifecycle_paused"
  | "lifecycle_resumed"
  | "lifecycle_cancelled"
  | "lifecycle_completed"
  | "lifecycle_failed"
  | "warning";

export interface ProductionLifecycleEvent {
  type: ProductionLifecycleEventType;
  at: string;
  phase: ProductionLifecyclePhase;
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}

export type PreflightSeverity = "blocker" | "warning" | "info";

export interface PreflightIssue {
  code: string;
  severity: PreflightSeverity;
  message: string;
  path?: string;
  remediation?: string;
}

export interface PreflightReport {
  ok: boolean;
  checkedAt: string;
  issues: PreflightIssue[];
  blockers: PreflightIssue[];
  warnings: PreflightIssue[];
  summary: string;
}

export interface ProductionLifecycleCheckpoint {
  id: string;
  savedAt: string;
  phase: ProductionLifecyclePhase;
  productionId: string;
  snapshot: {
    spec: ProductionSpec;
    assets: ProductionAsset[];
    executionState?: ProductionExecutionState;
    qcVerdict?: string;
    editorialTimelineId?: string;
    masterAssetId?: string;
    masterUrl?: string;
    completedTaskIds: string[];
    failedTaskIds: string[];
  };
}

export interface ProductionCostRollup {
  estimated: number;
  actual: number;
  currency: string;
  byProvider: Record<string, number>;
  notes: string[];
}

export interface ProductionTimingRollup {
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  phaseDurationsMs: Partial<Record<ProductionLifecyclePhase, number>>;
}

export interface ProductionLifecycleReport {
  productionId: string;
  phase: ProductionLifecyclePhase;
  ok: boolean;
  completed: boolean;
  /** True only when master succeeded, or policy explicitly allows assembly-only completion */
  deliverableReady: boolean;
  summary: string;
  events: ProductionLifecycleEvent[];
  preflight?: PreflightReport;
  execution?: ExecuteProductionResult;
  qc?: QcRepairLoopResult;
  qcReport?: ProductionQcReport;
  editorial?: EditorialPipelineResult;
  checkpoint?: ProductionLifecycleCheckpoint;
  cost: ProductionCostRollup;
  timing: ProductionTimingRollup;
  warnings: string[];
  errors: string[];
  spec: ProductionSpec;
}

export interface RunProductionLifecycleOptions {
  dryRun?: boolean;
  enableQc?: boolean;
  enableEditorial?: boolean;
  enableMaster?: boolean;
  /** PREVIS/express may complete after assembly without mastering when true */
  allowCompleteWithoutMaster?: boolean;
  automationMode?: "manual" | "balanced" | "autonomous" | "strict";
  brandId?: string;
  checkpoint?: ProductionLifecycleCheckpoint;
  signal?: AbortSignal;
  onEvent?: (event: ProductionLifecycleEvent) => void;
  deps?: ProductionLifecycleDeps;
  /**
   * Live path: pass AssetService master passthrough (or FFmpeg) so editorial
   * does not invent mock CDN masters. Tests may omit — mock adapter is used.
   */
  masteringAdapter?: import("../editorial/mastering/types").MasteringRuntimeAdapter;
}

export interface ProductionLifecycleDeps {
  executeProduction?: typeof import("./productionExecutor").executeProduction;
  runQcWithRepairLoop?: typeof import("../qc/qcOrchestrator").runQcWithRepairLoop;
  runEditorialPipeline?: typeof import("../editorial/pipeline").runEditorialPipeline;
}

export interface RunProductionLifecycleInput {
  spec: ProductionSpec;
  options?: RunProductionLifecycleOptions;
}
