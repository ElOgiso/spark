/**
 * Canonical Craft Engine & Creative Operation Contracts
 *
 * Core Principle: SPARK OWNS MEANING. PROVIDERS OWN EXECUTION.
 *
 * The Craft layer defines HOW a shot should be crafted creatively
 * (camera movement, framing, lighting sweeps, product reveals, motion transfer,
 * object replacement) in provider-neutral semantic terms, without deciding
 * which provider or model executes it.
 */

import type { ShotSpec } from "../specification/shotSpec";
import type { StyleBible } from "../specification/styleBible";
import type { ReferenceGraph } from "../specification/referenceGraph";
import type { TemporalBeat } from "../cinematography/cinematicIntelligence";

/**
 * High-level category of creative operation.
 */
export type CraftOperationCategory =
  | "CAMERA"
  | "COMPOSITION"
  | "PRODUCT"
  | "MOTION"
  | "TRANSFORMATION"
  | "EDIT"
  | "LIGHTING"
  | "SUBJECT"
  | "ENVIRONMENT";

/**
 * Provider-neutral semantic operation types.
 * Pure creative intent — never provider API tokens or parameters.
 */
export type CraftOperationType =
  // Camera Operations
  | "PUSH_IN"
  | "PULL_BACK"
  | "PAN"
  | "TILT"
  | "DOLLY"
  | "CRANE"
  | "PEDESTAL"
  | "ORBIT"
  | "TRACK"
  | "WHIP_PAN"
  | "TOPDOWN"
  | "DUTCH_ANGLE"
  | "RACK_FOCUS"
  | "ZOOM"
  // Composition Operations
  | "HERO_SHOT"
  | "FLATLAY"
  | "SYMMETRICAL_COMPOSITION"
  | "MACRO_DETAIL"
  | "CLOSE_UP"
  | "WIDE_ESTABLISHING"
  // Product / Object Operations
  | "PRODUCT_SPIN"
  | "DETAIL_SCAN"
  | "LABEL_TRACE"
  | "LIGHT_SWEEP"
  | "PRODUCT_REVEAL"
  | "OBJECT_HIGHLIGHT"
  // Motion Operations
  | "MOTION_TRANSFER"
  | "SUBJECT_TRACKING"
  | "CAMERA_FOLLOW"
  | "SLOW_MOTION"
  | "SPEED_RAMP"
  | "FREEZE_MOTION"
  // Transformation Operations
  | "OBJECT_REPLACEMENT"
  | "BACKGROUND_REPLACEMENT"
  | "STYLE_TRANSFORMATION"
  | "ENVIRONMENT_TRANSFORMATION"
  // Edit / Transition Operations
  | "MATCH_CUT"
  | "WHIP_TRANSITION"
  | "SMASH_CUT"
  | "DISSOLVE"
  | "MORPH"
  | "CUTAWAY";

/**
 * Relative intensity of an operation, interpreted within the StyleBible envelope.
 */
export type CraftIntensity = "subtle" | "moderate" | "dramatic" | "extreme";

/**
 * Temporal placement of an operation within the shot.
 * Note: Describes creative intent during the shot; editorial timeline remains
 * authoritative for final assembly.
 */
export interface OperationTiming {
  /** Start offset in seconds relative to the start of the shot (0-based) */
  startSec: number;
  /** Duration of the operation in seconds */
  durationSec: number;
  /** Optional explicit end second relative to shot start (startSec + durationSec) */
  endSec?: number;
  /** Dynamic curve / easing for the motion */
  easing?: "linear" | "ease_in" | "ease_out" | "ease_in_out" | "snap";
}

/**
 * Target entity that an operation acts upon.
 */
export type CraftTargetType =
  | "CAMERA"
  | "SUBJECT"
  | "CHARACTER"
  | "PRODUCT"
  | "OBJECT"
  | "ENVIRONMENT"
  | "BACKGROUND"
  | "FOREGROUND"
  | "LIGHTING"
  | "SHOT"
  | "FRAME";

export interface CraftOperationTarget {
  type: CraftTargetType;
  /** Semantic identifier (e.g. characterId, propId, locationId, or referenceNodeId) */
  id?: string;
  /** Human-readable target label */
  label?: string;
  /** Secondary entity identifier (e.g. replacement target or second focus anchor) */
  secondaryId?: string;
}

