/**
 * Media Capability / Provider Intelligence — Phase 3 contracts.
 *
 * Facts ≠ preferences ≠ observed performance ≠ economics ≠ health.
 * Skills (Phase 2) and cinematography routing remain separate concerns.
 * Answers: what can SPARK actually execute, conservatively.
 */

export type MediaModality = "image" | "video" | "audio" | "text";

export type GenerationMode =
  | "text_to_image"
  | "image_to_image"
  | "text_to_video"
  | "image_to_video"
  | "video_to_video"
  | "video_extension"
  | "video_continuation"
  | "audio_generation"
  | "text_to_speech"
  | "speech_to_speech";

export type ReferenceType =
  | "character"
  | "face"
  | "body"
  | "wardrobe"
  | "prop"
  | "location"
  | "environment"
  | "style"
  | "composition"
  | "image"
  | "video";

export type CameraControlLevel = "none" | "prompt_only" | "structured";
export type MotionControlLevel = "none" | "prompt_only" | "structured";

export type CapabilityProvenanceSource =
  | "provider_documentation"
  | "adapter"
  | "runtime_observation"
  | "configuration"
  | "manual_verification";

export type CapabilityConfidence =
  | "verified"
  | "probable"
  | "observed"
  | "unknown"
  | "deprecated";

export type RoutingObjective =
  | "quality_first"
  | "balanced"
  | "cost_first"
  | "speed_first"
  | "reliability_first";

export type FallbackQuality = "exact" | "compatible" | "degraded" | "unavailable";

export type RoutingReasonCode =
  | "CAPABILITY_MATCH"
  | "PREFERRED_PROVIDER"
  | "PREFERRED_MODEL"
  | "LOWER_COST"
  | "HIGHER_RELIABILITY"
  | "LOWER_LATENCY"
  | "HIGHER_QUALITY"
  | "HEALTHY_PROVIDER"
  | "ADAPTER_SUPPORTED"
  | "MANUAL_OVERRIDE"
  | "REJECTED_MISSING_START_FRAME"
  | "REJECTED_MISSING_END_FRAME"
  | "REJECTED_MISSING_START_AND_END"
  | "REJECTED_UNSUPPORTED_DURATION"
  | "REJECTED_UNSUPPORTED_ASPECT_RATIO"
  | "REJECTED_MISSING_REFERENCE_SUPPORT"
  | "REJECTED_INSUFFICIENT_REFERENCES"
  | "REJECTED_UNSUPPORTED_MODE"
  | "REJECTED_PROVIDER_UNHEALTHY"
  | "REJECTED_ADAPTER_UNSUPPORTED"
  | "REJECTED_MANUAL_MISMATCH"
  | "REJECTED_CONTINUATION_UNSUPPORTED"
  | "REJECTED_EXTENSION_UNSUPPORTED"
  | "CAPABILITY_CONFLICT"
  | "FALLBACK_SELECTED"
  | "NO_COMPATIBLE_CANDIDATE";

export interface CapabilityProvenance {
  source: CapabilityProvenanceSource;
  confidence: CapabilityConfidence;
  verifiedAt?: string;
  modelVersion?: string;
  notes?: string;
  staleAfterDays?: number;
}

export interface ReferenceCapabilitySet {
  supportedTypes: ReferenceType[];
  maxReferences?: number;
  supportsMultipleReferences: boolean;
  supportsTypedReferences?: boolean;
  supportsReferenceOrdering?: boolean;
  supportsReferenceWeighting?: boolean;
  provenance: CapabilityProvenance;
}

export interface TemporalCapabilitySet {
  supportsStartFrame: boolean;
  supportsEndFrame: boolean;
  supportsStartAndEndFrame: boolean;
  supportsTailFrame: boolean;
  supportsPreviousShotFrame: boolean;
  supportsVideoContinuation: boolean;
  supportsVideoExtension: boolean;
  supportsPreviousVideoAsInput: boolean;
  supportsLastFrameContinuation: boolean;
  provenance: CapabilityProvenance;
}

export interface CameraCapabilitySet {
  controlLevel: CameraControlLevel;
  movements?: string[];
  provenance: CapabilityProvenance;
}

export interface MotionCapabilitySet {
  controlLevel: MotionControlLevel;
  supportsMotionStrength?: boolean;
  supportsMotionPresets?: boolean;
  supportsSubjectMotionControl?: boolean;
  supportsCameraMotionControl?: boolean;
  provenance: CapabilityProvenance;
}

export interface OutputCapabilitySet {
  duration?: {
    minSeconds?: number;
    maxSeconds?: number;
    supportedValues?: number[];
  };
  aspectRatios?: string[];
  resolutions?: string[];
  maxWidth?: number;
  maxHeight?: number;
  frameRates?: number[];
  supportsNativeAudio?: boolean;
  provenance: CapabilityProvenance;
}

export interface AudioCapabilitySet {
  nativeAudioGeneration?: boolean;
  speech?: boolean;
  music?: boolean;
  soundEffects?: boolean;
  ambient?: boolean;
  audioInput?: boolean;
  audioConditionedGeneration?: boolean;
  audioSynchronization?: boolean;
  provenance: CapabilityProvenance;
}

export interface ExecutionCapabilitySet {
  mode: "sync" | "async" | "both";
  supportsPolling: boolean;
  supportsWebhooks: boolean;
  supportsCancellation?: boolean;
  supportsBatch?: boolean;
  supportsStreaming?: boolean;
  returnsInlineBinary?: boolean;
  returnsTemporaryUrl?: boolean;
  returnsPersistentUrl?: boolean;
  urlExpirationKnown?: boolean;
  requiresDownloadBeforePersistence?: boolean;
  provenance: CapabilityProvenance;
}

