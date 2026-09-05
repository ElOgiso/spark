/**
 * Deterministic ContinuityDelta application.
 * LLM must not perform basic inheritance / delta merge — this module owns that.
 */

import type {
  ContinuityCharacterEntity,
  ContinuityDelta,
  ContinuityFieldChange,
  ContinuityLock,
  ContinuityProductEntity,
  ContinuityPropState,
  ContinuityState,
} from "../specification/continuitySpec";

function cloneState(state: ContinuityState): ContinuityState {
  return structuredClone(state);
}

function isLocked(locks: ContinuityLock[] | undefined, subjectId: string, field?: string): boolean {
  return (locks || []).some(
    (l) =>
      l.locked &&
      l.subjectId === subjectId &&
      (field ? l.field === field || l.field === "*" || !l.field : true)
  );
}

function syncPropHolders(state: ContinuityState): ContinuityState {
  const next = cloneState(state);
  const byHolder = new Map<string, string[]>();
  for (const prop of next.props) {
    if (prop.holderId) {
      const list = byHolder.get(prop.holderId) || [];
      list.push(prop.propId);
      byHolder.set(prop.holderId, list);
    }
  }
  next.characters = (next.characters || []).map((c) => ({
    ...c,
    heldPropIds: byHolder.get(c.characterId) || [],
  }));
  return next;
}

function applyCharacterChange(
  characters: ContinuityCharacterEntity[],
  change: ContinuityFieldChange,
  locks: ContinuityLock[] | undefined
): ContinuityCharacterEntity[] {
  const match = /^characters\.([^.]+)\.(.+)$/.exec(change.path);
  if (!match) return characters;
  const [, characterId, field] = match;
  if (isLocked(locks, characterId, field) && change.changeKind !== "intentional") {
    throw new Error(`Locked continuity field cannot mutate implicitly: ${change.path}`);
  }
  return characters.map((c) => {
    if (c.characterId !== characterId) return c;
    if (field.startsWith("wardrobe.")) {
      const wField = field.slice("wardrobe.".length);
      return {
        ...c,
        wardrobe: { ...(c.wardrobe || {}), [wField]: change.to as string },
      };
    }
    if (field === "heldPropIds" && Array.isArray(change.to)) {
      return { ...c, heldPropIds: change.to as string[] };
    }
    return {
      ...c,
      [field]: change.to,
      version: field === "version" ? Number(change.to) : c.version,
    };
  });
}

function applyPropChange(
  props: ContinuityPropState[],
  change: ContinuityFieldChange,
  locks: ContinuityLock[] | undefined
): ContinuityPropState[] {
  const match = /^props\.([^.]+)\.(.+)$/.exec(change.path);
  if (!match) return props;
  const [, propId, field] = match;
  if (isLocked(locks, propId, field) && change.changeKind !== "intentional") {
    throw new Error(`Locked continuity field cannot mutate implicitly: ${change.path}`);
  }
  return props.map((p) => (p.propId === propId ? { ...p, [field]: change.to } : p));
}

function applyProductChange(
  products: ContinuityProductEntity[],
  change: ContinuityFieldChange,
  locks: ContinuityLock[] | undefined
): ContinuityProductEntity[] {
  const match = /^products\.([^.]+)\.(.+)$/.exec(change.path);
  if (!match) return products;
  const [, productId, field] = match;
  if (isLocked(locks, productId, field) && change.changeKind !== "intentional") {
    throw new Error(`Locked continuity field cannot mutate implicitly: ${change.path}`);
  }
  return products.map((p) =>
    p.productId === productId ? { ...p, [field]: change.to } : p
  );
}

function upsertByPath(state: ContinuityState, change: ContinuityFieldChange): ContinuityState {
  const next = cloneState(state);
  if (change.path === "spatial.screenDirection") {
    next.spatial = { ...next.spatial, screenDirection: String(change.to ?? "") };
    return next;
  }
  if (change.path === "spatial.subjectPosition") {
    next.spatial = { ...next.spatial, subjectPosition: String(change.to ?? "") };
    return next;
  }
  if (change.path === "wardrobe.clothing") {
    const wardrobeLocked =
      isLocked(next.locks, "wardrobe", "clothing") ||
      (next.characters || []).some((c) => isLocked(next.locks, c.characterId, "clothing"));
    if (wardrobeLocked && change.changeKind !== "intentional") {
      throw new Error("Locked wardrobe.clothing cannot mutate implicitly");
    }
    next.wardrobe = { ...next.wardrobe, clothing: String(change.to ?? "") };
    if (next.characters?.length) {
      next.characters = next.characters.map((c, i) =>
        i === 0
          ? { ...c, wardrobe: { ...(c.wardrobe || {}), clothing: String(change.to ?? "") } }
          : c
      );
    }
    return next;
  }
  if (change.path === "actionPhase") {
    next.actionPhase = String(change.to ?? "");
    return next;
  }
  if (change.path === "cameraState") {
    next.cameraState = String(change.to ?? "");
    return next;
  }
  if (change.path === "time.temporalMode") {
    next.time = {
      ...next.time,
      temporalMode: change.to as ContinuityState["time"]["temporalMode"],
    };
    return next;
  }
  if (change.path === "time.elapsedAction") {
    next.time = { ...next.time, elapsedAction: String(change.to ?? "") };
    return next;
  }
  if (change.path.startsWith("environmentFlags.")) {
    const key = change.path.slice("environmentFlags.".length);
    next.environmentFlags = { ...(next.environmentFlags || {}), [key]: String(change.to ?? "") };
    return next;
  }
  if (change.path.startsWith("characters.")) {
    next.characters = applyCharacterChange(next.characters || [], change, next.locks);
    return next;
  }
  if (change.path.startsWith("props.")) {
    next.props = applyPropChange(next.props, change, next.locks);
    return next;
  }
  if (change.path.startsWith("products.")) {
    next.products = applyProductChange(next.products || [], change, next.locks);
    return next;
  }
  if (change.path === "axis.cameraSide") {
    next.axis = {
      axisId: next.axis?.axisId || "axis_main",
      orientation: next.axis?.orientation || "unspecified",
      cameraSide: String(change.to ?? ""),
      crossingIntent: change.changeKind === "intentional" ? "intentional" : next.axis?.crossingIntent,
      crossingReason: change.reason,
    };
    return next;
  }
  if (change.path === "axis.crossingIntent") {
    next.axis = {
      axisId: next.axis?.axisId || "axis_main",
      orientation: next.axis?.orientation || "unspecified",
      cameraSide: next.axis?.cameraSide || "unspecified",
      crossingIntent: change.to as "none" | "intentional",
      crossingReason: change.reason,
    };
    return next;
  }
  return next;
}

