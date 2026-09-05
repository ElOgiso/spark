/**
 * Provider-agnostic continuity → generation handoff.
 * Phase 6 GenerationIntent can consume this without depending on provider adapters.
 */

import type {
  ContinuityConstraint,
  ContinuityDelta,
  ContinuityGenerationHandoff,
  ContinuityRiskAssessment,
  ContinuityState,
} from "../specification/continuitySpec";

export function buildGenerationHandoff(params: {
  shotId: string;
  sceneId: string;
  continuityIn: ContinuityState;
  continuityOut: ContinuityState;
  delta?: ContinuityDelta;
  requiredConstraints: ContinuityConstraint[];
  optionalConstraints: ContinuityConstraint[];
  risk: ContinuityRiskAssessment;
  references?: string[];
}): ContinuityGenerationHandoff {
  const allowedChanges = (params.delta?.changed || [])
    .concat(params.delta?.transferred || [])
    .concat(params.delta?.moved || [])
    .filter((c) => c.changeKind === "intentional" || c.changeKind === "planned")
    .map((c) => c.path);

  const forbiddenChanges: string[] = [];
  for (const lock of params.continuityIn.locks || []) {
    if (!lock.locked) continue;
    forbiddenChanges.push(
      lock.field ? `${lock.subjectId}.${lock.field}` : `${lock.subjectId}.*`
    );
  }
  // Hard required constraints that are not in allowedChanges are forbidden to violate
  for (const constraint of params.requiredConstraints) {
    if (constraint.severity !== "hard" || !constraint.field) continue;
    const key = constraint.subjectId
      ? `${constraint.subjectId}.${constraint.field}`
      : constraint.field;
    if (!allowedChanges.some((p) => p === key || p.endsWith(`.${constraint.field}`))) {
      forbiddenChanges.push(key);
    }
  }

  const references = new Set<string>(params.references || []);
  for (const ref of params.continuityOut.identity.characterRefs || []) references.add(ref);
  for (const character of params.continuityOut.characters || []) references.add(character.characterId);
  for (const prop of params.continuityOut.props) references.add(prop.propId);
  if (params.continuityOut.location.locationId) references.add(params.continuityOut.location.locationId);

  return {
    shotId: params.shotId,
    sceneId: params.sceneId,
    inheritedState: structuredClone(params.continuityIn),
    requiredState: structuredClone(params.continuityOut),
    startState: structuredClone(params.continuityIn),
    targetEndState: structuredClone(params.continuityOut),
    requiredConstraints: params.requiredConstraints,
    optionalConstraints: params.optionalConstraints,
    allowedChanges: Array.from(new Set(allowedChanges)),
    forbiddenChanges: Array.from(new Set(forbiddenChanges)),
    transitionFromPreviousShot: params.delta,
    risk: params.risk,
    references: Array.from(references),
  };
}

/** Flatten handoff into Phase-6-friendly string requirements. */
export function handoffToContinuityRequirements(handoff: ContinuityGenerationHandoff): {
  requiredContinuity: string[];
  optionalContinuity: string[];
} {
  return {
    requiredContinuity: handoff.requiredConstraints.map((c) => c.description),
    optionalContinuity: handoff.optionalConstraints.map((c) => c.description),
  };
}
