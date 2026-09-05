/**
 * Structured continuity specification beyond last-frame chaining.
 * Phase 7 (Continuity State & Propagation) extends ContinuityState with entity maps,
 * deltas, locks, constraints, conflict detection, impact analysis, and generation handoff.
 * Does not replace the existing bridge model used by the continuity engine / QC.
 *
 * Note: docs "Phase 7" also refers to Autonomous Creative Director — this file implements
 * the Continuity State Propagation layer (SPARK prompt Phase 7), not Creative Director.
 */

export type ContinuityScope = "production" | "scene" | "sequence" | "shot";

export type ContinuityChangeKind =
  | "planned"
  | "inherited"
  | "derived"
  | "intentional"
  | "unknown";

export type ContinuityConstraintCategory =
  | "IDENTITY"
  | "APPEARANCE"
  | "WARDROBE"
  | "PROP"
  | "PRODUCT"
  | "POSITION"
  | "BLOCKING"
  | "SCREEN_DIRECTION"
  | "EYELINE"
  | "SPATIAL_RELATIONSHIP"
  | "AXIS"
  | "CAMERA"
  | "LIGHTING"
  | "ENVIRONMENT"
  | "ACTION"
  | "INTERACTION"
  | "TEMPORAL"
  | "VISUAL_TREATMENT"
  | "REFERENCE";

export type ContinuityConstraintSeverity = "hard" | "soft";

export type ContinuityConflictClass = "hard" | "soft" | "intentional" | "unresolved";

export type ContinuityTemporalMode =
  | "continuous"
  | "flashback"
  | "flash_forward"
  | "time_jump"
  | "montage"
  | "dream"
  | "memory";

export interface ContinuityIdentityState {
  face?: string;
  body?: string;
  hair?: string;
  definingCharacteristics: string[];
  characterRefs: string[];
}

export interface ContinuityWardrobeState {
  clothing?: string;
  accessories?: string[];
  colors?: string[];
  state?: string;
}

export interface ContinuityPropState {
  propId: string;
  identity: string;
  position?: string;
  state?: string;
  /** Character / entity currently holding the prop (null = free in environment) */
  holderId?: string | null;
  orientation?: string;
  visibility?: "visible" | "hidden" | "occluded";
  version?: number;
  lockedFields?: string[];
  scope?: ContinuityScope;
}

export interface ContinuityLocationState {
  locationId?: string;
  geography?: string;
  architecture?: string;
  environment?: string;
  roomOrArea?: string;
  timeOfDay?: string;
  weather?: string;
  version?: number;
  lockedFields?: string[];
}

export interface ContinuityLightingState {
  direction?: string;
  intensity?: string;
  color?: string;
  time?: string;
  keySource?: string;
  contrastIntent?: string;
}

export interface ContinuitySpatialState {
  subjectPosition?: string;
  screenDirection?: string;
  cameraRelationship?: string;
}

export interface ContinuityCharacterEntity {
  characterId: string;
  version: number;
  identity: string;
  appearance?: string;
  hair?: string;
  wardrobe?: ContinuityWardrobeState;
  accessories?: string[];
  facialState?: string;
  bodyState?: string;
  pose?: string;
  gazeTarget?: string;
  gazeDirection?: string;
  position?: string;
  orientation?: string;
  screenDirection?: string;
  heldPropIds?: string[];
  lockedFields?: string[];
  scope?: ContinuityScope;
}

export interface ContinuityProductEntity {
  productId: string;
  version: number;
  identity: string;
  orientation?: string;
  position?: string;
  packaging?: string;
  logoVisibility?: string;
  surfaceState?: string;
  openClosed?: "open" | "closed" | "unknown";
  quantity?: string;
  interactionState?: string;
  holderId?: string | null;
  lockedFields?: string[];
  scope?: ContinuityScope;
}

export interface ContinuityAxisState {
  axisId: string;
  orientation: string;
  cameraSide: string;
  crossingIntent?: "none" | "intentional";
  crossingReason?: string;
}

export interface ContinuitySpatialRelation {
  subjectId: string;
  relation:
    | "left_of"
    | "right_of"
    | "behind"
    | "in_front_of"
    | "beside"
    | "facing"
    | "at"
    | string;
  objectId: string;
  notes?: string;
}

export interface ContinuityInteractionState {
  subjectId: string;
  verb: string;
  objectId: string;
  kind?: "character_prop" | "character_character" | "character_environment" | "product_environment" | string;
}

export interface ContinuityLock {
  id: string;
  targetKind: "character" | "location" | "prop" | "product" | "style" | "wardrobe" | "axis" | string;
  subjectId: string;
  field?: string;
  version: number;
  locked: boolean;
  reason?: string;
  scope?: ContinuityScope;
}