// ---------------------------------------------------------------------------
// Typed Parameter Schemas for Canonical Operations
// ---------------------------------------------------------------------------

export interface PushInParameters {
  direction?: "forward" | "inward";
  distance?: "subtle" | "moderate" | "dramatic";
  speed?: "slow" | "normal" | "fast";
  focalTarget?: string;
}

export interface PullBackParameters {
  direction?: "backward" | "outward";
  distance?: "subtle" | "moderate" | "dramatic";
  speed?: "slow" | "normal" | "fast";
  revealTarget?: string;
}

export interface PanParameters {
  direction: "left" | "right";
  angleDegrees?: number;
  speed?: "slow" | "normal" | "whip";
}

export interface TiltParameters {
  direction: "up" | "down";
  angleDegrees?: number;
  speed?: "slow" | "normal" | "fast";
}

export interface DollyParameters {
  axis: "lateral" | "forward_backward" | "diagonal";
  distance?: "short" | "medium" | "long";
  speed?: "slow" | "normal" | "fast";
}

export interface CraneParameters {
  direction: "up" | "down";
  heightChange?: "ground_to_eye" | "eye_to_aerial" | "aerial_to_eye";
  sweep?: boolean;
}

export interface OrbitParameters {
  direction: "clockwise" | "counter_clockwise";
  degrees?: number;
  radius?: "tight" | "medium" | "wide";
  speed?: "slow" | "normal" | "fast";
}

export interface TrackParameters {
  axis?: "lateral" | "forward" | "backward";
  followSubject?: string;
  leadDistance?: "close" | "medium" | "far";
}

export interface WhipPanParameters {
  direction: "left" | "right";
  blurIntensity?: "moderate" | "heavy";
  transitionCutpoint?: "in" | "out" | "center";
}

export interface RackFocusParameters {
  fromSubject?: string;
  toSubject: string;
  speed?: "snap" | "smooth" | "slow";
}

export interface ZoomParameters {
  direction: "in" | "out";
  focalLengthChange?: string;
  opticalFeel?: "smooth" | "crash";
}

export interface HeroShotParameters {
  angle?: "low_angle" | "eye_level";
  prominence?: "commanding" | "iconic" | "elevated";
}

export interface FlatlayParameters {
  arrangementStyle?: "grid" | "organic" | "minimal";
  surfaceTexture?: string;
}

export interface MacroDetailParameters {
  focalSubject: string;
  magnification?: "2x" | "5x" | "extreme";
  depthSlice?: "ultra_thin" | "readable";
}

export interface ProductSpinParameters {
  axis?: "y_vertical" | "x_horizontal" | "diagonal";
  rotationDegrees?: number;
  rotationSpeed?: "slow" | "medium" | "fast";
  showcaseSide?: string;
}

export interface DetailScanParameters {
  path?: "horizontal" | "vertical" | "curved";
  featureToHighlight?: string;
}

export interface LightSweepParameters {
  lightSource?: "spot" | "bar" | "ambient_glint";
  direction?: "left_to_right" | "top_to_bottom" | "diagonal";
  intensity?: "soft" | "sharp" | "glint";
}

export interface MotionTransferParameters {
  /** Reference node ID or URI for driving video containing source motion */
  sourceVideoRef: string;
  /** Narrative or kinematic description of driving motion */
  drivingAction: string;
  /** Target subject identity or ReferenceNode to receive the motion */
  targetSubjectRef: string;
  /** Motion fidelity intent */
  fidelityMode?: "pose_only" | "full_motion" | "expressive";
  /** Whether to strictly preserve the target character's visual identity */
  retainSubjectIdentity?: boolean;
}

export interface ObjectReplacementParameters {
  /** Reference to the base video or shot where object appears */
  sourceShotOrVideoRef: string;
  /** Target object to be replaced (e.g., "prop_phone") */
  targetObjectRef: string;
  /** Reference to the replacement item in the ReferenceGraph */
  replacementReferenceId: string;
  /** Preserve environmental lighting cues on the new object */
  preserveLighting?: boolean;
  /** Preserve surface contact shadows */
  preserveShadows?: boolean;
}

export interface SubjectTrackingParameters {
  targetSubject: string;
  framingLock?: "center" | "rule_of_thirds_left" | "rule_of_thirds_right";
  trackingSmoothness?: "rigid" | "smooth" | "loose";
}

