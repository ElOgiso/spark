/**
 * SPARK Phase 17 — Canonical Production Observability Event Contract & Types.
 * Permanent Architectural Law: SPARK OWNS MEANING. PROVIDERS OWN EXECUTION.
 * Store evidence first, learn second.
 */

export type ProductionEventFamily =
  | "PLANNING"
  | "ROUTING"
  | "ECONOMICS"
  | "EXECUTION"
  | "QC"
  | "REPAIR"
  | "EDITORIAL_MASTER"
  | "REVIEW_PUBLISH"
  | "PERFORMANCE";

export type ProductionEventType =
  // Planning
  | "production_planned"
  | "mode_selected"
  | "format_direction_selected"
  | "shot_planned"
  | "task_planned"
  // Routing
  | "routing_evaluated"
  | "routing_selected"
  | "routing_fallback"
  // Economics
  | "cost_estimated"
  | "credits_quoted"
  | "credits_reserved"
  | "credits_settled"
  | "credits_released"
  | "credits_pending_unknown"
  | "credits_refunded"
  | "provider_cost_recorded"
  // Execution
  | "execution_queued"
  | "execution_submitting"
  | "execution_submitted"
  | "execution_running"
  | "execution_succeeded"
  | "execution_failed"
  | "execution_cancelled"
  | "execution_unknown_submission"
  // QC
  | "qc_started"
  | "qc_evaluated"
  | "qc_passed"
  | "qc_failed"
  | "qc_needs_review"
  // Repair
  | "repair_diagnosed"
  | "repair_decided"
  | "repair_attempted"
  | "repair_succeeded"
  | "repair_failed"
  | "repair_exhausted"
  // Editorial & Master
  | "editorial_started"
  | "editorial_assembled"
  | "mastering_started"
  | "mastering_succeeded"
  | "mastering_failed"
  | "mastering_deferred"
  // Review & Publish
  | "review_submitted"
  | "review_decided"
  | "publish_queued"
  | "publish_completed"
  | "publish_failed"
  // Performance
  | "analytics_captured"
  | "performance_recorded";

export type EventCriticality = "critical" | "diagnostic";

export interface EventProvenance {
  source: string;
  measured: boolean;
  compilerVersion?: string;
  pricingPolicyVersion?: string;
  routerVersion?: string;
  qcVersion?: string;
  formatDirectorVersion?: string;
}

export interface ProductionObservationEvent {
  id: string;
  productionId: string;
  brandId?: string;
  userId?: string;
  eventType: ProductionEventType;
  occurredAt: string;
  taskId?: string;
  sceneId?: string;
  shotId?: string;
  executionId?: string;
  providerJobId?: string;
  providerId?: string;
  modelId?: string;
  attempt?: number;
  assetId?: string;
  reservationId?: string;
  criticality?: EventCriticality;
  evidence: Record<string, unknown>;
  provenance: EventProvenance;
}

export interface ProductionObservationFilter {
  productionId?: string;
  taskId?: string;
  executionId?: string;
  brandId?: string;
  eventType?: ProductionEventType | ProductionEventType[];
  since?: string;
  until?: string;
}
