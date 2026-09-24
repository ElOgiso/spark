/**
 * SPARK PHASE 16 — CANONICAL VIDEO UNDERSTANDING CONTRACTS
 *
 * Core architectural law:
 * SPARK OWNS MEANING. PROVIDERS OWN EXECUTION.
 *
 * A single canonical evidence-based video understanding model that serves:
 * - Research (via ResearchAdapter -> VideoResearch)
 * - ReferenceGraph (via ReferenceGraphMapper -> ReferenceNode)
 * - Production Planning (via PlanningGuidanceMapper)
 * - Craft (via CraftEvidenceMapper)
 * - QC & Visual Analysis (via QcMapper -> ObservedVisualState)
 * - Continuity (via ContinuityEvidence)
 *
 * One understanding layer. Multiple consumers. Zero duplicate intelligence stacks.
 */

import type { ContinuityState } from "../specification/continuitySpec";

/**
 * Source media abstraction.
 * Unifies public web video URLs, uploaded user reference assets,
 * production library assets, and SPARK-generated video outputs.
 */
export type VideoUnderstandingSource =
  | { kind: "public_url"; url: string; platform?: string; videoId?: string }
  | { kind: "production_asset"; assetId: string; url: string; mediaType?: string; metadata?: Record<string, unknown> }
  | { kind: "reference_asset"; referenceId: string; url: string; label?: string; metadata?: Record<string, unknown> }
  | { kind: "generated_video"; shotId?: string; taskId?: string; url: string; metadata?: Record<string, unknown> };

/**
 * Strict provenance classification.
 * Distinguishes direct visual observations from transcript inference or model speculation.
 */
export type EvidenceProvenance =
  | "OBSERVED"
  | "TRANSCRIPT_DERIVED"
  | "MODEL_INFERRED"
  | "METADATA_DERIVED"
  | "UNKNOWN";

/**
 * Frame evidence type classification.
 * Prevents generic thumbnail images from masquerading as true temporal video frames.
 */
export type FrameEvidenceType =
  | "thumbnail"
  | "representative_frame"
  | "timestamped_extracted_frame"
  | "user_supplied_frame";

/**
 * Atomic reference to supporting evidence.
 */
export interface EvidenceReference {
  type: FrameEvidenceType | "transcript" | "metadata" | "audio";
  url?: string;
  timestampSec?: number;
  description?: string;
  provenance: EvidenceProvenance;
  confidence: number;
}

/**
 * Observed subject in the video (person, character, object, location, etc.).
 * Does NOT infer specific personal identity beyond available factual evidence.
 */
export interface ObservedSubject {
  id?: string;
  category: "person" | "character" | "product" | "object" | "location" | "unknown";
  label: string;
  confidence: number;
  appearance?: string;
  role?: "primary" | "secondary" | "background";
  provenance?: EvidenceProvenance;
}

/**
 * Concrete action observed during a time window.
 */
export interface ObservedAction {
  description: string;
  subjectLabel?: string;
  confidence: number;
  intensity?: "low" | "medium" | "high";
  provenance?: EvidenceProvenance;
}

/**
 * Tangible object or prop observed.
 */
export interface ObservedObject {
  label: string;
  state?: string;
  position?: string;
  importance?: "primary" | "secondary" | "background";
  confidence: number;
  provenance?: EvidenceProvenance;
}

/**
 * Camera and cinematography observations.
 * Uses provider-neutral terminology.
 */
export interface ObservedCameraState {
  shotType?: string;
  cameraMovement?: string;
  cameraAngle?: string;
  framing?: string;
  position?: string;
  perspective?: string;
  confidence: number;
  provenance?: EvidenceProvenance;
}

/**
 * Spatial composition observations.
 */
export interface ObservedCompositionState {
  layout?: string;
  subjectPlacement?: string;
  depth?: "shallow" | "deep" | "moderate";
  ruleOfThirds?: boolean;
  foregroundBackgroundSeparation?: boolean;
  confidence: number;
  provenance?: EvidenceProvenance;
}

/**
 * Disaggregated motion observations.
 * CRITICAL RULE: Distinguishes subject motion, camera motion, and environmental motion.
 */
export interface ObservedMotionState {
  cameraMotion?: string;
  subjectMotion?: string;
  environmentMotion?: string;
  environmentalMotion?: string;
  overallPacing?: string;
  overallIntensity?: string;
  motionOccurred: boolean;
  confidence: number;
  provenance?: EvidenceProvenance;
}

