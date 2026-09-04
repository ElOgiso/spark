/**
 * Phase 8 — Canonical Performance Learning contracts (provider-neutral).
 * Quality (Phase 5) and AudiencePerformance remain distinct.
 */

/** Canonical metric vocabulary — platforms may omit any of these */
export type CanonicalMetricKey =
  | "impressions"
  | "reach"
  | "views"
  | "watch_time"
  | "average_view_duration"
  | "completion_rate"
  | "retention"
  | "likes"
  | "comments"
  | "shares"
  | "saves"
  | "followers_gained"
  | "clicks"
  | "conversions"
  | "engagement_rate";

export type MetricAvailability = "available" | "unavailable" | "not_applicable" | "estimated";

export type MetricKind = "absolute" | "rate" | "ratio" | "platform_native" | "cross_platform_comparable";

export type PerformanceWindowId =
  | "first_hour"
  | "first_6_hours"
  | "first_24_hours"
  | "first_3_days"
  | "first_7_days"
  | "first_30_days"
  | "lifetime"
  | string;

export type EvidenceStrength = "observed" | "correlated" | "likely" | "uncertain" | "insufficient_data";

export type LearningScope =
  | "global"
  | "platform"
  | "account"
  | "brand"
  | "series"
  | "content_pillar"
  | string;

export type LearningPatternKind =
  | "hook_pattern"
  | "format_pattern"
  | "duration_pattern"
  | "audience_pattern"
  | "platform_pattern"
  | "brand_pattern"
  | "character_pattern"
  | "audio_pattern"
  | "editing_pattern"
  | "failure_pattern"
  | "series_pattern"
  | "reliability_pattern"
  | string;

export type DiagnosisCode =
  | "strong_hook"
  | "weak_hook"
  | "strong_retention"
  | "weak_retention"
  | "strong_shareability"
  | "weak_shareability"
  | "strong_conversion"
  | "weak_conversion"
  | "audience_mismatch"
  | "format_mismatch"
  | "duration_mismatch"
  | "weak_payoff"
  | "strong_payoff"
  | "strong_brand_fit"
  | "weak_brand_fit"
  | "mixed_signals"
  | "insufficient_evidence"
  | "strong_engagement"
  | "weak_engagement"
  | string;

export interface PerformanceMetric {
  key: CanonicalMetricKey | string;
  value?: number;
  unit?: string;
  availability: MetricAvailability;
  kind: MetricKind;
  /** Platform-native key when mapped from raw */
  sourceKey?: string;
  confidence?: number;
}

export interface PerformanceContext {
  productionId?: string;
  contentId?: string;
  publicationId?: string;
  platform?: string;
  accountId?: string;
  accountHandle?: string;
  brandId?: string;
  seriesId?: string;
  contentPillar?: string;
  creativeStrategyId?: string;
  format?: string;
  hookType?: string;
  pacingModel?: string;
  audiencePrimary?: string;
  durationSec?: number;
  aspectRatio?: string;
  characterId?: string;
  niche?: string;
  audioStrategy?: string;
  productionComplexity?: string;
  generationStrategy?: string;
  editorialStrategy?: string;
  publishedAt?: string;
  /** Phase 5 QC summary refs — not equated with audience performance */
  productionQualityScore?: number;
  productionIssueCodes?: string[];
}

export interface PerformanceSnapshot {
  id: string;
  productionId?: string;
  contentId?: string;
  platform: string;
  accountId?: string;
  publicationId?: string;
  timestamp: string;
  window: PerformanceWindowId;
  metrics: PerformanceMetric[];
  context?: PerformanceContext;
  /** Opaque raw payload kept separate from normalized intelligence */
  rawProvenance?: {
    source: string;
    syncedAt?: string;
    recordKey?: string;
  };
  confidence: number;
  completeness: number;
}

export interface PerformanceObservation {
  id: string;
  snapshotId: string;
  metricKey: CanonicalMetricKey | string;
  value?: number;
  availability: MetricAvailability;
  window: PerformanceWindowId;
  observedAt: string;
  contextRefs: Partial<PerformanceContext>;
}

export interface PerformanceSeries {
  id: string;
  productionId?: string;
  contentId?: string;
  platform: string;
  accountId?: string;
  snapshots: PerformanceSnapshot[];
  windowsCovered: PerformanceWindowId[];
}

export interface RetentionSegment {
  startSec: number;
  endSec: number;
  retentionRate?: number;
  dropOffRate?: number;
  availability: MetricAvailability;
  label?: string;
}

export interface RetentionAnalysis {
  segments: RetentionSegment[];
  openingDropOff?: number;
  earlyRetention?: number;
  midVideoDrop?: number;
  lateVideoDrop?: number;
  completionRate?: number;
  rewatchSignal?: number;
  interestLossHints: string[];
  strength: EvidenceStrength;
  explanation: string;
}

