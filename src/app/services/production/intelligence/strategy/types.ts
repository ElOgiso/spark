/**
 * Phase 7 — Canonical Creative Strategy contracts.
 * Executive decisions above Phase 2–6 execution — provider-neutral.
 */

export type ConfidenceLevel = "high" | "medium" | "low" | "unknown";

export type FieldProvenance = "explicit" | "project" | "creator" | "brand" | "inferred" | "unknown";

export type OptimizationProfile = "quality_first" | "balanced" | "speed_first" | "cost_sensitive";

export type ProductionComplexityLevel = "simple" | "moderate" | "complex" | "high_complexity";

export type CreativeFormatId =
  | "talking_head"
  | "cinematic_narrative"
  | "documentary"
  | "explainer"
  | "advertisement"
  | "product_showcase"
  | "music_video"
  | "montage"
  | "interview"
  | "educational_short"
  | "social_commentary"
  | "trailer"
  | "story_driven_short"
  | "hybrid"
  | string;

export type CreativePreflightStatus = "ready" | "improve" | "clarify" | "blocked";

export interface DecisionExplanation {
  decision: string;
  reasons: string[];
  evidence: string[];
  confidence: number;
  alternatives: string[];
}

export interface AudienceProfile {
  primaryAudience: string;
  knowledgeLevel: "novice" | "intermediate" | "expert" | "unknown";
  intent: string;
  emotionalStartingPoint: string;
  desiredEmotionalOutcome: string;
  attentionCharacteristics: string[];
  platformBehaviorNotes: string[];
  confidence: number;
  provenance: FieldProvenance;
}

export interface HookStrategy {
  type: string;
  rationale: string;
  openingVisual: string;
  openingDialogue?: string;
  curiosityMechanism: string;
  expectedPayoff: string;
  confidence: number;
}

export interface PacingStrategy {
  model: string;
  openingBeat: string;
  escalation: string[];
  informationReveals: string[];
  visualChangePoints: string[];
  emotionalTurns: string[];
  tensionPoints: string[];
  payoff: string;
  ending: string;
  rationale: string;
  confidence: number;
}

export interface ProductionComplexity {
  level: ProductionComplexityLevel;
  estimatedScenes: number;
  estimatedShots: number;
  estimatedAssets: number;
  continuityRisk: "low" | "medium" | "high";
  generationRisk: "low" | "medium" | "high";
  rationale: string;
  simplificationApplied: boolean;
  simplificationNotes: string[];
}

export interface MasterReusePlan {
  requiredKinds: Array<
    | "character"
    | "location"
    | "wardrobe"
    | "prop"
    | "vehicle"
    | "creature"
    | "product"
    | "logo"
    | "style"
    | "voice"
    | "music"
  >;
  reuseRefs: string[];
  createNew: string[];
  notes: string[];
}

export interface CreativeObjective {
  subject: string;
  objective: string;
  subjectProvenance: FieldProvenance;
  objectiveProvenance: FieldProvenance;
  confidence: number;
}

export interface ClarificationRequest {
  id: string;
  field: string;
  question: string;
  whyNeeded: string;
  blocking: boolean;
}

export interface CreativeStrategyAlternative {
  id: string;
  label: string;
  format: CreativeFormatId;
  summary: string;
  whyNotPrimary: string;
}

export interface CreativeStrategy {
  id: string;
  objective: CreativeObjective;
  audience: AudienceProfile;
  platform: string[];
  format: CreativeFormatId;
  contentCategory: string;
  emotionalObjective: string;
  tone: string;
  hook: HookStrategy;
  narrativeStrategy: string;
  pacing: PacingStrategy;
  visualStrategy: string;
  audioStrategy: string;
  characterStrategy: string;
  retentionStrategy: string;
  payoff: string;
  callToAction?: string;
  durationTargetSec?: number;
  aspectRatio?: string;
  complexity: ProductionComplexity;
  riskLevel: "low" | "medium" | "high";
  originalityRequirements: string[];
  brandRequirements: string[];
  optimizationProfile: OptimizationProfile;
  masterReuse: MasterReusePlan;
  rationale: string[];
  confidence: number;
  explanations: DecisionExplanation[];
  alternatives: CreativeStrategyAlternative[];
  clarificationRequests: ClarificationRequest[];
  productionModeDetail: "concise" | "standard" | "rich";
  automationMode?: "manual" | "balanced" | "autonomous";
  userFacingSummary: string;
}

export interface CreativePreflightResult {
  status: CreativePreflightStatus;
  score: number;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  clarificationRequests: ClarificationRequest[];
  explanations: DecisionExplanation[];
}

export interface FailurePatternSummary {
  code: string;
  count: number;
  lastSeenAt?: string;
  relatedShotIds: string[];
}

export interface CreativeDiagnosis {
  patterns: FailurePatternSummary[];
  adjustments: Array<{
    kind:
      | "strengthen_references"
      | "simplify_blocking"
      | "change_generation_strategy"
      | "reduce_shot_count"
      | "simplify_camera"
      | "simplify_continuity"
      | "none";
    reason: string;
  }>;
  withinBudget: boolean;
  userFacingMessage: string;
}

/** Interface for performance feedback — implemented by Phase 8 performance module */
export interface CreativePerformanceFeedbackPort {
  getHints?(brandId?: string): Promise<{
    strongHooks?: string[];
    strongFormats?: string[];
    strongStyles?: string[];
    notes?: string[];
  }>;
}

/** Sync hint bag consumed by strategy builder (from memory / learnings) */
export interface CreativePerformanceHints {
  strongHooks?: string[];
  strongFormats?: string[];
  strongStyles?: string[];
  notes?: string[];
  /** When true, explicit user intent must win over learnings */
  explicitUserInstructions?: string[];
}
