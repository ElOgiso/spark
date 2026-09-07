/**
 * Production Asset Intelligence v2 — Anchor Assets, Reference Packages, Readiness.
 *
 * Composes Phase 4 registry + Production Asset Director output.
 * Does NOT create a second asset/registry/continuity system.
 */

import type { ProductionSpec } from "../specification/productionSpec";
import type { ShotSpec } from "../specification/shotSpec";
import type { CharacterMaster, LocationMaster, ProductionAssetRequirement } from "../specification/assetSpec";
import type { ProductionAssetRegistry } from "./registry";
import {
  buildReferenceRequirementsFromShot,
  resolveReferenceBundle,
  type ShotLikeForReferences,
} from "./resolve";
import type {
  AnchorAssetKind,
  ProductionAssetManifest,
  ProductionAssetManifestEntry,
  ReferenceAuthority,
  ReferenceBundle,
  ReferenceIssue,
  ReferencePackage,
  ReferenceRole,
  SemanticReferenceRole,
  ShotAssetManifest,
  ShotAssetReadiness,
  SupportingCastClass,
  SupportingCastMember,
  SupportingCastPlan,
} from "./types";
import {
  CHARACTER_IDENTITY_ATTRIBUTES,
  CHARACTER_STATE_ATTRIBUTES,
  LOCATION_IDENTITY_ATTRIBUTES,
  LOCATION_STATE_ATTRIBUTES,
} from "./types";

const SEMANTIC_TO_ROLES: Record<SemanticReferenceRole, ReferenceRole[]> = {
  CHARACTER_IDENTITY: ["canonical_identity", "character_sheet", "hero_reference", "face"],
  SUPPORTING_CHARACTER_IDENTITY: ["supporting_reference", "character_sheet", "canonical_identity"],
  ENVIRONMENT_IDENTITY: ["location_anchor", "environment"],
  LOCATION_GEOGRAPHY: ["location_anchor", "environment"],
  PROP_IDENTITY: ["prop_anchor"],
  WARDROBE_IDENTITY: ["wardrobe"],
  STYLE: ["style_anchor"],
  COMPOSITION: ["composition", "storyboard"],
  TEMPORAL_START_STATE: ["start_frame"],
  TEMPORAL_END_STATE: ["end_frame"],
  VOICE_IDENTITY: ["source_media"],
  MOTION_REFERENCE: ["source_media", "continuation_frame"],
};

export function semanticRolesFor(semantic: SemanticReferenceRole): ReferenceRole[] {
  return SEMANTIC_TO_ROLES[semantic] || [];
}

export function isIdentityAttribute(kind: "character" | "location", attr: string): boolean {
  const pool =
    kind === "character" ? CHARACTER_IDENTITY_ATTRIBUTES : LOCATION_IDENTITY_ATTRIBUTES;
  return (pool as readonly string[]).includes(attr);
}

export function isStateAttribute(kind: "character" | "location", attr: string): boolean {
  const pool = kind === "character" ? CHARACTER_STATE_ATTRIBUTES : LOCATION_STATE_ATTRIBUTES;
  return (pool as readonly string[]).includes(attr);
}

/** Complexity-driven character sheet views — not always the full set. */
export function requiredCharacterSheetViews(params: {
  role: string;
  productionMode?: string;
  contentFormat?: string;
  cinematic?: boolean;
}): string[] {
  const role = String(params.role || "").toLowerCase();
  if (role === "extra") return [];
  const format = String(params.contentFormat || "").toLowerCase();
  if (format === "faceless") return [];
  if (format === "host" || (!params.cinematic && role === "host")) {
    return ["front", "three_quarter", "face_closeup"];
  }
  if (params.cinematic || format === "story" || format === "anime") {
    if (role === "support" || role === "one_scene") {
      return ["front", "three_quarter", "full_body"];
    }
    return ["front", "three_quarter", "profile", "full_body", "face_closeup", "wardrobe_detail"];
  }
  return ["front", "three_quarter"];
}

export function classifySupportingCastMember(
  character: CharacterMaster,
  sourceSceneIds: string[],
  sceneCount: number
): SupportingCastClass {
  const role = String(character.role || "").toLowerCase();
  if (role === "extra") return "crowd_group";
  if (role === "host" || role === "primary") return "recurring_supporting"; // callers should filter leads
  if (sourceSceneIds.length <= 1 && sceneCount > 1) return "one_scene";
  if (sourceSceneIds.length >= Math.max(2, Math.ceil(sceneCount / 2))) return "recurring_supporting";
  return "one_scene";
}

