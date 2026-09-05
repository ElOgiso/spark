/**
 * Visual preproduction contracts — provider-neutral.
 * Extends MasterAsset / ShotSpec / VisualStyleSpec; does not replace them.
 * Storyboard is visualization + execution-prep around ShotSpec (never canonical truth).
 */

export interface VisualTreatment {
  id: string;
  productionId: string;
  lookLabel: string;
  palette: string;
  contrast: string;
  saturation: string;
  lightingMood: string;
  texture: string;
  atmosphere: string;
  cameraLanguage: string;
  lensCharacter: string;
  depthOfFieldLanguage: string;
  colorLanguage: string;
  aspectRatioIntent: string;
  aspectRatio: string;
  references: string[];
  principles: string[];
  confidence: number;
  provenance: string;
  version: number;
  locked?: boolean;
}

export type VisualLockTarget =
  | "character"
  | "location"
  | "product"
  | "style"
  | "storyboard"
  | "shot_composition"
  | "visual_treatment";

export interface VisualLock {
  id: string;
  target: VisualLockTarget;
  subjectId: string;
  locked: boolean;
  version: number;
  reason?: string;
  lockedAt?: string;
  previousVersion?: number;
  impactAnalysis?: string[];
}

export type CharacterViewKind =
  | "front"
  | "three_quarter"
  | "profile"
  | "rear"
  | "full_body"
  | "face_closeup"
  | "wardrobe_detail";

export interface CharacterViewRef {
  view: CharacterViewKind;
  url?: string;
  description?: string;
  required: boolean;
}

export interface CharacterVisualContract {
  id: string;
  assetRef: string;
  characterId: string;
  identity: string;
  face: string;
  body: string;
  proportions: string;
  hair: string;
  skin: string;
  wardrobe: string;
  accessories: string[];
  colorPalette: string[];
  silhouette: string;
  style: string;
  agePresentation: string;
  canonicalExpressions: string[];
  canonicalPoses: string[];
  views: CharacterViewRef[];
  referenceImageUrls: string[];
  version: number;
  approvalState: "draft" | "approved" | "locked" | "retired";
  visualTreatmentId?: string;
  provenance: string;
}

export interface LocationVisualContract {
  id: string;
  assetRef: string;
  locationId: string;
  environmentIdentity: string;
  architecture: string;
  layout: string;
  lighting: string;
  timeOfDay: string;
  weather: string;
  materials: string[];
  color: string;
  spatialLandmarks: string[];
  entryExitPoints: string[];
  foregroundAnchors: string[];
  backgroundAnchors: string[];
  approvedReferenceUrls: string[];
  version: number;
  approvalState: "draft" | "approved" | "locked" | "retired";
  provenance: string;
}

export interface ProductVisualContract {
  id: string;
  assetRef: string;
  productId: string;
  identity: string;
  shape: string;
  proportions: string;
  materials: string[];
  colors: string[];
  branding: string;
  logos: string[];
  surfaceDetails: string[];
  approvedViews: string[];
  canonicalReferenceUrl?: string;
  approvedReferenceUrls: string[];
  version: number;
  approvalState: "draft" | "approved" | "locked" | "retired";
  provenance: string;
}

export type ReferenceRole =
  | "identity"
  | "appearance"
  | "pose"
  | "wardrobe"
  | "style"
  | "environment"
  | "product"
  | "motion"
  | "camera"
  | "composition"
  | "audio"
  | "storyboard";

export type ReferenceScope = "production" | "scene" | "shot" | "panel";
export type ReferencePriority = "mandatory" | "high_value" | "supporting" | "optional";

/** @deprecated alias — prefer ReferencePriority */
export type ReferencePriorityAlias = ReferencePriority;

export interface ClassifiedReference {
  referenceId: string;
  referenceRole: ReferenceRole;
  subjectId?: string;
  subjectKind?: string;
  scope: ReferenceScope;
  priority: ReferencePriority;
  version: number;
  provenance: string;
  url?: string;
  description?: string;
  attributes?: Record<string, string>;
}

export interface ReferenceConflict {
  code: "REFERENCE_CONFLICT";
  conflictingReferenceIds: string[];
  conflictingAttributes: string[];
  recommendedResolution: string;
  severity: "blocking" | "warning";
}

export interface ReferenceManifest {
  id: string;
  productionId: string;
  shotId?: string;
  panelId?: string;
  references: ClassifiedReference[];
  /** Explicit precedence — not a hard-coded universal winner */
  priorityOrder: string[];
  conflicts: ReferenceConflict[];
  version: number;
}

export interface ReferenceBudgetPlan {
  providerId: string;
  maxSlots: number;
  selected: ClassifiedReference[];
  omitted: Array<{ reference: ClassifiedReference; reason: string }>;
  preservedMandatory: boolean;
}

export type StoryboardLayout =
  | "2x2"
  | "3x3"
  | "3x4"
  | "4x4"
  | "horizontal-sequence"
  | "vertical-sequence"
  | "single-panel";

export type StoryboardMode = "previs" | "final" | "review";

export interface ContinuityHandoff {
  wardrobe: string[];
  propsHeld: string[];
  lighting: string;
  locationId?: string;
  subjectPosition: string;
  notes: string[];
}

export interface PanelCameraIntent {
  shotType: string;
  position: string;
  movement: string;
  lensIntent: string;
  depthOfField: string;
}

export interface PanelGenerationIntent {
  appearanceLocked: boolean;
  compositionFromPanel: boolean;
  /** Motion always comes from ShotSpec — never inferred from storyboard image alone */
  motionFromShotSpec: boolean;
  mode: StoryboardMode | "candidate";
}

