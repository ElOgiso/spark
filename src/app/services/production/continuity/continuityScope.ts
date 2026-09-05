/**
 * Continuity scope inheritance — production → scene → sequence → shot.
 * Deterministic; more specific state overrides broader without mutating ancestors.
 */

import type { ContinuityScope, ContinuityState } from "../specification/continuitySpec";
import { emptyContinuityState } from "../specification/continuitySpec";

/** Default persistence scope for continuity facets. */
export const CONTINUITY_FACET_SCOPE: Record<string, ContinuityScope> = {
  identity: "production",
  "characters.identity": "production",
  "characters.appearance": "production",
  "characters.wardrobe": "scene",
  "characters.position": "shot",
  "characters.gaze": "shot",
  "characters.pose": "shot",
  "characters.heldPropIds": "sequence",
  location: "scene",
  lighting: "scene",
  "time.dayNight": "scene",
  "time.temporalMode": "shot",
  props: "sequence",
  products: "sequence",
  axis: "scene",
  "spatial.screenDirection": "sequence",
  cameraState: "shot",
  actionPhase: "shot",
  environmentFlags: "scene",
  visualTreatmentId: "production",
  locks: "production",
};

export function scopeRank(scope: ContinuityScope): number {
  switch (scope) {
    case "production":
      return 0;
    case "scene":
      return 1;
    case "sequence":
      return 2;
    case "shot":
      return 3;
    default:
      return 3;
  }
}

/**
 * Inherit broader → more specific. Later layers win per field.
 * Does not mutate any input layer.
 */
export function inheritContinuityLayers(layers: {
  production?: ContinuityState;
  scene?: ContinuityState;
  sequence?: ContinuityState;
  shot?: ContinuityState;
}): ContinuityState {
  const base = emptyContinuityState("inherited");
  const ordered: ContinuityState[] = [
    layers.production,
    layers.scene,
    layers.sequence,
    layers.shot,
  ].filter(Boolean) as ContinuityState[];

  let out: ContinuityState = { ...base };
  for (const layer of ordered) {
    out = {
      ...out,
      ...layer,
      identity: { ...out.identity, ...layer.identity },
      wardrobe: { ...out.wardrobe, ...layer.wardrobe },
      props: layer.props?.length ? layer.props : out.props,
      location: { ...out.location, ...layer.location },
      lighting: { ...out.lighting, ...layer.lighting },
      time: { ...out.time, ...layer.time },
      spatial: { ...out.spatial, ...layer.spatial },
      characters: layer.characters?.length ? structuredClone(layer.characters) : out.characters,
      products: layer.products?.length ? structuredClone(layer.products) : out.products,
      axis: layer.axis ?? out.axis,
      spatialRelations: layer.spatialRelations?.length
        ? structuredClone(layer.spatialRelations)
        : out.spatialRelations,
      environmentFlags: {
        ...(out.environmentFlags || {}),
        ...(layer.environmentFlags || {}),
      },
      actionPhase: layer.actionPhase ?? out.actionPhase,
      interactions: layer.interactions?.length
        ? structuredClone(layer.interactions)
        : out.interactions,
      visualTreatmentId: layer.visualTreatmentId ?? out.visualTreatmentId,
      locks: layer.locks?.length ? structuredClone(layer.locks) : out.locks,
      version: layer.version ?? out.version,
      source: layer.source ?? out.source,
      scope: layer.scope ?? out.scope,
      productionId: layer.productionId ?? out.productionId,
      sceneId: layer.sceneId ?? out.sceneId,
      sequenceId: layer.sequenceId ?? out.sequenceId,
      shotId: layer.shotId ?? out.shotId,
      summary: layer.summary || out.summary,
      emotionalState: layer.emotionalState ?? out.emotionalState,
      objectState: layer.objectState ?? out.objectState,
      cameraState: layer.cameraState ?? out.cameraState,
      audioState: layer.audioState ?? out.audioState,
    };
  }
  return out;
}

/**
 * When crossing scenes, drop shot/sequence-scoped facets unless carry is requested.
 * Production + scene-level identity/wardrobe/location/treatment persist by default.
 */
export function resetForSceneTransition(
  previous: ContinuityState,
  nextSceneId: string,
  options?: {
    carryProps?: boolean;
    carryScreenDirection?: boolean;
    temporalDiscontinuity?: ContinuityState["time"]["temporalMode"];
  }
): ContinuityState {
  const next: ContinuityState = structuredClone(previous);
  next.sceneId = nextSceneId;
  next.sequenceId = undefined;
  next.shotId = undefined;
  next.cameraState = undefined;
  next.actionPhase = undefined;
  next.interactions = [];
  next.spatialRelations = [];
  next.scope = "scene";

  if (!options?.carryProps) {
    next.props = [];
    next.products = [];
    next.characters = (next.characters || []).map((c) => ({
      ...c,
      heldPropIds: [],
      position: undefined,
      pose: undefined,
      gazeTarget: undefined,
      gazeDirection: undefined,
    }));
  }

  if (!options?.carryScreenDirection) {
    next.spatial = {
      ...next.spatial,
      subjectPosition: undefined,
      // Keep screen direction only when explicitly carried
      screenDirection: options?.carryScreenDirection ? next.spatial.screenDirection : undefined,
      cameraRelationship: undefined,
    };
  } else {
    next.spatial = {
      ...next.spatial,
      subjectPosition: undefined,
      cameraRelationship: undefined,
    };
  }

  if (options?.temporalDiscontinuity) {
    next.time = {
      ...next.time,
      temporalMode: options.temporalDiscontinuity,
      elapsedAction: undefined,
    };
  } else {
    next.time = { ...next.time, temporalMode: "continuous" };
  }

  next.summary = `Scene transition → ${nextSceneId}`;
  next.source = {
    kind: "derived",
    confidence: 0.9,
    assumptions: [
      options?.carryProps
        ? "props carried across scene intentionally"
        : "sequence props reset at scene boundary",
    ],
  };
  return next;
}