function removeByPath(state: ContinuityState, change: ContinuityFieldChange): ContinuityState {
  const next = cloneState(state);
  const propMatch = /^props\.([^.]+)$/.exec(change.path);
  if (propMatch) {
    const propId = propMatch[1];
    if (isLocked(next.locks, propId) && change.changeKind !== "intentional") {
      throw new Error(`Locked prop cannot be removed implicitly: ${propId}`);
    }
    next.props = next.props.filter((p) => p.propId !== propId);
    next.characters = (next.characters || []).map((c) => ({
      ...c,
      heldPropIds: (c.heldPropIds || []).filter((id) => id !== propId),
    }));
    return next;
  }
  return next;
}

/**
 * Apply a structured delta onto a continuity state.
 * Throws when a locked field would mutate without intentional changeKind.
 */
export function applyContinuityDelta(state: ContinuityState, delta: ContinuityDelta): ContinuityState {
  let next = cloneState(state);
  next.shotId = delta.toShotId;
  next.sceneId = delta.sceneId ?? next.sceneId;

  for (const change of delta.removed) next = removeByPath(next, change);
  for (const change of [
    ...delta.added,
    ...delta.changed,
    ...delta.moved,
    ...delta.transformed,
    ...delta.transferred,
    ...delta.consumed,
  ]) {
    next = upsertByPath(next, change);
  }

  // Normalize heldPropIds from prop.holderId after holder transfers
  if (delta.transferred.some((c) => c.path.includes(".holderId"))) {
    next = syncPropHolders(next);
  }

  const primary = next.characters?.[0];
  if (primary) {
    next.identity = {
      ...next.identity,
      characterRefs: Array.from(
        new Set([...(next.identity.characterRefs || []), primary.characterId])
      ),
      definingCharacteristics: next.identity.definingCharacteristics.length
        ? next.identity.definingCharacteristics
        : [primary.identity],
    };
    if (primary.wardrobe) {
      next.wardrobe = { ...next.wardrobe, ...primary.wardrobe };
    }
  }

  next.summary = delta.summary || next.summary;
  next.version = (next.version || 1) + 1;
  next.source = {
    kind: "derived",
    confidence: delta.intentional ? 0.95 : 0.85,
    assumptions: delta.intentional ? ["intentional transition"] : ["inherited with delta"],
  };
  return next;
}

export function emptyDelta(toShotId: string, summary: string): ContinuityDelta {
  return {
    id: `delta_${toShotId}`,
    toShotId,
    added: [],
    removed: [],
    changed: [],
    moved: [],
    transformed: [],
    transferred: [],
    consumed: [],
    intentional: false,
    summary,
  };
}

export function transferPropDelta(params: {
  fromShotId: string;
  toShotId: string;
  propId: string;
  fromHolderId: string | null;
  toHolderId: string;
  reason?: string;
  sceneId?: string;
}): ContinuityDelta {
  return {
    id: `delta_transfer_${params.propId}_${params.toShotId}`,
    fromShotId: params.fromShotId,
    toShotId: params.toShotId,
    sceneId: params.sceneId,
    transferred: [
      {
        path: `props.${params.propId}.holderId`,
        from: params.fromHolderId,
        to: params.toHolderId,
        changeKind: "intentional",
        reason: params.reason || "prop handoff",
      },
    ],
    added: [],
    removed: [],
    changed: [],
    moved: [],
    transformed: [],
    consumed: [],
    intentional: true,
    summary: `Transfer ${params.propId} → ${params.toHolderId}`,
  };
}

export function changeFieldDelta(params: {
  fromShotId?: string;
  toShotId: string;
  path: string;
  from?: unknown;
  to: unknown;
  changeKind?: ContinuityFieldChange["changeKind"];
  reason?: string;
  intentional?: boolean;
  summary?: string;
  sceneId?: string;
}): ContinuityDelta {
  const changeKind = params.changeKind || (params.intentional ? "intentional" : "derived");
  return {
    id: `delta_${params.toShotId}_${params.path.replace(/\./g, "_")}`,
    fromShotId: params.fromShotId,
    toShotId: params.toShotId,
    sceneId: params.sceneId,
    added: [],
    removed: [],
    changed: [
      {
        path: params.path,
        from: params.from,
        to: params.to,
        changeKind,
        reason: params.reason,
      },
    ],
    moved: [],
    transformed: [],
    transferred: [],
    consumed: [],
    intentional: Boolean(params.intentional || changeKind === "intentional"),
    summary: params.summary || `Change ${params.path}`,
  };
}