/**
 * Lighting conditions.
 */
export interface ObservedLightingState {
  mood?: string;
  direction?: string;
  quality?: "high_key" | "low_key" | "natural" | "diffused" | "hard" | "practical" | "studio";
  timeOfDay?: string;
  colorTemperature?: string;
  confidence: number;
  provenance?: EvidenceProvenance;
}

/**
 * Visual styling and aesthetic language.
 */
export interface ObservedStyleState {
  visualStyle?: string;
  lookPreset?: string;
  aesthetic?: string;
  texture?: string;
  confidence: number;
  provenance?: EvidenceProvenance;
}

/**
 * Spoken audio / speech observations.
 */
export interface ObservedSpeechState {
  spokenText?: string;
  speakerTiming?: Array<{ startSec: number; endSec: number; speaker?: string; text: string }>;
  speechType?: "dialogue" | "narration" | "voiceover" | "mixed";
  speechPresent: boolean;
  language?: string;
  confidence: number;
  provenance?: EvidenceProvenance;
}

/**
 * Non-speech audio elements.
 */
export interface ObservedAudioState {
  speechPresent: boolean;
  musicPresent: boolean;
  sfxPresent: boolean;
  ambiencePresent: boolean;
  primaryElement?: "speech" | "music" | "sfx" | "silence";
  confidence: number;
  provenance?: EvidenceProvenance;
}

/**
 * Visual state at a temporal boundary (e.g. start or end of a segment/shot).
 * Essential for video-to-video continuity and last-frame chaining.
 */
export interface ObservedBoundaryState {
  visualState: string;
  subjectPosition?: string;
  cameraFraming?: string;
  keyObjects?: string[];
  lightingMood?: string;
  confidence: number;
  provenance?: EvidenceProvenance;
}

/**
 * Discrete temporal segment of a video.
 * Defined by non-overlapping time boundaries [startSec, endSec).
 */
export interface VideoUnderstandingSegment {
  segmentIndex: number;
  startSec: number;
  endSec: number;
  durationSec: number;

  subjects: ObservedSubject[];
  actions: ObservedAction[];
  objects: ObservedObject[];

  camera?: ObservedCameraState;
  composition?: ObservedCompositionState;
  motion?: ObservedMotionState;
  lighting?: ObservedLightingState;
  style?: ObservedStyleState;

  speech?: ObservedSpeechState;
  audio?: ObservedAudioState;

  startState?: ObservedBoundaryState;
  endState?: ObservedBoundaryState;

  confidence: number;
  evidence: EvidenceReference[];
}

/**
 * Canonical structured video understanding result.
 * Complete provider-neutral representation of what was observed in the video.
 */
export interface StructuredVideoUnderstanding {
  id: string;
  source: VideoUnderstandingSource;
  durationSec?: number;

  /** Ordered non-overlapping temporal segments */
  segments: VideoUnderstandingSegment[];

  transcript?: {
    text?: string;
    language?: string;
    confidence?: number;
    isAutoGenerated?: boolean;
  };

  /** Synthesized overall video observations */
  summary: {
    subjects: ObservedSubject[];
    objects: ObservedObject[];
    visualStyle?: ObservedStyleState;
    cameraSummary?: ObservedCameraState;
    motionSummary?: ObservedMotionState;
    lightingSummary?: ObservedLightingState;
    audio?: ObservedAudioState;
    narrativeSummary?: string;
  };

  evidence: EvidenceReference[];

  /** Overall analytical confidence (0.0 to 1.0) */
  confidence: number;

  /** Explicit reasons when visual facts could not be established */
  limitations: string[];

  createdAt: string;
}

/**
 * Execution interface for multimodal AI models (Gemini, OpenAI, or deterministic fixtures).
 */
export interface MultimodalAnalysisInput {
  prompt: string;
  systemInstruction?: string;
  frameUrls?: string[];
  transcript?: string;
  metadata?: Record<string, unknown>;
}

export interface VideoUnderstandingExecutionProvider {
  name: string;
  analyze(input: MultimodalAnalysisInput): Promise<{
    rawResponse: string;
    parsedJson?: any;
    providerCostUsd?: number;
  }>;
}

export interface UnderstandVideoOptions {
  provider?: VideoUnderstandingExecutionProvider;
  userRoutingConfig?: any;
  /** Injected frame URLs for offline or test environments */
  injectedFrames?: string[];
  /** Injected transcript for offline or test environments */
  injectedTranscript?: string;
  durationSec?: number;
}
