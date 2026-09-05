/**
 * Continuity risk scoring for generation / QC consumers.
 */

import type {
  ContinuityConflict,
  ContinuityDelta,
  ContinuityRiskAssessment,
  ContinuityState,
} from "../specification/continuitySpec";

export function assessContinuityRisk(params: {
  shotId: string;
  continuityIn: ContinuityState;
  continuityOut: ContinuityState;
  delta?: ContinuityDelta;
  conflicts?: ContinuityConflict[];
}): ContinuityRiskAssessment {
  const reasons: string[] = [];
  let score = 0;

  const persistentEntities =
    (params.continuityOut.characters?.length || 0) +
    params.continuityOut.props.length +
    (params.continuityOut.products?.length || 0);
  if (persistentEntities >= 4) {
    score += 15;
    reasons.push("many persistent entities");
  }

  const delta = params.delta;
  if (delta) {
    const changeCount =
      delta.added.length +
      delta.removed.length +
      delta.changed.length +
      delta.moved.length +
      delta.transformed.length +
      delta.transferred.length +
      delta.consumed.length;
    if (changeCount >= 3) {
      score += 20;
      reasons.push("multiple state changes");
    }
    if (delta.transferred.length) {
      score += 25;
      reasons.push("prop handoff");
    }
  }

  const movedCharacters = (params.continuityOut.characters || []).filter((c) => {
    const prev = (params.continuityIn.characters || []).find((p) => p.characterId === c.characterId);
    return prev && prev.position && c.position && prev.position !== c.position;
  });
  if (movedCharacters.length) {
    score += 15;
    reasons.push("character movement");
  }

  if (
    params.continuityIn.axis &&
    params.continuityOut.axis &&
    params.continuityIn.axis.cameraSide !== params.continuityOut.axis.cameraSide
  ) {
    score += 20;
    reasons.push("camera axis transition");
  }

  if ((params.continuityOut.interactions || []).length >= 2) {
    score += 15;
    reasons.push("multi-entity interaction");
  }

  const wardrobeChanged = (params.continuityOut.characters || []).some((c) => {
    const prev = (params.continuityIn.characters || []).find((p) => p.characterId === c.characterId);
    return prev?.wardrobe?.clothing && c.wardrobe?.clothing && prev.wardrobe.clothing !== c.wardrobe.clothing;
  });
  if (wardrobeChanged) {
    score += 20;
    reasons.push("wardrobe change");
  }

  if (params.continuityIn.sceneId && params.continuityOut.sceneId && params.continuityIn.sceneId !== params.continuityOut.sceneId) {
    score += 15;
    reasons.push("scene transition");
  }

  if (params.continuityOut.time.temporalMode && params.continuityOut.time.temporalMode !== "continuous") {
    score += 20;
    reasons.push("temporal discontinuity");
  }

  const hardConflicts = (params.conflicts || []).filter((c) => c.classification === "hard");
  if (hardConflicts.length) {
    score += 30;
    reasons.push("hard continuity conflicts");
  }

  const level = score >= 60 ? "high" : score >= 30 ? "medium" : "low";
  return {
    shotId: params.shotId,
    level,
    score,
    reasons: reasons.length ? reasons : ["stable continuity"],
  };
}
