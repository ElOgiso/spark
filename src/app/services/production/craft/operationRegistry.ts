/**
 * Canonical Creative Operation Registry
 *
 * Answers: What operations does Spark understand?
 *
 * Core Principle: SPARK OWNS MEANING. PROVIDERS OWN EXECUTION.
 *
 * The registry manages Spark's semantic operation vocabulary, exposing
 * accepted targets, parameter expectations, required inputs, and deterministic
 * capability requirement mappings for each operation.
 *
 * Extensible: Allows registering new semantic operations without hardcoding
 * assumptions about a single static list.
 */

import type {
  CraftOperationCategory,
  CraftOperationType,
  CraftTargetType,
  CraftOperation,
} from "./types";

/**
 * Definition and metadata for a registered creative operation.
 */
export interface OperationDefinition {
  type: CraftOperationType;
  category: CraftOperationCategory;
  name: string;
  description: string;
  acceptedTargets: CraftTargetType[];
  /** Semantic inputs required by this operation */
  requiredInputs: string[];
  /** Deterministic Phase 2 capability requirements demanded by this operation */
  capabilityRequirements: string[];
  /** Other operations that cannot coexist within the same temporal interval */
  mutuallyExclusiveWith?: CraftOperationType[];
  /** Whether this operation accepts an intensity rating */
  supportsIntensity: boolean;
  /** Whether this operation can have explicit start/duration timing */
  supportsTiming: boolean;
  /** Semantic quality notes */
  qualityImplications?: string;
}

/**
 * Default catalog of canonical Spark creative operations.
 */