/**
 * Resolve Supporting Cast from ProductionSpec + Asset Director requirements.
 * Lead (host/primary) is excluded — Supporting Cast is the secondary identity layer.
 */
export function resolveSupportingCast(spec: ProductionSpec): SupportingCastPlan {
  const requirements = spec.meta.assetDirector?.requirements || [];
  const sceneCount = spec.scenes.length;
  const members: SupportingCastMember[] = [];

  for (const c of spec.characters || []) {
    const role = String(c.role || "").toLowerCase();
    if (role === "host" || role === "primary") continue;

    const req = requirements.find(
      (r) => r.kind === "character" && r.masterAssetRef === c.identity.ref
    );
    const sceneIds = req?.sourceSceneIds?.length
      ? req.sourceSceneIds
      : spec.scenes.filter((s) => (s.characterIds || []).includes(c.identity.ref)).map((s) => s.id);

    const castClass = classifySupportingCastMember(c, sceneIds, sceneCount);
    const requiresSheet =
      castClass === "recurring_supporting" ||
      (castClass === "one_scene" && role !== "extra" && String(spec.project.productionMode) === "deep");

    members.push({
      characterRef: c.identity.ref,
      name: c.name,
      castClass,
      narrativePurpose: req?.narrativePurpose || c.description || "Supporting presence",
      sceneIds,
      requiresCharacterSheet: requiresSheet && role !== "extra",
      generationRequired: Boolean(req?.generationRequired) && role !== "extra",
      existingMasterRef: req?.existingAssetRef,
    });
  }

  return {
    productionId: spec.project.id,
    members,
    resolvedAt: new Date().toISOString(),
  };
}

export function isAnchorRequirement(req: ProductionAssetRequirement): boolean {
  if (!req.required) return false;
  if (req.kind === "character" && req.role === "extra") return false;
  if (req.kind === "character" || req.kind === "location" || req.kind === "style") return true;
  if (req.kind === "prop" && req.generationRequired) return true;
  if (req.kind === "wardrobe" && req.required) return true;
  return false;
}

export function anchorKindForRequirement(req: ProductionAssetRequirement): AnchorAssetKind | null {
  if (!isAnchorRequirement(req)) return null;
  switch (req.kind) {
    case "character":
      return req.role === "support" || req.role === "extra"
        ? "supporting_character_sheet"
        : "character_sheet";
    case "location":
      // Location plates are the visual geography anchors; locked set is the identity.
      // Prefer plate when generation is for an empty environment reference.
      return req.visualContract?.emptySet || req.state || req.generationRequired
        ? "location_plate"
        : "locked_set";
    case "prop":
      return "prop_reference";
    case "wardrobe":
      return "wardrobe_reference";
    case "style":
      return "style_reference";
    case "voice":
      return "voice_reference";
    case "product":
      return "product_reference";
    case "creature":
      return "creature_reference";
    default:
      return null;
  }
}

/** Stamp identity/state + locked-set/plate flags onto masters from director output. */
export function enrichMastersWithAnchorSemantics(spec: ProductionSpec): ProductionSpec {
  const mode = String(spec.project.productionMode || "");
  const cinematic = mode === "deep" || mode.includes("cinematic");
  const format = String(spec.meta?.contentFormat || "").toLowerCase();

  const characters = (spec.characters || []).map((c) => {
    const views = requiredCharacterSheetViews({
      role: String(c.role),
      productionMode: mode,
      contentFormat: format || (c.role === "host" ? "host" : "story"),
      cinematic,
    });
    return {
      ...c,
      identityLocks: c.identityLocks || [...CHARACTER_IDENTITY_ATTRIBUTES],
      variableAttributes: c.variableAttributes || [...CHARACTER_STATE_ATTRIBUTES],
      requiredSheetViews: c.requiredSheetViews || views,
    };
  });

  const locations: LocationMaster[] = (spec.assets || [])
    .filter((a): a is LocationMaster => a.kind === "location")
    .map((loc) => ({
      ...loc,
      lockedSet: loc.lockedSet !== false,
      plateRequired: loc.plateRequired !== false && cinematic,
      identityLocks: loc.identityLocks || [...LOCATION_IDENTITY_ATTRIBUTES],
      variableAttributes: loc.variableAttributes || [...LOCATION_STATE_ATTRIBUTES],
      spatialLandmarks: loc.spatialLandmarks || ["architectural landmarks", "material palette"],
    }));

  // Keep world.locations in sync with plate/set intent
  const world = {
    ...spec.world,
    locations: spec.world.locations.map((w) => {
      const master = locations.find((l) => l.identity.ref === w.masterAssetId || l.identity.ref === w.id);
      return master
        ? {
            ...w,
            description: master.description || w.description,
          }
        : w;
    }),
  };

  const otherAssets = (spec.assets || []).filter((a) => a.kind !== "location" && a.kind !== "character");
  return {
    ...spec,
    characters,
    assets: [...characters, ...locations, ...otherAssets],
    world,
  };
}