export interface ControlCapabilitySet {
  seed?: boolean;
  negativePrompt?: boolean;
  guidance?: boolean;
  promptStrength?: boolean;
  imageStrength?: boolean;
  motionStrength?: boolean;
  referenceStrength?: boolean;
  styleStrength?: boolean;
  provenance: CapabilityProvenance;
}

export interface CapabilityLimits {
  maxPromptLength?: number;
  maxImageBytes?: number;
  maxVideoBytes?: number;
  maxReferenceBytes?: number;
  maxReferenceCount?: number;
  maxDurationSec?: number;
  maxBatchSize?: number;
  supportedInputFormats?: string[];
  supportedOutputFormats?: string[];
}

export interface CapabilityEconomics {
  /** Only set when authoritative config exists — never invented. */
  estimatedCreditsPerGeneration?: number;
  estimatedUsdPerGeneration?: number;
  costPerSecond?: number;
  costPerImage?: number;
  currency?: "USD" | "credits";
  known: boolean;
  notes?: string;
}

export interface MediaCapabilityProfile {
  providerId: string;
  modelId: string;
  version?: string;
  displayName: string;
  modalities: MediaModality[];
  generationModes: GenerationMode[];
  references: ReferenceCapabilitySet;
  temporal: TemporalCapabilitySet;
  camera: CameraCapabilitySet;
  motion: MotionCapabilitySet;
  output: OutputCapabilitySet;
  audio: AudioCapabilitySet;
  execution: ExecutionCapabilitySet;
  controls: ControlCapabilitySet;
  limits: CapabilityLimits;
  economics?: CapabilityEconomics;
  /** Adapter-level claim (what SPARK can actually send today). */
  adapterSupported: boolean;
  metadata?: {
    tags?: string[];
    deprecated?: boolean;
    notes?: string;
  };
}

export interface CapabilityRequirements {
  modality: MediaModality;
  generationMode?: GenerationMode;
  references?: {
    types: ReferenceType[];
    minimumCount?: number;
  };
  temporal?: {
    requiresStartFrame?: boolean;
    requiresEndFrame?: boolean;
    requiresStartAndEnd?: boolean;
    requiresContinuation?: boolean;
    requiresExtension?: boolean;
  };
  camera?: {
    requiresCameraControl?: boolean;
    preferredMovements?: string[];
    minimumControlLevel?: CameraControlLevel;
  };
  motion?: {
    minimumControlLevel?: MotionControlLevel;
  };
  output?: {
    durationSeconds?: number;
    aspectRatio?: string;
    resolution?: string;
    frameRate?: number;
    requiresNativeAudio?: boolean;
  };
  audio?: {
    required?: boolean;
  };
  execution?: {
    requiresAsync?: boolean;
    requiresCancellation?: boolean;
    requiresBatch?: boolean;
  };
  /** Soft preferences — never cause hard rejection alone. */
  preferences?: {
    objective?: RoutingObjective;
    preferredProviderId?: string;
    preferredModelId?: string;
    manualOverride?: boolean;
  };
}

export interface CapabilityMismatch {
  code: RoutingReasonCode;
  requirement: string;
  detail: string;
  hard: boolean;
}

export interface CapabilityMatchItem {
  requirement: string;
  satisfied: boolean;
}

export interface CapabilityWarning {
  code: string;
  message: string;
}

export interface CapabilityMatchResult {
  compatible: boolean;
  hardRequirementsSatisfied: boolean;
  matched: CapabilityMatchItem[];
  missing: CapabilityMismatch[];
  unsupported: CapabilityMismatch[];
  warnings: CapabilityWarning[];
  conflicts: CapabilityMismatch[];
  adaptationRequired?: boolean;
  reasonCodes: RoutingReasonCode[];
}

export interface ProviderHealthSnapshot {
  providerId: string;
  status: "healthy" | "degraded" | "error" | "disabled" | "unknown";
  latencyMs?: number;
  errorRate?: number;
  lastCheck?: string;
}

export interface ProviderPerformanceSnapshot {
  successRate?: number;
  averageLatencyMs?: number;
  p95LatencyMs?: number;
  qualityScore?: number;
  sampleSize?: number;
  known: boolean;
}

export interface ProviderModelCandidate {
  providerId: string;
  modelId: string;
  version?: string;
  profile: MediaCapabilityProfile;
  /** Effective = provider ∩ adapter ∩ config (conservative). */
  effective: MediaCapabilityProfile;
  health?: ProviderHealthSnapshot;
  performance?: ProviderPerformanceSnapshot;
  economics?: CapabilityEconomics;
}

export interface RoutingScoreBreakdown {
  capabilityFit: number;
  quality: number;
  reliability: number;
  latency: number;
  cost: number;
  preference: number;
  health: number;
  finalScore: number;
}

export interface CandidateRejection {
  candidate: Pick<ProviderModelCandidate, "providerId" | "modelId">;
  reasonCodes: RoutingReasonCode[];
  mismatches: CapabilityMismatch[];
}

export interface FallbackPlanEntry {
  candidate: Pick<ProviderModelCandidate, "providerId" | "modelId">;
  quality: FallbackQuality;
  reasonCodes: RoutingReasonCode[];
  score: number;
}

export interface MediaRoutingDecision {
  selected?: ProviderModelCandidate;
  rejected: CandidateRejection[];
  scoreBreakdown?: RoutingScoreBreakdown;
  capabilityMatch?: CapabilityMatchResult;
  fallbackPlan: FallbackPlanEntry[];
  reasonCodes: string[];
  objective: RoutingObjective;
}
