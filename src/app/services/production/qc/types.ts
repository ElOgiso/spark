/**
 * Phase 5 — Intelligent QC contracts.
 * Evaluates planned ProductionSpec/ShotSpec vs generated media — not aesthetic preference.
 */

import type { QcRemediation } from "../specification/qualitySpec";
import type { ContinuityState } from "../specification/continuitySpec";

export type QcResultStatus = "pass" | "warn" | "retry" | "fail";

export type QcRecommendedAction =
  | "accept"
  | "repair"
  | "rerender"
  | "reroute"
  | "manual_review"
  | "repair_prompt"
  | "change_reference"
  | "strengthen_continuity"
  | "change_generation_strategy"
  | "reroute_provider"
  | "regenerate_shot"
  | "regenerate_dependent_shots";

export type QcDimensionId =
  | "intent"
  | "identity"
  | "continuity"
  | "cinematography"
  | "motion"
  | "technical"
  | "audio"
  | "style"
  /** Phase 9 — structural usability of the candidate asset */
  | "structural"
  /** Phase 9 — start/end/handoff state verification */
  | "handoff"
  /** Phase 9 — coverage / cinematic role completeness (scene+) */
  | "coverage";

export type QcDimensionApplicability = "applicable" | "not_applicable" | "inconclusive";

export type QcFailureCode =
  | "identity_drift"
  | "wardrobe_drift"
  | "prop_drift"
  | "location_drift"
  | "lighting_drift"
  | "time_drift"
  | "composition_mismatch"
  | "camera_mismatch"
  | "motion_mismatch"
  | "action_missing"
  | "subject_missing"
  | "style_mismatch"
  | "prompt_mismatch"
  | "duration_mismatch"
  | "aspect_ratio_mismatch"
  | "dialogue_missing"
  | "lip_sync_failure"
  | "audio_missing"
  | "continuity_break"
  | "quality_degradation"
  | "technical_failure"
  | "spatial_continuity_break"
  | "screen_direction_break"
  | "insufficient_visual_evidence"
  | "coverage_gap"
  | "narrative_incoherence"
  // Phase 9 — requirement-aware generation QA
  | "asset_missing"
  | "asset_unreadable"
  | "resolution_mismatch"
  | "orientation_mismatch"
  | "product_mismatch"
  | "wardrobe_mismatch"
  | "prop_missing"
  | "prop_state_mismatch"
  | "eyeline_mismatch"
  | "axis_violation"
  | "screen_direction_violation"
  | "blocking_mismatch"
  | "action_mismatch"
  | "start_state_mismatch"
  | "end_state_mismatch"
  | "handoff_failure"
  | "camera_intent_mismatch"
  | "framing_mismatch"
  | "coverage_role_mismatch"
  | "cinematic_purpose_mismatch"
  | "visual_treatment_mismatch"
  | "sync_failure"
  | "repair_exhausted"
  | "not_evaluated";

export interface QcEvidence {
  failureCode?: QcFailureCode;
  expected: string;
  observed: string;
  confidence: number;
  note?: string;
}

export interface QCDimensionResult {
  id: QcDimensionId;
  applicability: QcDimensionApplicability;
  score: number;
  status: QcResultStatus;
  evidence: QcEvidence[];
  failureCodes: QcFailureCode[];
}

export type QcSeverity = "pass" | "warning" | "fail" | "critical" | "unknown";

export type QcRequirementStrength = "hard" | "soft";

export interface QCFailure {
  code: QcFailureCode;
  dimension: QcDimensionId;
  message: string;
  confidence: number;
  evidence: QcEvidence;
  retryable: boolean;
  /** Phase 9 — hard failures cannot be outweighed by a high overall score */
  severity?: QcSeverity;
  requirementStrength?: QcRequirementStrength;
}

export interface QCWarning {
  code: QcFailureCode | "inconclusive_analysis" | "low_confidence";
  dimension: QcDimensionId;
  message: string;
  confidence: number;
}

export interface QcScoreBreakdown {
  overall: number;
  dimensions: Partial<Record<QcDimensionId, number>>;
}

export interface ProductionQCResult {
  id: string;
  productionId: string;
  sceneId?: string;
  shotId?: string;
  taskId?: string;
  assetId?: string;
  level: "asset" | "shot" | "scene" | "production";
  status: QcResultStatus;
  score: number;
  scores: QcScoreBreakdown;
  dimensions: QCDimensionResult[];
  failures: QCFailure[];
  warnings: QCWarning[];
  recommendedAction: QcRecommendedAction;
  /** Maps to Phase 3/4 remediation vocabulary when applicable */
  remediation?: QcRemediation | "continue" | "manual_review";
  providerChange: boolean;
  evaluatedAt: string;
  userMessage: string;
  analysisCost?: {
    analysisProvider?: string;
    analysisModel?: string;
    estimatedAnalysisCost?: number;
    actualAnalysisCost?: number;
  };
  metadata?: Record<string, unknown>;
  /** Phase 9 — hard requirement failures (dominate aesthetic score) */
  hardFailures?: QCFailure[];
  /** Phase 9 — soft deviations that may warn without rejecting */
  softFailures?: QCFailure[];
  /** Phase 9 — true when any hard failure is unresolved */
  hardFailurePresent?: boolean;
  /** Phase 9 — gate decision distinct from raw score */
  gateDecision?: "approve" | "approve_with_warnings" | "reject" | "needs_review" | "not_evaluated";
}