function authorityOk(a?: ReferenceAuthority): boolean {
  return a === "canonical" || a === "approved" || a === "preferred";
}

/**
 * Build minimum-sufficient Reference Package for a shot.
 * Uses existing resolveReferenceBundle authority policy.
 */
export function buildReferencePackage(params: {
  registry: ProductionAssetRegistry;
  productionId: string;
  shot: ShotSpec;
  /** When false, omit optional temporal/motion slots */
  includeTemporal?: boolean;
}): ReferencePackage {
  const { registry, productionId, shot } = params;
  const includeTemporal = params.includeTemporal !== false;

  const shotLike: ShotLikeForReferences = {
    id: shot.id,
    sceneId: shot.sceneId,
    references: shot.references || { characterRefs: [], locationRefs: [], styleRefs: [] },
    characterIds: shot.characterIds,
    propIds: shot.propIds,
  };

  const requirements = buildReferenceRequirementsFromShot(shotLike, { required: true });
  const bundle = resolveReferenceBundle(registry, {
    productionId,
    shotId: shot.id,
    sceneId: shot.sceneId,
    requirements,
    strict: true,
  });

  const byEntity = new Map(bundle.references.map((r) => [`${r.entityType}:${r.entityId}:${r.role}`, r]));

  const pick = (semantic: SemanticReferenceRole, required: boolean, reason: string) => {
    const roles = semanticRolesFor(semantic);
    const match = bundle.references.find((r) => roles.includes(r.role));
    return {
      semantic,
      required,
      included: Boolean(match),
      reason: match
        ? `Resolved ${match.role} @ ${match.authority} (${match.reason})`
        : reason,
      resolved: match,
      registryRole: match?.role,
    };
  };

  const slots = [
    pick(
      "CHARACTER_IDENTITY",
      (shot.characterIds || []).length > 0,
      "No character identity anchor resolved"
    ),
    pick("ENVIRONMENT_IDENTITY", (shot.references?.locationRefs || []).length > 0, "No locked set/location anchor"),
    pick("LOCATION_GEOGRAPHY", (shot.references?.locationRefs || []).length > 0, "No location plate/geography anchor"),
    pick("STYLE", false, "Style optional for this shot"),
    pick("COMPOSITION", false, "Storyboard/composition optional until panel exists"),
  ];

  if (includeTemporal && shot.references?.firstFrameUrl) {
    slots.push(pick("TEMPORAL_START_STATE", false, "Start frame not required"));
  }
  if (includeTemporal && shot.references?.lastFrameUrl) {
    slots.push(pick("TEMPORAL_END_STATE", false, "End frame not required"));
  }

  // Drop unused optional slots for minimum sufficiency
  const pruned = slots.filter((s) => s.required || s.included);
  const conflicts = bundle.issues.filter(
    (i) => i.code === "REFERENCE_AUTHORITY_CONFLICT" || i.code === "REFERENCE_WRONG_ROLE"
  );

  const requiredMissing = pruned.filter((s) => s.required && !s.included);
  void byEntity;

  return {
    productionId,
    shotId: shot.id,
    sceneId: shot.sceneId,
    slots: pruned,
    bundle,
    conflicts,
    minimumSufficient: requiredMissing.length === 0 && conflicts.length === 0,
    builtAt: new Date().toISOString(),
  };
}

/**
 * Shot generation readiness — mandatory anchors must be ready.
 * Does not substitute prompt text for missing identity.
 */