export interface ContinuitySourceMeta {
  kind: "ShotSpec" | "SceneSpec" | "ProductionSpec" | "StoryboardPanel" | "derived" | "manual" | string;
  confidence: number;
  assumptions?: string[];
}

export interface ContinuityState {
  identity: ContinuityIdentityState;
  wardrobe: ContinuityWardrobeState;
  props: ContinuityPropState[];
  location: ContinuityLocationState;
  lighting: ContinuityLightingState;
  time: {
    dayNight?: string;
    storyTime?: string;
    elapsedAction?: string;
    temporalMode?: ContinuityTemporalMode;
  };
  spatial: ContinuitySpatialState;
  emotionalState?: string;
  objectState?: string;
  cameraState?: string;
  audioState?: string;
  summary: string;

  /** Phase 7 extensions — optional so legacy bridges remain valid */
  scope?: ContinuityScope;
  productionId?: string;
  sceneId?: string;
  sequenceId?: string;
  shotId?: string;
  characters?: ContinuityCharacterEntity[];
  products?: ContinuityProductEntity[];
  axis?: ContinuityAxisState;
  spatialRelations?: ContinuitySpatialRelation[];
  environmentFlags?: Record<string, string>;
  actionPhase?: string;
  interactions?: ContinuityInteractionState[];
  visualTreatmentId?: string;
  locks?: ContinuityLock[];
  version?: number;
  source?: ContinuitySourceMeta;
}

export interface ContinuityFieldChange {
  path: string;
  from?: unknown;
  to?: unknown;
  changeKind: ContinuityChangeKind;
  reason?: string;
  scope?: ContinuityScope;
}

export interface ContinuityDelta {
  id: string;
  fromShotId?: string;
  toShotId: string;
  sceneId?: string;
  added: ContinuityFieldChange[];
  removed: ContinuityFieldChange[];
  changed: ContinuityFieldChange[];
  moved: ContinuityFieldChange[];
  transformed: ContinuityFieldChange[];
  transferred: ContinuityFieldChange[];
  consumed: ContinuityFieldChange[];
  intentional: boolean;
  summary: string;
}

export interface ContinuityConstraint {
  id: string;
  category: ContinuityConstraintCategory;
  severity: ContinuityConstraintSeverity;
  description: string;
  subjectId?: string;
  field?: string;
  expected?: unknown;
  source: string;
  reason?: string;
  confidence: number;
  shotId?: string;
}

export interface ContinuityConflict {
  id: string;
  classification: ContinuityConflictClass;
  category: ContinuityConstraintCategory;
  description: string;
  shotId?: string;
  subjectId?: string;
  expected?: unknown;
  observed?: unknown;
  sourceA: string;
  sourceB: string;
  reason?: string;
}

export interface ContinuityRiskAssessment {
  shotId: string;
  level: "low" | "medium" | "high";
  score: number;
  reasons: string[];
}

export interface ContinuityImpactReport {
  subjectId: string;
  field: string;
  fromVersion: number;
  toVersion: number;
  affectedShotIds: string[];
  summary: string;
}

export interface ContinuityGenerationHandoff {
  shotId: string;
  sceneId: string;
  inheritedState: ContinuityState;
  requiredState: ContinuityState;
  startState: ContinuityState;
  targetEndState: ContinuityState;
  requiredConstraints: ContinuityConstraint[];
  optionalConstraints: ContinuityConstraint[];
  allowedChanges: string[];
  forbiddenChanges: string[];
  transitionFromPreviousShot?: ContinuityDelta;
  risk: ContinuityRiskAssessment;
  references: string[];
}

export interface ShotContinuityBridge {
  shotId: string;
  continuityIn: ContinuityState;
  continuityOut: ContinuityState;
  /** Phase 7: explicit delta from previous out → this out */
  delta?: ContinuityDelta;
  requiredConstraints?: ContinuityConstraint[];
  optionalConstraints?: ContinuityConstraint[];
  conflicts?: ContinuityConflict[];
  risk?: ContinuityRiskAssessment;
  generationHandoff?: ContinuityGenerationHandoff;
}

export interface ContinuitySpec {
  globalLocks: string[];
  identityPackSummary: string;
  shotBridges: ShotContinuityBridge[];
  /** Prefer structured state; last-frame URLs remain operational aids */
  lastFrameChainEnabled: boolean;
  /** Phase 7 structured locks (parallel to globalLocks strings) */
  structuredLocks?: ContinuityLock[];
  /** Phase 7 snapshots at scene/sequence boundaries */
  snapshots?: Array<{
    id: string;
    boundary: "scene_start" | "sequence_start" | "approved_shot" | "production_lock";
    sceneId?: string;
    shotId?: string;
    state: ContinuityState;
  }>;
}

