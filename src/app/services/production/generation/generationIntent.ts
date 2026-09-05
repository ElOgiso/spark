/**
 * Phase 6 — provider-neutral GenerationIntent contracts.
 * ShotSpec remains canonical; storyboard/preproduction feed this layer.
 */

import type { GenerationStrategySpec } from "../specification/generationStrategy";
import type { ReferenceManifest, VideoGenerationIntent } from "../preproduction/types";

export type GenerationQualityMode = "previs" | "standard" | "high_quality";
export type ConstraintKind = "hard" | "soft";

export interface GenerationConstraint {
  id: string;
  kind: ConstraintKind;
  category:
    | "identity"
    | "product"
    | "aspect_ratio"
    | "duration"
    | "continuity"
    | "delivery"
    | "camera"
    | "lighting"
    | "style"
    | "motion"
    | "provider"
    | "cost"
    | "other";
  description: string;
  capability?: string;
}

export interface ShotHandoffState {
  subjectPosition: string;
  cameraPosition: string;
  screenDirection?: string;
  gaze?: string;
  lighting: string;
  wardrobe?: string[];
  propState?: string[];
  notes: string[];
}

export interface CandidatePolicy {
  riskScore: number;
  riskLevel: "low" | "medium" | "high";
  riskFactors: string[];
  recommendedCandidateCount: number;
  qualityMode: GenerationQualityMode;
  preferStrongerProvider: boolean;
  preferMoreReferences: boolean;
}

export interface GenerationIntentTrace {
  productionId: string;
  sceneId: string;
  shotId: string;
  storyboardId?: string;
  panelId?: string;
  referenceManifestId?: string;
  intentId: string;
  generationTaskIds?: string[];
  providerId?: string;
  modelVersion?: string;
  candidateId?: string;
  assetId?: string;
  qcResultId?: string;
}

export interface GenerationIntent {
  id: string;
  productionId: string;
  sceneId: string;
  shotId: string;
  storyboardId?: string;
  panelId?: string;

  purpose: string;
  dramaticBeat: string;
  visualObjective: string;

  appearanceIntent: VideoGenerationIntent["appearance"];
  motionIntent: VideoGenerationIntent["motion"];
  cameraIntent: VideoGenerationIntent["camera"];
  lightingIntent: string;
  visualTreatmentSummary: string;

  durationSec: number;
  temporalBeat: string;
  startState: ShotHandoffState;
  endState: ShotHandoffState;
  transitionIn?: string;
  transitionOut?: string;

  referenceManifest: ReferenceManifest;
  continuityRequirements: string[];

  capabilityRequirements: string[];
  hardConstraints: GenerationConstraint[];
  softPreferences: GenerationConstraint[];

  generationMode: GenerationQualityMode;
  candidatePolicy: CandidatePolicy;
  strategy: GenerationStrategySpec;

  aspectRatio: string;
  deliveryRequirements?: string[];
  dependencies: string[];
  rationale: string[];
  confidence: number;
  assumptions: string[];

  videoIntent: VideoGenerationIntent;
  trace: GenerationIntentTrace;
}

export interface CapabilityResolutionIssue {
  capability: string;
  severity: "hard" | "soft";
  message: string;
  constraintId?: string;
}

export type DegradationAction =
  | "none"
  | "fallback_provider"
  | "reduced_capability_mode"
  | "drop_soft_preference"
  | "block";

export interface CapabilityResolutionResult {
  ok: boolean;
  providerId: string | null;
  modelId?: string;
  fallbackProviders: string[];
  matchedCapabilities: string[];
  missingHard: CapabilityResolutionIssue[];
  missingSoft: CapabilityResolutionIssue[];
  degradation: {
    action: DegradationAction;
    reasons: string[];
    droppedSoftPreferences: string[];
  };
  score: number;
}

export type GenerationFailureClass =
  | "unsupported_capability"
  | "reference_conflict"
  | "missing_reference"
  | "invalid_duration"
  | "invalid_aspect_ratio"
  | "provider_unavailable"
  | "provider_timeout"
  | "provider_rate_limit"
  | "invalid_request"
  | "generation_failure"
  | "continuity_dependency_unavailable"
  | "unknown";

export type GenerationFailureResolution =
  | "retry"
  | "fallback_provider"
  | "fallback_generation_strategy"
  | "repair_intent"
  | "request_missing_prerequisite"
  | "block_shot";

export interface GenerationFailurePlan {
  classification: GenerationFailureClass;
  resolution: GenerationFailureResolution;
  retryable: boolean;
  message: string;
  metadata?: Record<string, string>;
}

export interface GenerationCandidateRankingContract {
  candidateId: string;
  shotId: string;
  generationTaskId: string;
  scores: {
    identityFidelity: number;
    referenceAdherence: number;
    composition: number;
    cinematicIntent: number;
    motionQuality: number;
    continuity: number;
    temporalStability: number;
    artifactRate: number;
    styleConsistency: number;
    technicalValidity: number;
    promptAdherence: number;
  };
  overall: number;
  strengths: string[];
  weaknesses: string[];
  source: "qc" | "heuristic" | "manual";
}
