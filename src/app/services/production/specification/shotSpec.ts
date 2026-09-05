/**
 * Shot-level canonical specification — fundamental unit of visual generation.
 */

import type { ShotFilmmakingGuidance } from "../knowledge/types";
import type { GenerationStrategySpec } from "./generationStrategy";
import type { GenerationTask } from "./generationTask";

export type ShotType =
  | "establishing"
  | "wide"
  | "medium"
  | "closeup"
  | "extreme_closeup"
  | "insert"
  | "over_the_shoulder"
  | "profile"
  | "pov"
  | "macro"
  | "aerial"
  | "tracking"
  | "two_shot"
  | "reaction"
  | string;

export type CameraMovement =
  | "static"
  | "pan"
  | "tilt"
  | "dolly"
  | "tracking"
  | "crane"
  | "handheld"
  | "orbit"
  | "push_in"
  | "pull_out"
  | "whip_pan"
  | "none"
  | string;

export type GenerationStrategy =
  | "text_to_image"
  | "image_to_image"
  | "text_to_video"
  | "image_to_video"
  | "first_last_frame"
  | "multi_reference"
  | "slideshow_still"
  | "extend"
  | "edit"
  | string;

export type GenerationStatus =
  | "planned"
  | "queued"
  | "generating"
  | "generated"
  | "qc_pending"
  | "qc_failed"
  | "approved"
  | "failed"
  | "skipped";

export type QcStatus = "pending" | "pass" | "retry" | "fail" | "waived";

export interface ShotMotionDirection {
  subjectMovement: string;
  cameraMovementDetail: string;
  environmentalMovement?: string;
  performanceDirection?: string;
  timingNotes?: string;
  interaction?: string;
  beginState: string;
  endState: string;
}

export interface ShotCameraSpec {
  shotType: ShotType;
  framing: string;
  composition: string;
  cameraPosition: string;
  cameraMovement: CameraMovement;
  lens?: string;
  depthOfField?: string;
  focus?: string;
}

export interface ShotLightingSpec {
  direction?: string;
  intensity?: string;
  color?: string;
  atmosphere?: string;
  timeOfDay?: string;
}

export interface ShotReferencePack {
  characterRefs: string[];
  locationRefs: string[];
  styleRefs: string[];
  firstFrameUrl?: string;
  lastFrameUrl?: string;
  previousShotId?: string;
}

export interface ShotRetryInfo {
  attempt: number;
  maxAttempts: number;
  lastFailureReasons: string[];
  remediation?: string;
  providerChanged?: boolean;
}

export interface ShotSpec {
  id: string;
  sceneId: string;
  index: number;
  purpose: string;
  /** Why this shot exists — empty purpose shots should not be generated */
  productionReason: string;
  timingStartSec: number;
  startTime?: number;
  durationSec: number;
  camera: ShotCameraSpec;
  subject: string;
  subjectAction: string;
  blocking?: string;
  performanceDirection?: string;
  dialogue?: string;
  narration?: string;
  environment: string;
  lighting: ShotLightingSpec;
  color?: string;
  atmosphere?: string;
  motion: ShotMotionDirection;
  references: ShotReferencePack;
  transitionIn?: string;
  transitionOut?: string;
  continuityRequirements: string[];
  characterIds: string[];
  propIds: string[];
  assetIds: string[];
  generationStrategy: GenerationStrategy;
  /** Structured provider-independent strategy (Phase 1+) */
  generationStrategySpec?: GenerationStrategySpec;
  generationTasks?: GenerationTask[];
  provider?: string;
  model?: string;
  resolution?: string;
  aspectRatio?: string;
  generationStatus: GenerationStatus;
  qcStatus: QcStatus;
  retry?: ShotRetryInfo;
  /** Compiled provider prompt (output of promptCompiler — not the brain) */
  compiledPrompt?: string;
  compiledNegativePrompt?: string;
  mediaUrl?: string;
  keyframeUrl?: string;
  lastFrameUrl?: string;
  /** Attached by filmmaking knowledge runtime */
  filmmakingGuidance?: ShotFilmmakingGuidance;
  observability?: {
    productionId?: string;
    promptCompilerVersion?: string;
    generationDurationMs?: number;
    costCredits?: number;
    qcScore?: number;
    filmmakingSkillIds?: string[];
    filmmakingSkillVersions?: Record<string, string>;
  };
}