export type QcRepairScope =
  | "candidate"
  | "shot"
  | "shot_and_dependents"
  | "scene"
  | "sequence"
  | "production";

export type QcRepairStrategy =
  | "regenerate_same_intent"
  | "change_reference_set"
  | "strengthen_continuity_constraints"
  | "change_generation_strategy"
  | "change_provider"
  | "change_camera_intent"
  | "change_motion_intent"
  | "change_start_frame"
  | "change_end_frame"
  | "regenerate_candidates"
  | "roll_back_to_approved_state"
  | "escalate_human_review";

export interface QcRootCause {
  observedFailure: QcFailureCode;
  probableCause: string;
  confidence: number;
  category:
    | "reference"
    | "prompt"
    | "strategy"
    | "provider"
    | "continuity_state"
    | "technical"
    | "unknown";
}

export interface CandidateRankResult {
  candidateId: string;
  qc: ProductionQCResult;
  aestheticScore: number;
  hardRequirementScore: number;
  rankScore: number;
  eligible: boolean;
  rejectionReasons: QcFailureCode[];
}

export interface HandoffQcFinding {
  fromShotId: string;
  toShotId: string;
  status: QcResultStatus;
  failures: QCFailure[];
  expectedEnd?: string;
  expectedStart?: string;
  observedEnd?: string;
  observedStart?: string;
}

export interface DownstreamRevalidationPlan {
  replacedShotId: string;
  replacedAssetVersion?: string;
  revalidateShotIds: string[];
  regenerateShotIds: string[];
  blockedTaskIds: string[];
  reason: string;
}

export interface ObservedVisualState {
  subject?: string;
  action?: string;
  environment?: string;
  shotSize?: string;
  framing?: string;
  composition?: string;
  cameraAngle?: string;
  cameraMovement?: string;
  lighting?: string;
  lightingDirection?: string;
  timeOfDay?: string;
  style?: string;
  colorIntent?: string;
  identity?: {
    face?: string;
    body?: string;
    hair?: string;
    clothing?: string;
    distinctive?: string[];
    characterRefMatch?: boolean;
  };
  props?: string[];
  spatial?: {
    subjectPosition?: string;
    screenDirection?: string;
  };
  dialoguePresent?: boolean;
  narrationPresent?: boolean;
  lipSyncOk?: boolean | null;
  motionOccurred?: boolean;
  subjectPresent?: boolean;
  continuityObserved?: Partial<ContinuityState>;
  confidence?: number;
  /** Phase 9 — optional begin/end snapshots when temporal sampling is available */
  beginState?: string;
  endState?: string;
  heldProps?: string[];
  eyelineTarget?: string;
  cameraSide?: string;
  productIdentity?: string;
  /** When a check could not run, list reasons — never invent confidence */
  notEvaluatedReasons?: string[];
}

export interface VisualFrameSample {
  role: "begin" | "middle" | "end" | "representative";
  url?: string;
  description?: string;
}

export type SparkAutomationMode = "manual" | "balanced" | "autonomous";

export type ProductionQcVerdict =
  | "production_ready"
  | "production_needs_review"
  | "production_failed";

export interface QcBudgetState {
  qcRetries: number;
  maxQcRetries: number;
  providerChanges: number;
  maxProviderChanges: number;
  totalExecutionAttempts: number;
  maxTotalExecutionAttempts: number;
  exhausted: boolean;
}

export interface RepairDecision {
  action: QcRecommendedAction;
  remediation: QcRemediation | "continue" | "manual_review";
  providerChange: boolean;
  nextProvider?: string;
  strategyChange?: string;
  modifyPromptHint?: string;
  changedInputs: string[];
  strengthenReferences: boolean;
  regenerateShotIds: string[];
  regenerateTaskIds: string[];
  preserveShotIds: string[];
  reason: string;
  withinBudget: boolean;
  /** Phase 9 */
  scope?: QcRepairScope;
  strategy?: QcRepairStrategy;
  rootCauses?: QcRootCause[];
  revalidateShotIds?: string[];
  attempt?: number;
  maxAttempts?: number;
  escalate?: boolean;
}
