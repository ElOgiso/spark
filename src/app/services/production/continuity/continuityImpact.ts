/**
 * Continuity change impact analysis — identify downstream shots affected by a state change.
 * Does not trigger regeneration (Phase 8 / execution owns that).
 */

import type {
  ContinuityImpactReport,
  ContinuityState,
  ShotContinuityBridge,
} from "../specification/continuitySpec";

function readPath(state: ContinuityState, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = state;
  for (const part of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function characterField(state: ContinuityState, characterId: string, field: string): unknown {
  const character = (state.characters || []).find((c) => c.characterId === characterId);
  if (!character) return undefined;
  if (field.startsWith("wardrobe.")) {
    return (character.wardrobe as Record<string, unknown> | undefined)?.[field.slice("wardrobe.".length)];
  }
  return (character as unknown as Record<string, unknown>)[field];
}

function propField(state: ContinuityState, propId: string, field: string): unknown {
  const prop = state.props.find((p) => p.propId === propId);
  if (!prop) return undefined;
  return (prop as unknown as Record<string, unknown>)[field];
}

/**
 * Given bridges after a change at `changedShotId`, find later shots that still
 * inherit the previous value of `subjectId.field`.
 */
export function analyzeContinuityImpact(params: {
  bridges: ShotContinuityBridge[];
  changedShotId: string;
  subjectId: string;
  field: string;
  fromVersion: number;
  toVersion: number;
  /** Optional explicit path, e.g. characters.CHAR_001.wardrobe.clothing */
  path?: string;
}): ContinuityImpactReport {
  const startIdx = params.bridges.findIndex((b) => b.shotId === params.changedShotId);
  const affectedShotIds: string[] = [];

  if (startIdx < 0) {
    return {
      subjectId: params.subjectId,
      field: params.field,
      fromVersion: params.fromVersion,
      toVersion: params.toVersion,
      affectedShotIds: [],
      summary: `Change shot ${params.changedShotId} not found in bridges`,
    };
  }

  const path =
    params.path ||
    (params.subjectId.startsWith("PROP_") || params.field === "holderId"
      ? `props.${params.subjectId}.${params.field}`
      : `characters.${params.subjectId}.${params.field}`);

  // Baseline: value entering the changed shot (pre-change)
  const baseline = params.bridges[startIdx].continuityIn;
  const previousValue =
    path.startsWith("characters.")
      ? characterField(baseline, params.subjectId, params.field)
      : path.startsWith("props.")
        ? propField(baseline, params.subjectId, params.field)
        : readPath(baseline, path);

  for (let i = startIdx + 1; i < params.bridges.length; i++) {
    const bridge = params.bridges[i];
    // A later shot is impacted if its incoming state still reflects the pre-change value
    // OR if it has no intentional override for this field in its delta.
    const incoming =
      path.startsWith("characters.")
        ? characterField(bridge.continuityIn, params.subjectId, params.field)
        : path.startsWith("props.")
          ? propField(bridge.continuityIn, params.subjectId, params.field)
          : readPath(bridge.continuityIn, path);

    const hasIntentionalOverride = (bridge.delta?.changed || [])
      .concat(bridge.delta?.transferred || [])
      .some(
        (c) =>
          (c.path === path || c.path.endsWith(`.${params.field}`)) &&
          (c.changeKind === "intentional" || c.changeKind === "planned")
      );

    if (!hasIntentionalOverride && incoming === previousValue) {
      affectedShotIds.push(bridge.shotId);
    } else if (!hasIntentionalOverride && incoming !== undefined) {
      // Still downstream dependent if it never adopted the new version explicitly
      affectedShotIds.push(bridge.shotId);
    }
  }

  return {
    subjectId: params.subjectId,
    field: params.field,
    fromVersion: params.fromVersion,
    toVersion: params.toVersion,
    affectedShotIds,
    summary: `${params.subjectId}.${params.field} v${params.fromVersion}→v${params.toVersion} impacts ${affectedShotIds.length} downstream shot(s)`,
  };
}