const CANONICAL_OPERATIONS: OperationDefinition[] = [
  // ==================== CAMERA OPERATIONS ====================
  {
    type: "PUSH_IN",
    category: "CAMERA",
    name: "Push In",
    description: "Camera progressively translates forward toward the subject to heighten intimacy or tension.",
    acceptedTargets: ["CAMERA", "SUBJECT", "CHARACTER", "PRODUCT", "OBJECT"],
    requiredInputs: [],
    capabilityRequirements: ["camera_motion", "camera_control"],
    mutuallyExclusiveWith: ["PULL_BACK"],
    supportsIntensity: true,
    supportsTiming: true,
  },
  {
    type: "PULL_BACK",
    category: "CAMERA",
    name: "Pull Back",
    description: "Camera retreats backward away from the subject, revealing surrounding environment and spatial context.",
    acceptedTargets: ["CAMERA", "SUBJECT", "CHARACTER", "PRODUCT", "OBJECT"],
    requiredInputs: [],
    capabilityRequirements: ["camera_motion", "camera_control"],
    mutuallyExclusiveWith: ["PUSH_IN"],
    supportsIntensity: true,
    supportsTiming: true,
  },
  {
    type: "PAN",
    category: "CAMERA",
    name: "Pan",
    description: "Horizontal rotational movement on the camera's fixed vertical axis.",
    acceptedTargets: ["CAMERA", "SUBJECT", "ENVIRONMENT"],
    requiredInputs: ["direction"],
    capabilityRequirements: ["camera_motion", "camera_control"],
    supportsIntensity: true,
    supportsTiming: true,
  },
  {
    type: "TILT",
    category: "CAMERA",
    name: "Tilt",
    description: "Vertical rotational movement on the camera's fixed horizontal axis to reveal height, scale, or status.",
    acceptedTargets: ["CAMERA", "SUBJECT", "ENVIRONMENT"],
    requiredInputs: ["direction"],
    capabilityRequirements: ["camera_motion", "camera_control"],
    supportsIntensity: true,
    supportsTiming: true,
  },
  {
    type: "DOLLY",
    category: "CAMERA",
    name: "Dolly",
    description: "Smooth physical translation of the camera through three-dimensional space along tracks or floor.",
    acceptedTargets: ["CAMERA", "SUBJECT", "ENVIRONMENT"],
    requiredInputs: [],
    capabilityRequirements: ["camera_motion", "camera_control"],
    supportsIntensity: true,
    supportsTiming: true,
  },
  {
    type: "CRANE",
    category: "CAMERA",
    name: "Crane / Jib",
    description: "Substantial vertical camera translation changing perspective between eye-level, ground, and aerial viewpoints.",
    acceptedTargets: ["CAMERA", "ENVIRONMENT", "SUBJECT"],
    requiredInputs: [],
    capabilityRequirements: ["camera_motion", "camera_control"],
    supportsIntensity: true,
    supportsTiming: true,
  },
  {
    type: "PEDESTAL",
    category: "CAMERA",
    name: "Pedestal",
    description: "Direct vertical elevation or lowering of the camera without changing angle or pitch.",
    acceptedTargets: ["CAMERA", "SUBJECT"],
    requiredInputs: [],
    capabilityRequirements: ["camera_motion", "camera_control"],
    supportsIntensity: true,
    supportsTiming: true,
  },
  {
    type: "ORBIT",
    category: "CAMERA",
    name: "Orbit / Arc",
    description: "Camera traverses a circular path around the subject while keeping the subject anchored in frame.",
    acceptedTargets: ["CAMERA", "SUBJECT", "CHARACTER", "PRODUCT"],
    requiredInputs: [],
    capabilityRequirements: ["camera_motion", "camera_control"],
    supportsIntensity: true,
    supportsTiming: true,
  },
  {
    type: "TRACK",
    category: "CAMERA",
    name: "Track / Follow",
    description: "Camera moves alongside or in tandem with a moving subject to maintain relative distance.",
    acceptedTargets: ["CAMERA", "SUBJECT", "CHARACTER"],
    requiredInputs: [],
    capabilityRequirements: ["camera_motion", "camera_control"],
    supportsIntensity: true,
    supportsTiming: true,
  },
  {
    type: "WHIP_PAN",
    category: "CAMERA",
    name: "Whip Pan",
    description: "High-speed kinetic horizontal camera pan generating motion blur, often used for transitions.",
    acceptedTargets: ["CAMERA"],
    requiredInputs: ["direction"],
    capabilityRequirements: ["camera_motion", "motion_blur"],
    supportsIntensity: true,
    supportsTiming: true,
  },
  {
    type: "TOPDOWN",
    category: "CAMERA",
    name: "Topdown / Bird's Eye",
    description: "Perpendicular overhead camera orientation looking straight down at the ground or table.",
    acceptedTargets: ["CAMERA", "ENVIRONMENT", "PRODUCT", "SUBJECT"],
    requiredInputs: [],
    capabilityRequirements: ["camera_angle", "composition_control"],
    supportsIntensity: false,
    supportsTiming: false,
  },
  {
    type: "DUTCH_ANGLE",
    category: "CAMERA",
    name: "Dutch Angle / Canted Roll",
    description: "Camera rolled off the horizontal axis to evoke psychological tension, disorientation, or unease.",
    acceptedTargets: ["CAMERA"],
    requiredInputs: [],
    capabilityRequirements: ["camera_angle", "composition_control"],
    supportsIntensity: true,
    supportsTiming: false,
  },
  {
    type: "RACK_FOCUS",
    category: "CAMERA",
    name: "Rack Focus",
    description: "Dynamic focal shift changing sharpness between foreground and background elements.",
    acceptedTargets: ["CAMERA", "SUBJECT", "CHARACTER", "OBJECT"],
    requiredInputs: ["toSubject"],
    capabilityRequirements: ["focus_control", "depth_of_field"],
    supportsIntensity: true,
    supportsTiming: true,
  },
  {
    type: "ZOOM",
    category: "CAMERA",
    name: "Optical Zoom",
    description: "Change in lens focal length altering magnification and background compression.",
    acceptedTargets: ["CAMERA", "SUBJECT"],
    requiredInputs: [],
    capabilityRequirements: ["optical_zoom", "focal_length_control"],
    supportsIntensity: true,
    supportsTiming: true,
  },

  // ==================== COMPOSITION OPERATIONS ====================
  {
    type: "HERO_SHOT",
    category: "COMPOSITION",
    name: "Hero Shot",
    description: "Iconic, dominant framing celebrating the subject or character with authoritative visual prominence.",
    acceptedTargets: ["SUBJECT", "CHARACTER", "PRODUCT"],
    requiredInputs: [],
    capabilityRequirements: ["composition_control"],
    supportsIntensity: true,
    supportsTiming: false,
  },
  {
    type: "FLATLAY",
    category: "COMPOSITION",
    name: "Flatlay Tabletop",
    description: "Clean top-down arranged compositional layout of items, products, or tools.",
    acceptedTargets: ["PRODUCT", "OBJECT", "FRAME"],
    requiredInputs: [],
    capabilityRequirements: ["composition_control"],
    supportsIntensity: false,
    supportsTiming: false,
  },
  {
    type: "SYMMETRICAL_COMPOSITION",
    category: "COMPOSITION",
    name: "Symmetrical Composition",
    description: "Balanced bilateral frame architecture emphasizing geometric harmony and formal precision.",
    acceptedTargets: ["FRAME", "ENVIRONMENT", "SUBJECT"],
    requiredInputs: [],
    capabilityRequirements: ["composition_control"],
    supportsIntensity: true,
    supportsTiming: false,
  },
  {
    type: "MACRO_DETAIL",
    category: "COMPOSITION",
    name: "Macro Detail",
    description: "Extreme close-up revealing fine textures, intricate mechanics, or surface nuances.",
    acceptedTargets: ["PRODUCT", "OBJECT", "SUBJECT"],
    requiredInputs: [],
    capabilityRequirements: ["macro_lens", "close_focus"],
    supportsIntensity: true,
    supportsTiming: false,
  },
  {
    type: "CLOSE_UP",
    category: "COMPOSITION",
    name: "Close Up",
    description: "Intimate framing tightly isolating the character's facial performance or key object.",
    acceptedTargets: ["CHARACTER", "SUBJECT", "PRODUCT"],
    requiredInputs: [],
    capabilityRequirements: ["framing_control"],
    supportsIntensity: false,
    supportsTiming: false,
  },
  {
    type: "WIDE_ESTABLISHING",
    category: "COMPOSITION",
    name: "Wide Establishing",
    description: "Expansive landscape or architectural composition clarifying geography and atmosphere.",
    acceptedTargets: ["ENVIRONMENT", "FRAME"],
    requiredInputs: [],
    capabilityRequirements: ["framing_control", "environment_detail"],
    supportsIntensity: false,
    supportsTiming: false,
  },

  // ==================== PRODUCT / OBJECT OPERATIONS ====================
  {
    type: "PRODUCT_SPIN",
    category: "PRODUCT",
    name: "Product Spin",
    description: "Rotating showcase of a product to reveal three-dimensional form, finish, and silhouette.",
    acceptedTargets: ["PRODUCT", "OBJECT"],
    requiredInputs: [],
    capabilityRequirements: ["product_presentation", "360_rotation"],
    supportsIntensity: true,
    supportsTiming: true,
  },
  {
    type: "DETAIL_SCAN",
    category: "PRODUCT",
    name: "Detail Scan",
    description: "Methodical linear or curved camera traversal along the surface contours of an object.",
    acceptedTargets: ["PRODUCT", "OBJECT"],
    requiredInputs: [],
    capabilityRequirements: ["product_presentation", "surface_inspection"],
    supportsIntensity: true,
    supportsTiming: true,
  },
  {
    type: "LABEL_TRACE",
    category: "PRODUCT",
    name: "Label Trace",
    description: "Targeted tracking move focusing on typography, brand labels, or etched emblems.",
    acceptedTargets: ["PRODUCT", "OBJECT"],
    requiredInputs: [],
    capabilityRequirements: ["product_presentation", "text_legibility"],
    supportsIntensity: true,
    supportsTiming: true,
  },
  {
    type: "LIGHT_SWEEP",
    category: "LIGHTING",
    name: "Light Sweep",
    description: "Dynamic light beam or specular highlight passing across subject to accentuate shape and edge contours.",
    acceptedTargets: ["LIGHTING", "PRODUCT", "OBJECT", "SUBJECT"],
    requiredInputs: [],
    capabilityRequirements: ["lighting_control", "dynamic_specular"],
    supportsIntensity: true,
    supportsTiming: true,
  },
  {
    type: "PRODUCT_REVEAL",
    category: "PRODUCT",
    name: "Product Reveal",
    description: "Unveiling a product from shadow, silhouette, or behind an environmental occlusion.",
    acceptedTargets: ["PRODUCT", "OBJECT"],
    requiredInputs: [],
    capabilityRequirements: ["product_presentation", "reveal_dynamics"],
    supportsIntensity: true,
    supportsTiming: true,
  },
  {
    type: "OBJECT_HIGHLIGHT",
    category: "PRODUCT",
    name: "Object Highlight",
    description: "Selective visual and lighting accentuation on a specific item within the scene.",
    acceptedTargets: ["OBJECT", "PRODUCT", "SUBJECT"],
    requiredInputs: [],
    capabilityRequirements: ["selective_lighting", "object_emphasis"],
    supportsIntensity: true,
    supportsTiming: false,
  },

  // ==================== MOTION OPERATIONS ====================
  {
    type: "MOTION_TRANSFER",
    category: "MOTION",
    name: "Motion Transfer",
    description: "Transfers the kinematic choreography, movement trajectory, or performance from a driving video onto the target subject while preserving target identity.",
    acceptedTargets: ["SUBJECT", "CHARACTER"],
    requiredInputs: ["sourceVideoRef", "targetSubjectRef"],
    capabilityRequirements: ["motion_transfer", "video_input", "image_reference"],
    supportsIntensity: true,
    supportsTiming: true,
  },
  {
    type: "SUBJECT_TRACKING",
    category: "MOTION",
    name: "Subject Tracking",
    description: "Camera dynamically adjusts orientation and coordinates to keep moving subject at a specific frame anchor.",
    acceptedTargets: ["SUBJECT", "CHARACTER", "CAMERA"],
    requiredInputs: ["targetSubject"],
    capabilityRequirements: ["subject_tracking", "camera_motion"],
    supportsIntensity: true,
    supportsTiming: true,
  },
  {
    type: "CAMERA_FOLLOW",
    category: "MOTION",
    name: "Camera Follow",
    description: "Follow vehicle or trailing camera moving behind or ahead of the subject.",
    acceptedTargets: ["CAMERA", "SUBJECT", "CHARACTER"],
    requiredInputs: [],
    capabilityRequirements: ["camera_follow", "camera_motion"],
    supportsIntensity: true,
    supportsTiming: true,
  },
  {
    type: "SLOW_MOTION",
    category: "MOTION",
    name: "Slow Motion",
    description: "Expanded temporal playback creating an overcranked cinematic cadence.",
    acceptedTargets: ["SHOT", "FRAME", "SUBJECT"],
    requiredInputs: ["speedFactor"],
    capabilityRequirements: ["temporal_control", "frame_rate_expansion"],
    supportsIntensity: true,
    supportsTiming: true,
  },
  {
    type: "SPEED_RAMP",
    category: "MOTION",
    name: "Speed Ramp",
    description: "Dynamic acceleration or deceleration between standard, high, and slow-motion temporal rates.",
    acceptedTargets: ["SHOT", "FRAME"],
    requiredInputs: ["initialSpeed", "peakSpeed"],
    capabilityRequirements: ["temporal_control", "variable_frame_rate"],
    supportsIntensity: true,
    supportsTiming: true,
  },
  {
    type: "FREEZE_MOTION",
    category: "MOTION",
    name: "Freeze Motion",
    description: "Temporal standstill freezing subject in mid-action while camera or environment may continue or hold.",
    acceptedTargets: ["SHOT", "SUBJECT"],
    requiredInputs: [],
    capabilityRequirements: ["temporal_control", "motion_freeze"],
    supportsIntensity: false,
    supportsTiming: true,
  },

  // ==================== TRANSFORMATION OPERATIONS ====================
  {
    type: "OBJECT_REPLACEMENT",
    category: "TRANSFORMATION",
    name: "Object Replacement",
    description: "Replaces a specific object or prop within a shot with a target replacement asset while respecting scene lighting and physics.",
    acceptedTargets: ["OBJECT", "PRODUCT"],
    requiredInputs: ["sourceShotOrVideoRef", "targetObjectRef", "replacementReferenceId"],
    capabilityRequirements: ["object_replacement", "video_input", "replacement_reference"],
    supportsIntensity: false,
    supportsTiming: true,
  },
  {
    type: "BACKGROUND_REPLACEMENT",
    category: "TRANSFORMATION",
    name: "Background Replacement",
    description: "Isolates and substitutes the background environment while maintaining foreground performance and lighting interaction.",
    acceptedTargets: ["BACKGROUND", "ENVIRONMENT"],
    requiredInputs: ["replacementReferenceId"],
    capabilityRequirements: ["background_replacement", "segmentation", "image_reference"],
    supportsIntensity: false,
    supportsTiming: false,
  },
  {
    type: "STYLE_TRANSFORMATION",
    category: "TRANSFORMATION",
    name: "Style Transformation",
    description: "Gradual or distinct artistic aesthetic transformation across the duration of the shot.",
    acceptedTargets: ["FRAME", "SHOT"],
    requiredInputs: [],
    capabilityRequirements: ["style_transformation", "style_reference"],
    supportsIntensity: true,
    supportsTiming: true,
  },
  {
    type: "ENVIRONMENT_TRANSFORMATION",
    category: "TRANSFORMATION",
    name: "Environment Transformation",
    description: "Changes environmental variables (time of day, weather, precipitation, season) during the shot.",
    acceptedTargets: ["ENVIRONMENT"],
    requiredInputs: [],
    capabilityRequirements: ["environment_control", "weather_effects"],
    supportsIntensity: true,
    supportsTiming: true,
  },

  // ==================== EDIT / TRANSITION OPERATIONS ====================
  {
    type: "MATCH_CUT",
    category: "EDIT",
    name: "Match Cut",
    description: "Harmonizes composition, subject posture, or visual motif between incoming and outgoing shots.",
    acceptedTargets: ["FRAME", "SHOT"],
    requiredInputs: ["matchFeature"],
    capabilityRequirements: ["continuity_transition", "frame_match"],
    supportsIntensity: false,
    supportsTiming: false,
  },
  {
    type: "WHIP_TRANSITION",
    category: "EDIT",
    name: "Whip Transition",
    description: "Blurs boundary between shots via matched rapid pans.",
    acceptedTargets: ["SHOT", "FRAME"],
    requiredInputs: [],
    capabilityRequirements: ["continuity_transition", "motion_blur"],
    supportsIntensity: true,
    supportsTiming: true,
  },
  {
    type: "SMASH_CUT",
    category: "EDIT",
    name: "Smash Cut",
    description: "Abrupt high-contrast cut between extreme tempos or audio/visual volumes.",
    acceptedTargets: ["SHOT"],
    requiredInputs: [],
    capabilityRequirements: ["continuity_transition"],
    supportsIntensity: false,
    supportsTiming: false,
  },
  {
    type: "DISSOLVE",
    category: "EDIT",
    name: "Dissolve",
    description: "Optical cross-fade blending the tail of the shot into the subsequent head.",
    acceptedTargets: ["SHOT", "FRAME"],
    requiredInputs: [],
    capabilityRequirements: ["continuity_transition", "optical_blend"],
    supportsIntensity: true,
    supportsTiming: true,
  },
  {
    type: "MORPH",
    category: "EDIT",
    name: "Morph Transition",
    description: "Topological deformation fluidly morphing one visual element into another.",
    acceptedTargets: ["SUBJECT", "OBJECT", "FRAME"],
    requiredInputs: [],
    capabilityRequirements: ["continuity_transition", "morphing"],
    supportsIntensity: true,
    supportsTiming: true,
  },
  {
    type: "CUTAWAY",
    category: "EDIT",
    name: "Cutaway",
    description: "Brief insert cut away from main action to contextual detail, reaction, or B-roll.",
    acceptedTargets: ["SHOT"],
    requiredInputs: [],
    capabilityRequirements: ["editorial_cutaway"],
    supportsIntensity: false,
    supportsTiming: false,
  },
];