export function emptyContinuityState(summary = ""): ContinuityState {
  return {
    identity: { definingCharacteristics: [], characterRefs: [] },
    wardrobe: {},
    props: [],
    location: {},
    lighting: {},
    time: {},
    spatial: {},
    summary,
    characters: [],
    products: [],
    spatialRelations: [],
    environmentFlags: {},
    interactions: [],
    locks: [],
    version: 1,
  };
}

/**
 * Legacy bridge — inherits previous out, applies shotChanges.
 * Phase 7 propagation prefers applyContinuityDelta for structured evolution.
 */
export function bridgeContinuity(
  previousOut: ContinuityState,
  shotChanges: Partial<ContinuityState> & { summary: string }
): { continuityIn: ContinuityState; continuityOut: ContinuityState } {
  const continuityIn: ContinuityState = {
    ...previousOut,
    identity: {
      ...previousOut.identity,
      ...(shotChanges.identity || {}),
      definingCharacteristics:
        shotChanges.identity?.definingCharacteristics ?? previousOut.identity.definingCharacteristics,
      characterRefs: shotChanges.identity?.characterRefs ?? previousOut.identity.characterRefs,
    },
    wardrobe: { ...previousOut.wardrobe, ...(shotChanges.wardrobe || {}) },
    props: shotChanges.props ?? previousOut.props,
    location: { ...previousOut.location, ...(shotChanges.location || {}) },
    lighting: { ...previousOut.lighting, ...(shotChanges.lighting || {}) },
    time: { ...previousOut.time, ...(shotChanges.time || {}) },
    spatial: { ...previousOut.spatial, ...(shotChanges.spatial || {}) },
    emotionalState: shotChanges.emotionalState ?? previousOut.emotionalState,
    objectState: shotChanges.objectState ?? previousOut.objectState,
    cameraState: shotChanges.cameraState ?? previousOut.cameraState,
    audioState: shotChanges.audioState ?? previousOut.audioState,
    characters: shotChanges.characters ?? previousOut.characters,
    products: shotChanges.products ?? previousOut.products,
    axis: shotChanges.axis ?? previousOut.axis,
    spatialRelations: shotChanges.spatialRelations ?? previousOut.spatialRelations,
    environmentFlags: shotChanges.environmentFlags ?? previousOut.environmentFlags,
    actionPhase: shotChanges.actionPhase ?? previousOut.actionPhase,
    interactions: shotChanges.interactions ?? previousOut.interactions,
    visualTreatmentId: shotChanges.visualTreatmentId ?? previousOut.visualTreatmentId,
    locks: shotChanges.locks ?? previousOut.locks,
    version: shotChanges.version ?? previousOut.version,
    source: shotChanges.source ?? previousOut.source,
    scope: shotChanges.scope ?? previousOut.scope,
    productionId: shotChanges.productionId ?? previousOut.productionId,
    sceneId: shotChanges.sceneId ?? previousOut.sceneId,
    sequenceId: shotChanges.sequenceId ?? previousOut.sequenceId,
    shotId: shotChanges.shotId ?? previousOut.shotId,
    summary: previousOut.summary,
  };

  const continuityOut: ContinuityState = {
    ...continuityIn,
    ...shotChanges,
    identity: continuityIn.identity,
    wardrobe: { ...continuityIn.wardrobe, ...(shotChanges.wardrobe || {}) },
    props: shotChanges.props ?? continuityIn.props,
    location: { ...continuityIn.location, ...(shotChanges.location || {}) },
    lighting: { ...continuityIn.lighting, ...(shotChanges.lighting || {}) },
    time: { ...continuityIn.time, ...(shotChanges.time || {}) },
    spatial: { ...continuityIn.spatial, ...(shotChanges.spatial || {}) },
    characters: shotChanges.characters ?? continuityIn.characters,
    products: shotChanges.products ?? continuityIn.products,
    axis: shotChanges.axis ?? continuityIn.axis,
    spatialRelations: shotChanges.spatialRelations ?? continuityIn.spatialRelations,
    environmentFlags: shotChanges.environmentFlags ?? continuityIn.environmentFlags,
    interactions: shotChanges.interactions ?? continuityIn.interactions,
    locks: shotChanges.locks ?? continuityIn.locks,
    summary: shotChanges.summary,
  };

  return { continuityIn, continuityOut };
}
