/**
 * Continuity conflict detection — expected vs declared/observed state.
 * Does not inspect pixels (Phase 9). Distinguishes intentional vs unplanned change.
 */

import type {
  ContinuityConflict,
  ContinuityDelta,
  ContinuityState,
} from "../specification/continuitySpec";

export function detectContinuityConflicts(params: {
  expected: ContinuityState;
  observed: ContinuityState;
  delta?: ContinuityDelta;
  shotId: string;
  screenDirectionChange?: { intentional: boolean; reason?: string };
}): ContinuityConflict[] {
  const { expected, observed, delta, shotId, screenDirectionChange } = params;
  const conflicts: ContinuityConflict[] = [];
  let n = 0;
  const intentionalPaths = new Set(
    (delta?.intentional
      ? [...(delta.changed || []), ...(delta.transferred || []), ...(delta.moved || [])]
      : [...(delta?.changed || []), ...(delta?.transferred || [])].filter(
          (c) => c.changeKind === "intentional" || c.changeKind === "planned"
        )
    ).map((c) => c.path)
  );

  const push = (
    partial: Omit<ContinuityConflict, "id"> & { id?: string }
  ): void => {
    conflicts.push({
      id: partial.id || `conflict_${shotId}_${++n}`,
      ...partial,
    });
  };

  // Wardrobe vs locks
  for (const character of expected.characters || []) {
    const next = (observed.characters || []).find((c) => c.characterId === character.characterId);
    if (!next) {
      push({
        classification: "hard",
        category: "IDENTITY",
        description: `Character ${character.characterId} missing from expected continuity`,
        shotId,
        subjectId: character.characterId,
        expected: character.identity,
        observed: undefined,
        sourceA: "expected ContinuityState",
        sourceB: "observed ContinuityState",
      });
      continue;
    }

    const wardrobeLocked = (expected.locks || []).some(
      (l) =>
        l.locked &&
        (l.subjectId === character.characterId || l.subjectId === "wardrobe") &&
        (!l.field || l.field === "clothing" || l.field === "wardrobe" || l.field === "*")
    );
    const prevClothing = character.wardrobe?.clothing || expected.wardrobe.clothing;
    const nextClothing = next.wardrobe?.clothing || observed.wardrobe.clothing;
    if (prevClothing && nextClothing && prevClothing !== nextClothing) {
      const path = `characters.${character.characterId}.wardrobe.clothing`;
      if (intentionalPaths.has(path) || intentionalPaths.has("wardrobe.clothing")) {
        push({
          classification: "intentional",
          category: "WARDROBE",
          description: `Intentional wardrobe change for ${character.characterId}`,
          shotId,
          subjectId: character.characterId,
          expected: prevClothing,
          observed: nextClothing,
          sourceA: "previous state",
          sourceB: "declared change",
          reason: "explicit wardrobe transition",
        });
      } else {
        push({
          classification: wardrobeLocked ? "hard" : "soft",
          category: "WARDROBE",
          description: wardrobeLocked
            ? `Locked wardrobe violated for ${character.characterId}`
            : `Unexpected wardrobe change for ${character.characterId}`,
          shotId,
          subjectId: character.characterId,
          expected: prevClothing,
          observed: nextClothing,
          sourceA: "locked ContinuityState",
          sourceB: "shot declared state",
        });
      }
    }
  }

  // Prop presence / holder
  for (const prop of expected.props) {
    const next = observed.props.find((p) => p.propId === prop.propId);
    if (!next) {
      const removedIntentional = (delta?.removed || []).some(
        (c) => c.path === `props.${prop.propId}` && c.changeKind === "intentional"
      );
      push({
        classification: removedIntentional ? "intentional" : "hard",
        category: "PROP",
        description: removedIntentional
          ? `Prop ${prop.propId} intentionally removed`
          : `Prop ${prop.propId} unexpectedly absent`,
        shotId,
        subjectId: prop.propId,
        expected: prop,
        observed: undefined,
        sourceA: "expected ContinuityState",
        sourceB: "observed ContinuityState",
      });
      continue;
    }
    if ((prop.holderId ?? null) !== (next.holderId ?? null)) {
      const path = `props.${prop.propId}.holderId`;
      const intentional = intentionalPaths.has(path) || Boolean(delta?.intentional && delta.transferred.some((t) => t.path === path));
      push({
        classification: intentional ? "intentional" : "hard",
        category: "INTERACTION",
        description: intentional
          ? `Prop ${prop.propId} handoff ${prop.holderId} → ${next.holderId}`
          : `Unexpected holder change for ${prop.propId}`,
        shotId,
        subjectId: prop.propId,
        expected: prop.holderId ?? null,
        observed: next.holderId ?? null,
        sourceA: "expected ContinuityState",
        sourceB: "observed ContinuityState",
      });
    }
  }

  // Screen direction
  const prevDir = expected.spatial.screenDirection;
  const nextDir = observed.spatial.screenDirection;
  if (prevDir && nextDir && prevDir !== nextDir) {
    const intentional =
      screenDirectionChange?.intentional ||
      intentionalPaths.has("spatial.screenDirection");
    push({
      classification: intentional ? "intentional" : "hard",
      category: "SCREEN_DIRECTION",
      description: intentional
        ? `Intentional screen-direction reverse: ${prevDir} → ${nextDir}`
        : `Unplanned screen-direction change: ${prevDir} → ${nextDir}`,
      shotId,
      expected: prevDir,
      observed: nextDir,
      sourceA: "expected ContinuityState",
      sourceB: "observed ContinuityState",
      reason: screenDirectionChange?.reason,
    });
  }

  // Axis crossing without intent
  if (
    expected.axis &&
    observed.axis &&
    expected.axis.cameraSide !== observed.axis.cameraSide
  ) {
    const intentional =
      observed.axis.crossingIntent === "intentional" ||
      intentionalPaths.has("axis.cameraSide");
    push({
      classification: intentional ? "intentional" : "soft",
      category: "AXIS",
      description: intentional
        ? `Intentional axis break: ${expected.axis.cameraSide} → ${observed.axis.cameraSide}`
        : `Unplanned axis side change`,
      shotId,
      subjectId: expected.axis.axisId,
      expected: expected.axis.cameraSide,
      observed: observed.axis.cameraSide,
      sourceA: "expected ContinuityState",
      sourceB: "observed ContinuityState",
      reason: observed.axis.crossingReason,
    });
  }

  return conflicts;
}