/**
 * Creative Operation Registry class.
 * Singleton and instance authority for Spark's semantic operation vocabulary.
 */
export class CreativeOperationRegistry {
  private static instance: CreativeOperationRegistry;
  private readonly definitions = new Map<CraftOperationType, OperationDefinition>();

  constructor(initialDefinitions: OperationDefinition[] = CANONICAL_OPERATIONS) {
    for (const def of initialDefinitions) {
      this.definitions.set(def.type, def);
    }
  }

  public static getInstance(): CreativeOperationRegistry {
    if (!CreativeOperationRegistry.instance) {
      CreativeOperationRegistry.instance = new CreativeOperationRegistry();
    }
    return CreativeOperationRegistry.instance;
  }

  /**
   * Look up a registered operation by its canonical type.
   */
  public getDefinition(type: CraftOperationType): OperationDefinition | undefined {
    return this.definitions.get(type);
  }

  /**
   * List all registered operations, optionally filtered by category.
   */
  public listDefinitions(category?: CraftOperationCategory): OperationDefinition[] {
    const list = Array.from(this.definitions.values());
    if (!category) return list;
    return list.filter((def) => def.category === category);
  }

  /**
   * Register or update an operation definition (for extensibility).
   */
  public registerDefinition(definition: OperationDefinition): void {
    this.definitions.set(definition.type, definition);
  }

