/**
 * Phase 11 — Autonomous production + learning contracts.
 * Extends Phase 8 performance learning; no second brain.
 */

import type {
  CreativeLearning,
  AdaptiveStrategyAdvice,
  PerformanceSnapshot,
} from "../performance";
import type { MemoryItem } from "../../../../domain/types";

export type AutonomyLevel = "manual" | "assisted" | "balanced" | "autonomous";

export interface AutonomyPolicy {
  level: AutonomyLevel;
  explorationRatio: number;
  maxEstimatedCostUsd?: number;
  maxGenerationsPerDay?: number;
  maxRepairsPerProduction?: number;
  minQualityConfidence?: number;
  requireApprovalAboveCostUsd?: number;
  allowPublication?: boolean;
  contentPolicyTags?: string[];
}

export const DEFAULT_AUTONOMY_POLICY: AutonomyPolicy = {
  level: "balanced",
  explorationRatio: 0.2,
  maxEstimatedCostUsd: 25,
  maxGenerationsPerDay: 20,
  maxRepairsPerProduction: 6,
  minQualityConfidence: 0.35,
  requireApprovalAboveCostUsd: 15,
  allowPublication: false,
};

export type AutonomyGateDecision =
  | "proceed"
  | "explore"
  | "escalate_human_review"
  | "pause_budget"
  | "pause_quality"
  | "block_policy";

export interface AutonomyGateResult {
  decision: AutonomyGateDecision;
  reasons: string[];
  policy: AutonomyPolicy;
  estimatedCostUsd?: number;
  confidence?: number;
}

export interface HardConstraintSet {
  lockedCharacterAppearance?: boolean;
  lockedCharacterIds?: string[];
  continuityLocks?: string[];
  storyRequirements?: string[];
  legalConstraints?: string[];
  technicalConstraints?: string[];
  explicitUserInstructions?: string[];
  approvedReferenceIds?: string[];
}

export interface LearningSnapshot {
  id: string;
  version: number;
  createdAt: string;
  learningIds: string[];
  learnings: CreativeLearning[];
  notes?: string[];
}

export interface DecisionRecord {
  id: string;
  at: string;
  kind:
    | "autonomy_gate"
    | "adaptive_advice"
    | "strategy_influence"
    | "provider_preference"
    | "repair_preference"
    | "experiment_assignment"
    | "escalation"
    | "learning_update";
  decision: string;
  reason: string;
  inputs?: string[];
  evidenceIds?: string[];
  confidence?: number;
  policy?: string;
  alternatives?: string[];
  selectedAction?: string;
  learningSnapshotId?: string;
  productionId?: string;
}

export interface ProductionOutcomeRecord {
  productionId: string;
  productionVersion?: string;
  creativeStrategyVersion?: string;
  learningSnapshotVersion?: number;
  genre?: string;
  format?: string;
  platform?: string;
  durationSec?: number;
  aspectRatio?: string;
  hookType?: string;
  openingPattern?: string;
  pacingProfile?: string;
  shotDensity?: string;
  characterCount?: number;
  locationCount?: number;
  visualTreatment?: string;
  providers?: string[];
  models?: string[];
  candidateCount?: number;
  repairCount?: number;
  qcFailureCodes?: string[];
  estimatedCost?: number;
  actualCost?: number;
  generationDurationMs?: number;
  productionDurationMs?: number;
  masterVersion?: string;
  publicationIds?: string[];
  qualityScore?: number;
  /** Missing metrics stay undefined (= UNKNOWN), never coerced to 0 */
  audiencePerformanceScore?: number;
  deliverableReady?: boolean;
  completed?: boolean;
  failedStage?: string;
  failureCause?: string;
  createdAt: string;
}

export interface AutonomousPlan {
  objective: string;
  strategySummary: string;
  relevantLearning: CreativeLearning[];
  advice: AdaptiveStrategyAdvice;
  experiments: string[];
  expectedCostUsd?: number;
  risks: string[];
  confidence: number;
  learningSnapshot: LearningSnapshot;
  gate: AutonomyGateResult;
  decisions: DecisionRecord[];
}

export interface LearningUpdateInput {
  productionId: string;
  snapshots: PerformanceSnapshot[];
  reliability?: Array<{
    strategyKey: string;
    generationStrategy?: string;
    attempts: number;
    successes: number;
    retries: number;
    qcFailureCodes?: string[];
    providerId?: string;
    modelId?: string;
    modelVersion?: string;
  }>;
  repairOutcomes?: Array<{
    failureCode: string;
    repairStrategy: string;
    success: boolean;
    provider?: string;
    model?: string;
  }>;
  priorLearnings?: CreativeLearning[];
  scope?: CreativeLearning["scope"];
  scopeKey?: string;
  platform?: string;
  seriesId?: string;
  accountId?: string;
  brandId?: string;
  hardConstraints?: HardConstraintSet;
  now?: Date;
  productionQualityScore?: number;
  qcFailureCodes?: string[];
  outcome?: Partial<ProductionOutcomeRecord>;
  explicitUserInstructions?: string[];
}

export interface ProviderPreferenceSignal {
  capabilityProfile: string;
  providerId: string;
  modelId?: string;
  modelVersion?: string;
  successRate: number;
  sampleSize: number;
  confidence: number;
  preferenceDelta: number;
  notes: string[];
}

export interface RepairPreferenceSignal {
  failureClass: string;
  repairStrategy: string;
  successRate: number;
  sampleSize: number;
  confidence: number;
  notes: string[];
}

export interface LearningUpdateResult {
  analyses: unknown[];
  learnings: CreativeLearning[];
  advice: AdaptiveStrategyAdvice;
  memoryItems: MemoryItem[];
  quarantined: CreativeLearning[];
  snapshot: LearningSnapshot;
  decisions: DecisionRecord[];
  outcome: ProductionOutcomeRecord;
  providerPreferences: ProviderPreferenceSignal[];
  repairPreferences: RepairPreferenceSignal[];
}

export type { CreativeLearning, AdaptiveStrategyAdvice, PerformanceSnapshot, MemoryItem };