export function assessShotAssetReadiness(params: {
  spec: ProductionSpec;
  shot: ShotSpec;
  registry?: ProductionAssetRegistry;
}): ShotAssetReadiness {
  const { spec, shot, registry } = params;
  const mode = String(spec.project.productionMode || "");
  const narrative =
    mode === "deep" ||
    mode.includes("cinematic") ||
    spec.creative.requiresCharacters ||
    (spec.characters || []).length > 0;

  const items: ShotAssetReadiness["items"] = [];
  const blockers: string[] = [];
  const requirements = spec.meta.assetDirector?.requirements || [];

  const shotCharRefs = new Set([
    ...(shot.characterIds || []),
    ...(shot.references?.characterRefs || []),
  ]);

  for (const ref of shotCharRefs) {
    const char = (spec.characters || []).find((c) => c.identity.ref === ref || c.identity.baseId === ref);
    const role = String(char?.role || "primary").toLowerCase();
    if (role === "extra") {
      items.push({
        kind: "supporting_character_sheet",
        name: char?.name || ref,
        masterRef: char?.identity.ref,
        required: false,
        ready: true,
        reason: "Background extra — no Character Sheet master required",
      });
      continue;
    }
    const req = requirements.find((r) => r.masterAssetRef === char?.identity.ref);
    const hasUrls = (char?.approvedReferenceUrls || []).length > 0 || Boolean(req && !req.generationRequired);
    let registryReady = false;
    if (registry && char) {
      const listed = registry.list({
        productionId: spec.project.id,
        entityType: "character",
        entityId: char.identity.baseId,
        allowGlobal: true,
      });
      registryReady = listed.some((a) => authorityOk(a.authority) && a.referenceEligible);
    }
    const ready = hasUrls || registryReady || Boolean(req && !req.generationRequired && req.existingAssetRef);
    const required = narrative && role !== "extra";
    items.push({
      kind: role === "support" ? "supporting_character_sheet" : "character_sheet",
      name: char?.name || ref,
      masterRef: char?.identity.ref || ref,
      required,
      ready: !required || ready,
      reason: ready
        ? "Character identity anchor present"
        : "BLOCK: Character Sheet required before dependent shot generation — do not compensate with prompt text",
      generationRequired: req?.generationRequired,
    });
    if (required && !ready) {
      blockers.push(`Missing Character Sheet for ${char?.name || ref}`);
    }
  }

  const locRefs = shot.references?.locationRefs || [];
  const scene = spec.scenes.find((s) => s.id === shot.sceneId);
  const locationId = scene?.locationId || locRefs[0];
  if (locationId && narrative && mode === "deep") {
    const locReq = requirements.find((r) => r.kind === "location" && r.masterAssetRef === locationId);
    const locAsset = (spec.assets || []).find((a) => a.kind === "location" && a.identity.ref === locationId) as
      | LocationMaster
      | undefined;
    const plateReady =
      (locAsset?.approvedReferenceUrls || []).length > 0 ||
      Boolean(locReq && !locReq.generationRequired && locReq.existingAssetRef);
    const setReady = Boolean(locAsset || locReq);
    items.push({
      kind: "locked_set",
      name: locAsset?.name || locationId,
      masterRef: locationId,
      required: true,
      ready: setReady,
      reason: setReady ? "Locked Set identity present" : "BLOCK: Locked Set required for recurring location",
    });
    items.push({
      kind: "location_plate",
      name: `${locAsset?.name || locationId} plate`,
      masterRef: locationId,
      required: true,
      ready: plateReady || Boolean(locReq && locReq.generationRequired === false),
      reason: plateReady
        ? "Location Plate present"
        : locReq?.generationRequired
          ? "Location Plate generation required before shot generation"
          : "BLOCK: Location Plate required for environment continuity",
      generationRequired: locReq?.generationRequired,
    });
    if (!setReady) blockers.push(`Missing Locked Set for ${locationId}`);
    if (!plateReady && locReq?.generationRequired) {
      blockers.push(`Location Plate not ready for ${locationId}`);
    }
  }

  const styleReq = requirements.find((r) => r.kind === "style");
  if (styleReq) {
    items.push({
      kind: "style_reference",
      name: styleReq.name,
      masterRef: styleReq.masterAssetRef,
      required: true,
      ready: Boolean(styleReq.masterAssetRef),
      reason: "Production style treatment",
    });
  }

  // Storyboard: purpose present counts as blueprint readiness at planning stage
  items.push({
    kind: "storyboard",
    name: "Shot purpose / blueprint",
    required: true,
    ready: Boolean(shot.productionReason || shot.purpose),
    reason: shot.productionReason ? "Shot contract purpose present" : "Missing shot purpose",
  });
  if (!(shot.productionReason || shot.purpose)) blockers.push(`Shot ${shot.id} missing purpose`);

  return {
    shotId: shot.id,
    sceneId: shot.sceneId,
    generationReady: blockers.length === 0,
    items,
    blockers,
  };
}

export function assessProductionAssetReadiness(spec: ProductionSpec): {
  ok: boolean;
  shots: ShotAssetReadiness[];
  blockers: string[];
} {
  const shots: ShotAssetReadiness[] = [];
  const blockers: string[] = [];
  for (const scene of spec.scenes || []) {
    for (const shot of scene.shots || []) {
      const r = assessShotAssetReadiness({ spec, shot });
      shots.push(r);
      blockers.push(...r.blockers);
    }
  }
  return { ok: blockers.length === 0, shots, blockers };
}

