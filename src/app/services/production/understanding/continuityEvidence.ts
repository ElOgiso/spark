/**
 * Continuity Evidence — Uses temporal start/end boundary states to evaluate visual continuity.
 *
 * Does NOT create another continuity engine.
 * Provides factual observation evidence to existing continuity evaluation and QC.
 */

import type { StructuredVideoUnderstanding, ObservedBoundaryState } from "./types";

export interface ContinuityComparisonResult {
  consistent: boolean;
  score: number; // 0 to 1
  mismatches: string[];
  evidence: {
    shotA_endState?: ObservedBoundaryState;
    shotB_startState?: ObservedBoundaryState;
    subjectPositionTransition?: { from?: string; to?: string };
    framingTransition?: { from?: string; to?: string };
  };
}

/**
 * Compares the ending visual state of Shot A with the beginning visual state of Shot B.
 */
export function evaluateContinuityBetweenUnderstandings(
  shotA: StructuredVideoUnderstanding,
  shotB: StructuredVideoUnderstanding
): ContinuityComparisonResult {
  const lastSegA = shotA.segments[shotA.segments.length - 1];
  const firstSegB = shotB.segments[0];

  const endA = lastSegA?.endState;
  const startB = firstSegB?.startState;

  const mismatches: string[] = [];

  if (!endA || !startB) {
    return {
      consistent: true,
      score: 0.5,
      mismatches: ["insufficient_boundary_state_evidence"],
      evidence: {
        shotA_endState: endA,
        shotB_startState: startB,
      },
    };
  }

  // Check subject position continuity (e.g. subject was screen left, now screen right without camera cut)
  if (
    endA.subjectPosition &&
    startB.subjectPosition &&
    endA.subjectPosition !== startB.subjectPosition
  ) {
    mismatches.push(
      `Subject position jumped from "${endA.subjectPosition}" to "${startB.subjectPosition}" across boundary`
    );
  }

  // Check lighting continuity
  if (
    endA.lightingMood &&
    startB.lightingMood &&
    endA.lightingMood !== startB.lightingMood
  ) {
    mismatches.push(
      `Lighting shifted abruptly from "${endA.lightingMood}" to "${startB.lightingMood}"`
    );
  }

  const consistent = mismatches.length === 0;
  const score = consistent ? 1.0 : Math.max(0.2, 1.0 - mismatches.length * 0.4);

  return {
    consistent,
    score,
    mismatches,
    evidence: {
      shotA_endState: endA,
      shotB_startState: startB,
      subjectPositionTransition: {
        from: endA.subjectPosition,
        to: startB.subjectPosition,
      },
      framingTransition: {
        from: endA.cameraFraming,
        to: startB.cameraFraming,
      },
    },
  };
}