  /**
   * Get capability requirements for a single operation.
   */
  public getCapabilitiesForOperation(type: CraftOperationType): string[] {
    const def = this.definitions.get(type);
    return def ? [...def.capabilityRequirements] : [];
  }

  /**
   * Derive deduplicated capability requirements from a list of operations.
   */
  public deriveCapabilitiesFromOperations(operations: CraftOperation[]): string[] {
    const caps = new Set<string>();
    for (const op of operations) {
      const defCaps = this.getCapabilitiesForOperation(op.type);
      for (const c of defCaps) caps.add(c);
      if (op.capabilityRequirements) {
        for (const c of op.capabilityRequirements) caps.add(c);
      }
    }
    return Array.from(caps).sort();
  }

  /**
   * Check if two operations are mutually exclusive in principle.
   */
  public areMutuallyExclusive(typeA: CraftOperationType, typeB: CraftOperationType): boolean {
    if (typeA === typeB) return false;
    const defA = this.definitions.get(typeA);
    const defB = this.definitions.get(typeB);
    if (defA?.mutuallyExclusiveWith?.includes(typeB)) return true;
    if (defB?.mutuallyExclusiveWith?.includes(typeA)) return true;
    return false;
  }
}

/**
 * Module-level helper functions for convenient access.
 */
export function getOperationDefinition(type: CraftOperationType): OperationDefinition | undefined {
  return CreativeOperationRegistry.getInstance().getDefinition(type);
}

export function listOperations(category?: CraftOperationCategory): OperationDefinition[] {
  return CreativeOperationRegistry.getInstance().listDefinitions(category);
}

export function deriveCapabilitiesFromOperations(operations: CraftOperation[]): string[] {
  return CreativeOperationRegistry.getInstance().deriveCapabilitiesFromOperations(operations);
}

export function areOperationsMutuallyExclusive(
  typeA: CraftOperationType,
  typeB: CraftOperationType
): boolean {
  return CreativeOperationRegistry.getInstance().areMutuallyExclusive(typeA, typeB);
}
