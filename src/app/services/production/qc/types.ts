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
  | "style";

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
  | "narrative_incoherence";

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

export interface QCFailure {
  code: QcFailureCode;
  dimension: QcDimensionId;
  message: string;
  confidence: number;
  evidence: QcEvidence;
  retryable: boolean;
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
}