function entryFromRequirement(
  req: ProductionAssetRequirement,
  isAnchor: boolean
): ProductionAssetManifestEntry {
  return {
    kind: anchorKindForRequirement(req) || req.kind,
    name: req.name,
    masterRef: req.masterAssetRef,
    status: req.generationRequired ? "draft" : "approved",
    lock: !req.generationRequired && Boolean(req.existingAssetRef || req.masterAssetRef),
    sceneIds: req.sourceSceneIds || [],
    shotIds: req.sourceShotIds || [],
    dependencies: req.dependencies || [],
    generationRequired: req.generationRequired,
    isAnchor,
  };
}

export function buildProductionAssetManifest(spec: ProductionSpec): ProductionAssetManifest {
  const requirements = spec.meta.assetDirector?.requirements || [];
  const supportingCast = resolveSupportingCast(spec).members;

  const characters = requirements
    .filter((r) => r.kind === "character" && r.role !== "extra")
    .map((r) => entryFromRequirement(r, true));
  const locations = requirements
    .filter((r) => r.kind === "location")
    .map((r) => entryFromRequirement(r, true));
  const props = requirements
    .filter((r) => r.kind === "prop")
    .map((r) => entryFromRequirement(r, isAnchorRequirement(r)));
  const wardrobe = requirements
    .filter((r) => r.kind === "wardrobe")
    .map((r) => entryFromRequirement(r, true));
  const style = requirements
    .filter((r) => r.kind === "style")
    .map((r) => entryFromRequirement(r, true));
  const anchors = requirements.filter(isAnchorRequirement).map((r) => entryFromRequirement(r, true));

  return {
    productionId: spec.project.id,
    characters,
    supportingCast,
    locations,
    props,
    wardrobe,
    style,
    anchors,
    builtAt: new Date().toISOString(),
  };
}

export function buildShotAssetManifest(params: {
  spec: ProductionSpec;
  shot: ShotSpec;
  registry?: ProductionAssetRegistry;
}): ShotAssetManifest {
  const readiness = assessShotAssetReadiness(params);
  let referencePackage: ReferencePackage | undefined;
  if (params.registry) {
    referencePackage = buildReferencePackage({
      registry: params.registry,
      productionId: params.spec.project.id,
      shot: params.shot,
    });
  }

  const bindings: ShotAssetManifest["bindings"] = [];
  for (const ref of params.shot.characterIds || []) {
    bindings.push({ semantic: "CHARACTER_IDENTITY", masterRef: ref });
  }
  for (const ref of params.shot.references?.locationRefs || []) {
    bindings.push({ semantic: "LOCATION_GEOGRAPHY", masterRef: ref });
    bindings.push({ semantic: "ENVIRONMENT_IDENTITY", masterRef: ref });
  }
  for (const ref of params.shot.references?.styleRefs || []) {
    bindings.push({ semantic: "STYLE", masterRef: ref });
  }
  for (const ref of params.shot.propIds || []) {
    bindings.push({ semantic: "PROP_IDENTITY", masterRef: ref });
  }

  return {
    shotId: params.shot.id,
    sceneId: params.shot.sceneId,
    bindings,
    referencePackage,
    generationReady: readiness.generationReady,
    builtAt: new Date().toISOString(),
  };
}

/**
 * Apply v2 intelligence onto a directed ProductionSpec (immutable).
 * Call after Asset Director + visual planning.
 */
export function applyProductionAssetIntelligence(spec: ProductionSpec): ProductionSpec {
  const enriched = enrichMastersWithAnchorSemantics(spec);
  const supportingCast = resolveSupportingCast(enriched);
  const manifest = buildProductionAssetManifest(enriched);
  const readiness = assessProductionAssetReadiness(enriched);

  return {
    ...enriched,
    meta: {
      ...enriched.meta,
      assetIntelligence: {
        supportingCast,
        manifest,
        readiness: {
          ok: readiness.ok,
          blockerCount: readiness.blockers.length,
          blockers: readiness.blockers.slice(0, 24),
          shotCount: readiness.shots.length,
          readyShotCount: readiness.shots.filter((s) => s.generationReady).length,
        },
        identityModel: {
          characterIdentity: [...CHARACTER_IDENTITY_ATTRIBUTES],
          characterState: [...CHARACTER_STATE_ATTRIBUTES],
          locationIdentity: [...LOCATION_IDENTITY_ATTRIBUTES],
          locationState: [...LOCATION_STATE_ATTRIBUTES],
        },
      },
    },
  };
}

export type { ReferenceBundle, ReferenceIssue };
