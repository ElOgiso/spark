/**
 * Master asset identity system.
 * Scenes/shots reference stable asset IDs (e.g. character_001:v3) instead of re-describing.
 */

export type MasterAssetKind =
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
  | "music";

export interface MasterAssetIdentity {
  /** Stable base id without version, e.g. character_001 */
  baseId: string;
  /** Semver-like integer version */
  version: number;
  /** Canonical reference string character_001:v3 */
  ref: string;
}

export function makeAssetRef(baseId: string, version: number): string {
  const safeBase = baseId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const v = Math.max(1, Math.floor(version));
  return `${safeBase}:v${v}`;
}

export function parseAssetRef(ref: string): MasterAssetIdentity | null {
  const m = /^([a-zA-Z0-9_-]+):v(\d+)$/.exec(ref.trim());
  if (!m) return null;
  return { baseId: m[1], version: Number(m[2]), ref: `${m[1]}:v${m[2]}` };
}

export interface MasterAssetBase {
  identity: MasterAssetIdentity;
  kind: MasterAssetKind;
  name: string;
  description: string;
  approvedReferenceUrls: string[];
  tags: string[];
  status: "draft" | "approved" | "retired";
  createdAt: string;
  updatedAt: string;
}

export interface CharacterMaster extends MasterAssetBase {
  kind: "character";
  role: "host" | "primary" | "support" | "extra" | "narrator_visual" | string;
  visualAttributes: {
    face?: string;
    body?: string;
    hair?: string;
    definingCharacteristics: string[];
  };
  wardrobeState?: {
    outfitId?: string;
    description: string;
    colors?: string[];
  };
  voiceId?: string;
  performanceNotes?: string;
  /**
   * Identity attributes that must not drift across shots.
   * Distinct from wardrobeState / expression / lighting (variable state).
   */
  identityLocks?: string[];
  /** Attributes allowed to vary without identity drift (expression, dirt, wetness, etc.) */
  variableAttributes?: string[];
  /** Character sheet view requirements (complexity-driven) */
  requiredSheetViews?: string[];
}

export interface LocationMaster extends MasterAssetBase {
  kind: "location";
  geography?: string;
  architecture?: string;
  environment: string;
  defaultLighting?: string;
  defaultTimeOfDay?: string;
  /** Locked Set = what the location is (architecture/layout/landmarks) */
  lockedSet?: boolean;
  /** Location Plate = visual production reference for geography/camera */
  plateRequired?: boolean;
  spatialLandmarks?: string[];
  entryExitPoints?: string[];
  /** Location identity vs state (day/night/damaged) */
  identityLocks?: string[];
  variableAttributes?: string[];
}

export interface WardrobeMaster extends MasterAssetBase {
  kind: "wardrobe";
  characterId?: string;
  colors: string[];
  accessories?: string[];
}

export interface PropMaster extends MasterAssetBase {
  kind: "prop";
  objectState?: string;
  handheld?: boolean;
}

export interface VehicleMaster extends MasterAssetBase {
  kind: "vehicle";
  vehicleType: string;
}

export interface CreatureMaster extends MasterAssetBase {
  kind: "creature";
  species?: string;
}

export interface ProductMaster extends MasterAssetBase {
  kind: "product";
  brandName?: string;
  heroAngle?: string;
  mustShowFeatures: string[];
}

export interface LogoMaster extends MasterAssetBase {
  kind: "logo";
  usageRules?: string;
}

export interface StyleMaster extends MasterAssetBase {
  kind: "style";
  look: string;
  colorLanguage: string;
  cameraLanguage?: string;
}

export interface VoiceMaster extends MasterAssetBase {
  kind: "voice";
  provider?: string;
  voiceProviderId?: string;
  cadence?: string;
  language?: string;
}

export interface MusicMaster extends MasterAssetBase {
  kind: "music";
  mood: string;
  bpm?: number;
  energy?: string;
}

export type MasterAssetRef =
  | CharacterMaster
  | LocationMaster
  | WardrobeMaster
  | PropMaster
  | VehicleMaster
  | CreatureMaster
  | ProductMaster
  | LogoMaster
  | StyleMaster
  | VoiceMaster
  | MusicMaster;

/** Lightweight pointer used inside shots/scenes */
export interface AssetMasterRef {
  ref: string;
  kind: MasterAssetKind;
  role?: string;
}

