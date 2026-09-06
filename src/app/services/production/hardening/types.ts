/**
 * Phase 12 — Production hardening contracts.
 * Extends existing lifecycle / QC / autonomy; does not create parallel engines.
 */

export type ReadinessStatus = "PASS" | "PASS_WITH_LIMITATIONS" | "DEGRADED" | "BLOCKED";

export type HardGateId =
  | "G1_SPEC_CONSTRUCTION"
  | "G2_STORYBOARD_SHOT_MAPPING"
  | "G3_CONTINUITY_PROPAGATION"
  | "G4_DAG_SAFETY"
  | "G5_IDEMPOTENT_EXECUTION"
  | "G6_PROVIDER_FAILURE_ISOLATION"
  | "G7_QC_EVIDENCE"
  | "G8_APPROVED_ASSET_PROTECTION"
  | "G9_MASTER_VALIDATION"
  | "G10_AUTONOMY_BOUNDS"
  | "G11_SECRET_BOUNDARY"
  | "G12_GOLDEN_E2E";

export type ProductionErrorCategory =
  | "VALIDATION_ERROR"
  | "CONTRACT_ERROR"
  | "REFERENCE_ERROR"
  | "CONTINUITY_ERROR"
  | "CAPABILITY_ERROR"
  | "ROUTING_ERROR"
  | "PROVIDER_ERROR"
  | "AUTH_ERROR"
  | "RATE_LIMIT_ERROR"
  | "TIMEOUT_ERROR"
  | "MEDIA_ERROR"
  | "QC_ERROR"
  | "REPAIR_ERROR"
  | "DAG_ERROR"
  | "PERSISTENCE_ERROR"
  | "EDITORIAL_ERROR"
  | "MASTERING_ERROR"
  | "DELIVERY_ERROR"
  | "BUDGET_ERROR"
  | "POLICY_ERROR"
  | "LEARNING_ERROR"
  | "SYSTEM_ERROR";

export interface NormalizedProductionError {
  category: ProductionErrorCategory;
  code: string;
  message: string;
  recoverability: "retryable" | "fallback" | "escalate" | "fatal";
  severity: "low" | "medium" | "high" | "critical";
  stage?: string;
  entityId?: string;
  taskId?: string;
  cause?: string;
  recommendedAction?: string;
}

export interface ContractIssue {
  path: string;
  severity: "error" | "warning";
  code: string;
  message: string;
}

export interface ContractValidationReport {
  ok: boolean;
  errors: ContractIssue[];
  warnings: ContractIssue[];
}

export interface LineageNode {
  kind:
    | "production"
    | "scene"
    | "shot"
    | "storyboard_panel"
    | "reference"
    | "generation_intent"
    | "generation_task"
    | "candidate_asset"
    | "qc"
    | "repair"
    | "editorial"
    | "master"
    | "delivery"
    | "performance"
    | "learning";
  id: string;
  parentIds: string[];
}

export interface LineageIntegrityReport {
  ok: boolean;
  nodes: LineageNode[];
  orphanIds: string[];
  brokenEdges: Array<{ from: string; to: string; reason: string }>;
  duplicateIds: string[];
}

export interface IdempotentRunRecord {
  productionId: string;
  operationKey: string;
  runCount: number;
  firstReportId?: string;
  lastReportId?: string;
  billableAttempts: number;
}

export type InjectedFailureKind =
  | "provider_unavailable"
  | "provider_timeout"
  | "rate_limited"
  | "invalid_response"
  | "missing_asset_url"
  | "media_validation_failure"
  | "qc_fail"
  | "webhook_duplicate"
  | "budget_exceeded"
  | "mastering_unavailable";

export interface FailureInjectionPlan {
  kind: InjectedFailureKind;
  stage:
    | "planning"
    | "generation"
    | "provider"
    | "qc"
    | "repair"
    | "editorial"
    | "mastering"
    | "delivery"
    | "learning";
  taskId?: string;
  times?: number;
}

export interface HardGateResult {
  id: HardGateId;
  status: ReadinessStatus;
  evidence: string[];
  blockers: string[];
}

export interface ReadinessCategoryResult {
  category: string;
  status: ReadinessStatus;
  notes: string[];
}

export interface ProductionReadinessReport {
  generatedAt: string;
  overall: ReadinessStatus;
  gates: HardGateResult[];
  categories: ReadinessCategoryResult[];
  knownLimitations: string[];
  remainingBlockers: string[];
  architectureIntegrity: {
    singleOrchestrator: boolean;
    singleProductionSpec: boolean;
    singleShotModel: boolean;
    singleContinuityEngine: boolean;
    singleDag: boolean;
    singleQcSystem: boolean;
    singleProviderRouter: boolean;
    singleLearningSystem: boolean;
  };
  verdict: "PRODUCTION_READY" | "PRODUCTION_READY_WITH_LIMITATIONS" | "NOT_PRODUCTION_READY";
}