/** Extensible creative characteristics — prefer strategy IDs over full duplication */
export interface CreativeDNA {
  strategyId?: string;
  dimensions: Record<string, string | number | boolean | undefined>;
  hookType?: string;
  openingStyle?: string;
  narrativeStructure?: string;
  pacingProfile?: string;
  visualStyle?: string;
  format?: string;
  durationSec?: number;
  emotionalArc?: string;
  topic?: string;
  audience?: string;
  ctaType?: string;
  characterUsage?: string;
  audioStyle?: string;
  editingDensity?: string;
  aspectRatio?: string;
  platformHints?: string[];
}

export interface PerformanceDiagnosis {
  code: DiagnosisCode;
  strength: EvidenceStrength;
  metricKeys: string[];
  summary: string;
  relatedDnaKeys?: string[];
}

export interface PerformanceAnalysis {
  id: string;
  snapshotId: string;
  productionId?: string;
  whatHappened: string;
  performedWell: string[];
  underperformed: string[];
  strongSignals: string[];
  weakSignals: string[];
  uncertain: string[];
  likelyContributors: Array<{ factor: string; strength: EvidenceStrength; note: string }>;
  nextTests: string[];
  diagnoses: PerformanceDiagnosis[];
  retention?: RetentionAnalysis;
  audiencePerformance: AudiencePerformanceSummary;
  productionQuality?: ProductionQualitySummary;
  confidence: number;
  explanations: string[];
  evidenceStrength: EvidenceStrength;
}

/** Audience outcomes — never auto-equated with production QC */
export interface AudiencePerformanceSummary {
  score?: number;
  label: "strong" | "mixed" | "weak" | "unknown";
  primaryMetrics: string[];
  notes: string[];
}

export interface ProductionQualitySummary {
  score?: number;
  label: "high" | "mixed" | "low" | "unknown";
  issueCodes: string[];
  notes: string[];
}

export interface LearningConfidence {
  score: number;
  evidenceCount: number;
  recency: number;
  consistency: number;
  scope: LearningScope;
}

export interface CreativeLearning {
  id: string;
  kind: LearningPatternKind;
  scope: LearningScope;
  scopeKey?: string;
  claim: string;
  recommendation?: string;
  confidence: LearningConfidence;
  evidenceCount: number;
  supportingObservationIds: string[];
  supportingSnapshotIds: string[];
  productionIds?: string[];
  provenance: LearningProvenance;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  reviewAfterAt?: string;
  supersededBy?: string;
  stale?: boolean;
  explorationHint?: boolean;
}

export interface LearningProvenance {
  evidenceType: "account_specific" | "platform" | "market" | "production_reliability" | "mixed";
  observationIds: string[];
  snapshotIds: string[];
  strategyIds?: string[];
  notes?: string[];
}

export interface SeriesPattern {
  seriesId: string;
  episodeIds: string[];
  recurringHookTypes: string[];
  recurringSubjects: string[];
  recurringStructures: string[];
  progressionNotes: string[];
  diminishingReturns?: boolean;
  continuationOpportunity?: boolean;
  evidenceCount: number;
  confidence: number;
}

export type ExperimentVariable =
  | "hook_type"
  | "duration"
  | "opening_visual"
  | "narrative_structure"
  | "cta"
  | "pacing"
  | "thumbnail"
  | "caption"
  | "posting_timing"
  | "format"
  | string;

export interface ExperimentVariant {
  id: string;
  label: string;
  variableValue: string;
  isControl?: boolean;
  observationIds?: string[];
  snapshotIds?: string[];
}

export interface Experiment {
  id: string;
  hypothesis: string;
  variable: ExperimentVariable;
  control: ExperimentVariant;
  variants: ExperimentVariant[];
  targetMetric: CanonicalMetricKey | string;
  scope: LearningScope;
  scopeKey?: string;
  status: "planned" | "running" | "completed" | "inconclusive";
  createdAt: string;
  notes?: string[];
}

export interface ExperimentResult {
  experimentId: string;
  baselineValue?: number;
  variantValues: Record<string, number | undefined>;
  observations: number;
  confidence: number;
  statisticallyJustified: boolean;
  strength: EvidenceStrength;
}

export interface ExperimentConclusion {
  experimentId: string;
  conclusion: string;
  nextAction: string;
  winnerVariantId?: string;
  strength: EvidenceStrength;
  result: ExperimentResult;
}

export interface ExplorationPolicy {
  exploitationWeight: number;
  explorationWeight: number;
  minEvidenceForExploit: number;
  preferProvenWhenConfidenceAbove: number;
}

export interface AdaptiveStrategyAdvice {
  evidence: CreativeLearning[];
  recommendations: string[];
  explorationSuggestions: string[];
  confidenceFloor: number;
  overriddenByExplicitUserIntent: boolean;
  notes: string[];
}

export interface ProductionReliabilitySignal {
  strategyKey: string;
  generationStrategy?: string;
  attemptCount: number;
  successCount: number;
  retryRate: number;
  qcFailureCodes: string[];
  firstPassSuccessRate: number;
  notes: string[];
}
