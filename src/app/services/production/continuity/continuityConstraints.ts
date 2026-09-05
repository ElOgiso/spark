/**
 * Derive hard/soft continuity constraints from ContinuityState for generation handoff.
 */

import type {
  ContinuityConstraint,
  ContinuityState,
} from "../specification/continuitySpec";

export function deriveConstraintsFromState(
  state: ContinuityState,
  shotId: string
): { required: ContinuityConstraint[]; optional: ContinuityConstraint[] } {
  const required: ContinuityConstraint[] = [];
  const optional: ContinuityConstraint[] = [];
  let n = 0;
  const id = (prefix: string) => `${prefix}_${shotId}_${++n}`;

  for (const character of state.characters || []) {
    required.push({
      id: id("req_identity"),
      category: "IDENTITY",
      severity: "hard",
      description: `${character.identity} identity must persist`,
      subjectId: character.characterId,
      field: "identity",
      expected: character.identity,
      source: "ContinuityState",
      confidence: state.source?.confidence ?? 0.9,
      shotId,
    });
    if (character.wardrobe?.clothing) {
      const wardrobeLocked = (state.locks || []).some(
        (l) =>
          l.locked &&
          (l.subjectId === character.characterId || l.subjectId === "wardrobe") &&
          (!l.field || l.field === "clothing" || l.field === "wardrobe" || l.field === "*")
      );
      required.push({
        id: id("req_wardrobe"),
        category: "WARDROBE",
        severity: wardrobeLocked ? "hard" : "hard",
        description: `${character.identity} wardrobe: ${character.wardrobe.clothing}`,
        subjectId: character.characterId,
        field: "wardrobe.clothing",
        expected: character.wardrobe.clothing,
        source: "ContinuityState",
        confidence: 0.92,
        shotId,
      });
    }
    if (character.position) {
      required.push({
        id: id("req_pos"),
        category: "POSITION",
        severity: "hard",
        description: `${character.identity} position: ${character.position}`,
        subjectId: character.characterId,
        field: "position",
        expected: character.position,
        source: "ContinuityState",
        confidence: 0.85,
        shotId,
      });
    }
    if (character.gazeTarget || character.gazeDirection) {
      optional.push({
        id: id("opt_gaze"),
        category: "EYELINE",
        severity: "soft",
        description: `${character.identity} gaze ${character.gazeDirection || ""} → ${character.gazeTarget || ""}`.trim(),
        subjectId: character.characterId,
        field: "gaze",
        expected: { target: character.gazeTarget, direction: character.gazeDirection },
        source: "ContinuityState",
        confidence: 0.8,
        shotId,
      });
    }
    for (const propId of character.heldPropIds || []) {
      required.push({
        id: id("req_hold"),
        category: "INTERACTION",
        severity: "hard",
        description: `${character.identity} holds ${propId}`,
        subjectId: character.characterId,
        field: "heldPropIds",
        expected: propId,
        source: "ContinuityState",
        confidence: 0.95,
        shotId,
      });
    }
  }

  for (const prop of state.props) {
    required.push({
      id: id("req_prop"),
      category: "PROP",
      severity: "hard",
      description: `${prop.identity} present (${prop.propId}) holder=${prop.holderId ?? "environment"}`,
      subjectId: prop.propId,
      field: "holderId",
      expected: prop.holderId ?? null,
      source: "ContinuityState",
      confidence: 0.93,
      shotId,
    });
  }

  if (state.spatial.screenDirection) {
    required.push({
      id: id("req_screen"),
      category: "SCREEN_DIRECTION",
      severity: "hard",
      description: `Screen direction: ${state.spatial.screenDirection}`,
      field: "spatial.screenDirection",
      expected: state.spatial.screenDirection,
      source: "ContinuityState",
      confidence: 0.9,
      shotId,
    });
  }

  if (state.axis) {
    required.push({
      id: id("req_axis"),
      category: "AXIS",
      severity: "hard",
      description: `Camera side of axis ${state.axis.axisId}: ${state.axis.cameraSide}`,
      subjectId: state.axis.axisId,
      field: "cameraSide",
      expected: state.axis.cameraSide,
      source: "ContinuityState",
      confidence: 0.88,
      shotId,
    });
  }

  if (state.location.locationId) {
    required.push({
      id: id("req_loc"),
      category: "ENVIRONMENT",
      severity: "hard",
      description: `Location ${state.location.locationId} persists`,
      subjectId: state.location.locationId,
      field: "locationId",
      expected: state.location.locationId,
      source: "ContinuityState",
      confidence: 0.95,
      shotId,
    });
  }

  if (state.lighting.color || state.lighting.keySource) {
    optional.push({
      id: id("opt_light"),
      category: "LIGHTING",
      severity: "soft",
      description: `Lighting treatment: ${state.lighting.keySource || ""} ${state.lighting.color || ""}`.trim(),
      field: "lighting",
      expected: state.lighting,
      source: "ContinuityState",
      confidence: 0.7,
      shotId,
    });
  }

  if (state.visualTreatmentId) {
    optional.push({
      id: id("opt_treatment"),
      category: "VISUAL_TREATMENT",
      severity: "soft",
      description: `Visual treatment ${state.visualTreatmentId}`,
      field: "visualTreatmentId",
      expected: state.visualTreatmentId,
      source: "ContinuityState",
      confidence: 0.75,
      shotId,
    });
  }

  return { required, optional };
}