export function createCharacterMaster(params: {
  baseId: string;
  version?: number;
  name: string;
  description: string;
  role?: CharacterMaster["role"];
  definingCharacteristics?: string[];
  referenceUrls?: string[];
}): CharacterMaster {
  const version = params.version ?? 1;
  const now = new Date().toISOString();
  const identity = {
    baseId: params.baseId,
    version,
    ref: makeAssetRef(params.baseId, version),
  };
  return {
    identity,
    kind: "character",
    name: params.name,
    description: params.description,
    approvedReferenceUrls: params.referenceUrls ?? [],
    tags: [],
    status: "approved",
    createdAt: now,
    updatedAt: now,
    role: params.role ?? "primary",
    visualAttributes: {
      definingCharacteristics: params.definingCharacteristics ?? [],
    },
  };
}

export function createLocationMaster(params: {
  baseId: string;
  version?: number;
  name: string;
  description: string;
  environment?: string;
  referenceUrls?: string[];
}): LocationMaster {
  const version = params.version ?? 1;
  const now = new Date().toISOString();
  return {
    identity: {
      baseId: params.baseId,
      version,
      ref: makeAssetRef(params.baseId, version),
    },
    kind: "location",
    name: params.name,
    description: params.description,
    approvedReferenceUrls: params.referenceUrls ?? [],
    tags: [],
    status: "approved",
    createdAt: now,
    updatedAt: now,
    environment: params.environment ?? params.description,
  };
}


export function createPropMaster(params: {
  baseId: string;
  version?: number;
  name: string;
  description: string;
  objectState?: string;
  handheld?: boolean;
  referenceUrls?: string[];
}): PropMaster {
  const version = params.version ?? 1;
  const now = new Date().toISOString();
  return {
    identity: {
      baseId: params.baseId,
      version,
      ref: makeAssetRef(params.baseId, version),
    },
    kind: "prop",
    name: params.name,
    description: params.description,
    approvedReferenceUrls: params.referenceUrls ?? [],
    tags: [],
    status: "approved",
    createdAt: now,
    updatedAt: now,
    objectState: params.objectState,
    handheld: params.handheld,
  };
}

export function resolveMasterByRef(
  assets: MasterAssetRef[],
  ref: string
): MasterAssetRef | undefined {
  return assets.find((a) => a.identity.ref === ref || a.identity.baseId === ref);
}


export function createWardrobeMaster(params: {
  baseId: string;
  version?: number;
  name: string;
  description: string;
  characterId?: string;
  colors?: string[];
  accessories?: string[];
  referenceUrls?: string[];
}): WardrobeMaster {
  const version = params.version ?? 1;
  const now = new Date().toISOString();
  return {
    identity: {
      baseId: params.baseId,
      version,
      ref: makeAssetRef(params.baseId, version),
    },
    kind: "wardrobe",
    name: params.name,
    description: params.description,
    approvedReferenceUrls: params.referenceUrls ?? [],
    tags: [],
    status: "draft",
    createdAt: now,
    updatedAt: now,
    characterId: params.characterId,
    colors: params.colors ?? [],
    accessories: params.accessories,
  };
}

export function createStyleMaster(params: {
  baseId: string;
  version?: number;
  name: string;
  description: string;
  look: string;
  colorLanguage: string;
  cameraLanguage?: string;
  referenceUrls?: string[];
}): StyleMaster {
  const version = params.version ?? 1;
  const now = new Date().toISOString();
  return {
    identity: {
      baseId: params.baseId,
      version,
      ref: makeAssetRef(params.baseId, version),
    },
    kind: "style",
    name: params.name,
    description: params.description,
    approvedReferenceUrls: params.referenceUrls ?? [],
    tags: [],
    status: "approved",
    createdAt: now,
    updatedAt: now,
    look: params.look,
    colorLanguage: params.colorLanguage,
    cameraLanguage: params.cameraLanguage,
  };
}

/** Narrative-aware asset requirement — planning only; does not generate media. */
export type AssetRequirementOrigin = "ai_inferred" | "user_confirmed" | "user_overridden" | "system_required";

export interface ProductionAssetRequirement {
  id: string;
  kind: MasterAssetKind;
  name: string;
  role?: string;
  narrativePurpose: string;
  required: boolean;
  /** Existing approved master to reuse when present */
  existingAssetRef?: string;
  masterAssetRef?: string;
  sourceSceneIds: string[];
  sourceShotIds: string[];
  visualContract: Record<string, unknown>;
  generationRequired: boolean;
  generationReason: string;
  prompt?: string;
  referenceUrls: string[];
  dependencies: string[];
  continuityGroup?: string;
  state?: string;
  origin: AssetRequirementOrigin;
  /** 0–1 confidence that this requirement is narratively necessary */
  confidence?: number;
}
