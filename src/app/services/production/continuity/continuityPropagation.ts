/**
 * Deterministic continuity propagation across a shot sequence.
 * Prefer cached state + delta over full recomputation.
 */

import type {
  ContinuityDelta,
  ContinuityLock,
  ContinuitySpec,
  ContinuityState,
  ShotContinuityBridge,
} from "../specification/continuitySpec";
import { emptyContinuityState } from "../specification/continuitySpec";
import { applyContinuityDelta, emptyDelta } from "./continuityDelta";
import { detectContinuityConflicts } from "./continuityConflicts";
import { assessContinuityRisk } from "./continuityRisk";
import { buildGenerationHandoff } from "./generationHandoff";
import { deriveConstraintsFromState } from "./continuityConstraints";
import { resetForSceneTransition } from "./continuityScope";

export interface ContinuityShotStep {
  shotId: string;
  sceneId: string;
  sequenceId?: string;
  delta?: ContinuityDelta;
  /** Declared / observed expected state overrides for conflict detection */
  declaredState?: Partial<ContinuityState>;
  /** Explicit intentional screen-direction change */
  screenDirectionChange?: { intentional: boolean; reason?: string };
  temporalMode?: ContinuityState["time"]["temporalMode"];
  /** When sceneId changes, carry sequence props across the boundary */
  carryPropsAcrossScene?: boolean;
  carryScreenDirectionAcrossScene?: boolean;
  summary?: string;
}

export interface ContinuityPropagationResult {
  bridges: ShotContinuityBridge[];
  snapshots: NonNullable<ContinuitySpec["snapshots"]>;
  finalState: ContinuityState;
  initialState: ContinuityState;
}

function mergeDeclared(
  base: ContinuityState,
  declared?: Partial<ContinuityState>
): ContinuityState {
  if (!declared) return base;
  return {
    ...base,
    ...declared,
    identity: { ...base.identity, ...(declared.identity || {}) },
    wardrobe: { ...base.wardrobe, ...(declared.wardrobe || {}) },
    props: declared.props ?? base.props,
    location: { ...base.location, ...(declared.location || {}) },
    lighting: { ...base.lighting, ...(declared.lighting || {}) },
    time: { ...base.time, ...(declared.time || {}) },
    spatial: { ...base.spatial, ...(declared.spatial || {}) },
    characters: declared.characters ?? base.characters,
    products: declared.products ?? base.products,
    axis: declared.axis ?? base.axis,
    spatialRelations: declared.spatialRelations ?? base.spatialRelations,
    environmentFlags: {
      ...(base.environmentFlags || {}),
      ...(declared.environmentFlags || {}),
    },
    interactions: declared.interactions ?? base.interactions,
    locks: declared.locks ?? base.locks,
    summary: declared.summary ?? base.summary,
  };
}

/**
 * Propagate continuity through an ordered sequence of shot steps.
 * Same inputs → same outputs (deterministic).
 */
export function propagateContinuitySequence(
  initial: ContinuityState,
  steps: ContinuityShotStep[],
  options?: { structuredLocks?: ContinuityLock[] }
): ContinuityPropagationResult {
  let previous = structuredClone(initial);
  if (options?.structuredLocks?.length) {
    previous = {
      ...previous,
      locks: [...(previous.locks || []), ...options.structuredLocks],
    };
  }

  const bridges: ShotContinuityBridge[] = [];
  const snapshots: NonNullable<ContinuitySpec["snapshots"]> = [];
  let lastSceneId = previous.sceneId;

  for (const step of steps) {
    if (lastSceneId && step.sceneId !== lastSceneId) {
      previous = resetForSceneTransition(previous, step.sceneId, {
        carryProps: step.carryPropsAcrossScene,
        carryScreenDirection: step.carryScreenDirectionAcrossScene,
        temporalDiscontinuity: step.temporalMode && step.temporalMode !== "continuous"
          ? step.temporalMode
          : undefined,
      });
      snapshots.push({
        id: `snap_scene_${step.sceneId}`,
        boundary: "scene_start",
        sceneId: step.sceneId,
        state: structuredClone(previous),
      });
    }
    lastSceneId = step.sceneId;

    const continuityIn: ContinuityState = {
      ...structuredClone(previous),
      sceneId: step.sceneId,
      sequenceId: step.sequenceId ?? previous.sequenceId,
      shotId: step.shotId,
      scope: "shot",
    };

    let delta =
      step.delta ||
      emptyDelta(step.shotId, step.summary || `Advance to ${step.shotId}`);
    delta = {
      ...delta,
      toShotId: step.shotId,
      sceneId: step.sceneId,
      fromShotId: delta.fromShotId || previous.shotId,
    };

    if (step.screenDirectionChange) {
      const dirChange = {
        path: "spatial.screenDirection",
        from: continuityIn.spatial.screenDirection,
        to: step.declaredState?.spatial?.screenDirection ?? continuityIn.spatial.screenDirection,
        changeKind: step.screenDirectionChange.intentional
          ? ("intentional" as const)
          : ("unknown" as const),
        reason: step.screenDirectionChange.reason,
      };
      delta = {
        ...delta,
        changed: [...delta.changed, dirChange],
        intentional: delta.intentional || step.screenDirectionChange.intentional,
      };
    }

    if (step.temporalMode && step.temporalMode !== "continuous") {
      delta = {
        ...delta,
        changed: [
          ...delta.changed,
          {
            path: "time.temporalMode",
            from: continuityIn.time.temporalMode,
            to: step.temporalMode,
            changeKind: "intentional",
            reason: "temporal discontinuity",
          },
        ],
        intentional: true,
      };
    }

    let continuityOut = applyContinuityDelta(continuityIn, delta);
    continuityOut = mergeDeclared(continuityOut, step.declaredState);
    continuityOut.shotId = step.shotId;
    continuityOut.sceneId = step.sceneId;
    if (step.summary) continuityOut.summary = step.summary;

    const constraints = deriveConstraintsFromState(continuityOut, step.shotId);
    const conflicts = detectContinuityConflicts({
      expected: continuityIn,
      observed: continuityOut,
      delta,
      shotId: step.shotId,
      screenDirectionChange: step.screenDirectionChange,
    });
    const risk = assessContinuityRisk({
      shotId: step.shotId,
      continuityIn,
      continuityOut,
      delta,
      conflicts,
    });
    const handoff = buildGenerationHandoff({
      shotId: step.shotId,
      sceneId: step.sceneId,
      continuityIn,
      continuityOut,
      delta,
      requiredConstraints: constraints.required,
      optionalConstraints: constraints.optional,
      risk,
    });

    bridges.push({
      shotId: step.shotId,
      continuityIn,
      continuityOut,
      delta,
      requiredConstraints: constraints.required,
      optionalConstraints: constraints.optional,
      conflicts,
      risk,
      generationHandoff: handoff,
    });

    previous = continuityOut;
  }

  return {
    bridges,
    snapshots,
    finalState: previous,
    initialState: initial.summary ? initial : emptyContinuityState(initial.summary),
  };
}