export interface SlowMotionParameters {
  speedFactor: number; // e.g. 0.5 (half speed), 0.25 (quarter speed)
  curve?: "linear" | "ease_in" | "ease_out";
}

export interface SpeedRampParameters {
  initialSpeed: number;
  peakSpeed: number;
  finalSpeed: number;
  rampCurve?: "s_curve" | "linear";
}

export interface MatchCutParameters {
  matchFeature: "shape" | "action" | "eyeline" | "color";
  nextShotId?: string;
  incomingShape?: string;
}

/**
 * Union of typed parameters for canonical operations.
 */
export type CraftOperationParameters =
  | PushInParameters
  | PullBackParameters
  | PanParameters
  | TiltParameters
  | DollyParameters
  | CraneParameters
  | OrbitParameters
  | TrackParameters
  | WhipPanParameters
  | RackFocusParameters
  | ZoomParameters
  | HeroShotParameters
  | FlatlayParameters
  | MacroDetailParameters
  | ProductSpinParameters
  | DetailScanParameters
  | LightSweepParameters
  | MotionTransferParameters
  | ObjectReplacementParameters
  | SubjectTrackingParameters
  | SlowMotionParameters
  | SpeedRampParameters
  | MatchCutParameters
  | Record<string, unknown>;

/**
 * A single canonical craft operation.
 *
 * Encapsulates purposeful creative direction applied to a shot.
 * Provider-neutral: Contains NO provider-specific tokens, model IDs,
 * prompt strings, or API parameter dictionaries.
 */
export interface CraftOperation<TParams = CraftOperationParameters> {
  /** Unique operation instance ID (e.g. "op_push_in_101") */
  id: string;
  /** Canonical operation type */
  type: CraftOperationType;
  /** Functional category */
  category: CraftOperationCategory;
  /** Narrative / dramatic rationale for this operation */
  purpose: string;
  /** Entity acted upon */
  target: CraftOperationTarget;
  /** Typed, semantic parameters */
  parameters: TParams;
  /** Temporal placement within the shot */
  timing?: OperationTiming;
  /** Stylistic intensity */
  intensity?: CraftIntensity;
  /** Semantic constraints (e.g. "keep_subject_centered", "no_motion_blur") */
  constraints?: string[];
  /** ReferenceGraph node IDs required or utilized by this operation */
  referenceNodeIds?: string[];
  /** Capability requirements declared by this operation (e.g. "camera_motion", "motion_transfer") */
  capabilityRequirements?: string[];
  /** Optional non-provider semantic metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Canonical Craft Plan for a shot.
 * Contains the ordered set of creative operations and overall cinematography plan.
 */
export interface CraftPlan {
  /** Target shot ID */
  shotId: string;
  /** Creative operations attached to this shot */
  operations: CraftOperation[];
  /** Cinematography rationale / summary */
  cinematographySummary?: string;
  /** Temporal beats carried from cinematography intelligence */
  temporalBeats?: TemporalBeat[];
  /** Craft-level constraints */
  constraints?: string[];
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Deterministic conflict surfaced between incompatible operations.
 */
export interface CraftConflict {
  code:
    | "TEMPORAL_OVERLAP_CONFLICT"
    | "OPPOSING_CAMERA_MOVEMENT"
    | "MISSING_REQUIRED_TARGET"
    | "MISSING_REFERENCE_INPUT"
    | "INVALID_TIMING_BOUNDS"
    | "INCOMPATIBLE_CATEGORIES";
  operationIds: string[];
  description: string;
  evidence?: Record<string, unknown>;
}

/**
 * Validation result for a CraftPlan or operation set.
 */
export interface CraftValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  conflicts: CraftConflict[];
  missingRequirements: string[];
}

/**
 * Fully resolved semantic shot.
 * Combines ShotSpec + StyleBible + ReferenceGraph + CraftPlan + resolved capabilities.
 * This is the input handed downstream to Phase 5 Capability Registry and Phase 6 Model Router.
 */
export interface ResolvedSemanticShot {
  shot: ShotSpec;
  styleBible: StyleBible;
  referenceGraph: ReferenceGraph;
  craftPlan: CraftPlan;
  resolvedCapabilities: string[];
  metadata?: Record<string, unknown>;
}