export interface StoryboardPanelSpec {
  panelId: string;
  /** Canonical link — prefer panel.shotId over copying ShotSpec */
  shotId: string;
  sequenceIndex: number;
  purpose: string;
  dramaticBeat: string;
  visualObjective: string;
  editorialRole: string;
  composition: string;
  framing: string;
  camera: PanelCameraIntent;
  characters: string[];
  locations: string[];
  props: string[];
  products: string[];
  blocking: string;
  subjectAction: string;
  environmentAction: string;
  lightingIntent: string;
  visualTreatmentId?: string;
  temporalBeat: { startSec: number; endSec: number; pace: string };
  startState: string;
  endState: string;
  incomingState: ContinuityHandoff;
  outgoingState: ContinuityHandoff;
  referenceRequirements: string[];
  referenceAssignments: ClassifiedReference[];
  transitionToNext?: string;
  continuityRequirements: string[];
  generationIntent: PanelGenerationIntent;
  rationale: string[];
  confidence: number;
  validationIssues: string[];
}

export interface StoryboardValidationIssue {
  code: string;
  severity: "error" | "warning";
  message: string;
  panelId?: string;
  shotId?: string;
}

export interface StoryboardValidationResult {
  ok: boolean;
  issues: StoryboardValidationIssue[];
}

export interface StoryboardBlueprint {
  id: string;
  productionId: string;
  sceneId: string;
  sequenceId: string;
  aspectRatio: string;
  layout: StoryboardLayout;
  visualTreatmentId?: string;
  panels: StoryboardPanelSpec[];
  /** Machine mapping — do not rely on rendered panel labels */
  panelToShotMap: Record<string, string>;
  coveragePlan: string;
  continuityState: {
    handoffs: Array<{
      panelId: string;
      incoming: ContinuityHandoff;
      outgoing: ContinuityHandoff;
    }>;
  };
  referenceManifest: ReferenceManifest;
  validation: StoryboardValidationResult;
  version: number;
  status: "draft" | "revised" | "validated" | "approved" | "locked" | "superseded";
  visualLock: boolean;
  mode: StoryboardMode;
}

export interface StoryboardVersionRecord {
  version: number;
  previousVersion: number;
  changedPanels: string[];
  changedShotIds: string[];
  changedReferences: string[];
  reason: string;
  approved: boolean;
  createdAt: string;
}

export interface PanelRepairRequest {
  panelId: string;
  repairReason: string;
  notes?: string;
}

export interface ShotGenerationRisk {
  shotId: string;
  score: number;
  level: "low" | "medium" | "high";
  factors: string[];
  recommendedCandidates: number;
  recommendStrongerProvider: boolean;
  recommendMoreReferences: boolean;
}

export interface GenerationTrace {
  productionId: string;
  sceneId?: string;
  sequenceId?: string;
  shotId: string;
  panelId?: string;
  referenceManifestId?: string;
  generationTaskId?: string;
  providerId?: string;
  modelVersion?: string;
  outputAssetId?: string;
  qcResultId?: string;
  selectedCandidateId?: string;
  mode: StoryboardMode | "generation";
}

export interface VideoGenerationIntent {
  shotId: string;
  panelId?: string;
  productionId: string;
  appearance: {
    visualState: string;
    composition: string;
    framing: string;
    lighting: string;
    treatmentSummary: string;
  };
  motion: {
    subjectMotion: string;
    cameraMotion: string;
    environmentMotion: string;
    temporalOrder: string;
    speed: string;
  };
  camera: {
    position: string;
    lensIntent: string;
    depthOfField: string;
    movement: string;
  };
  environment: {
    locationId?: string;
    description: string;
  };
  temporal: {
    durationSec: number;
    startState: string;
    endState: string;
  };
  audio?: {
    dialogue?: string;
    ambience?: string;
  };
  continuity: {
    incomingState: string;
    outgoingState: string;
    requirements: string[];
  };
  referenceManifest: ReferenceManifest;
  capabilityRequirements: string[];
  aspectRatio: string;
  qualityTarget: "previs" | "balanced" | "final";
  candidateIndex?: number;
  trace: GenerationTrace;
}

export interface MultimodalVideoGenerationRequest {
  shotId: string;
  primaryStoryboardReference?: ClassifiedReference;
  characterReferences: ClassifiedReference[];
  locationReferences: ClassifiedReference[];
  productReferences: ClassifiedReference[];
  styleReferences: ClassifiedReference[];
  motionReferences: ClassifiedReference[];
  audioReferences: ClassifiedReference[];
  textIntent: string;
  cameraIntent: string;
  motionIntent: string;
  durationSec: number;
  aspectRatio: string;
  quality: "previs" | "balanced" | "final";
  capabilityRequirements: string[];
  packedReferences: ClassifiedReference[];
  budget?: ReferenceBudgetPlan;
  intent: VideoGenerationIntent;
}

export interface CandidateScore {
  candidateId: string;
  shotId: string;
  scores: {
    characterConsistency: number;
    locationConsistency: number;
    composition: number;
    motionQuality: number;
    cameraExecution: number;
    storyAccuracy: number;
    continuity: number;
    visualTreatment: number;
    artifactSeverity: number;
    editorialUsefulness: number;
  };
  overall: number;
  strengths: string[];
  weaknesses: string[];
}

export interface FilmmakingPrinciple {
  id: string;
  title: string;
  text: string;
  tags: Array<"ai-filmmaking" | "production-technique" | "research-supported">;
  certainty: "supported" | "directional" | "heuristic";
}
