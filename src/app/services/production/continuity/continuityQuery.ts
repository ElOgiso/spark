/**
 * Continuity graph queries over propagated ShotContinuityBridge[] state.
 */

import type {
  ContinuityCharacterEntity,
  ContinuityPropState,
  ContinuityState,
  ShotContinuityBridge,
} from "../specification/continuitySpec";

export function getBridge(bridges: ShotContinuityBridge[], shotId: string): ShotContinuityBridge | undefined {
  return bridges.find((b) => b.shotId === shotId);
}

export function getStateEnteringShot(
  bridges: ShotContinuityBridge[],
  shotId: string
): ContinuityState | undefined {
  return getBridge(bridges, shotId)?.continuityIn;
}

export function getStateExitingShot(
  bridges: ShotContinuityBridge[],
  shotId: string
): ContinuityState | undefined {
  return getBridge(bridges, shotId)?.continuityOut;
}

export function whereWasCharacterLastSeen(
  bridges: ShotContinuityBridge[],
  characterId: string
): { shotId: string; position?: string; state: ContinuityCharacterEntity } | undefined {
  for (let i = bridges.length - 1; i >= 0; i--) {
    const character = (bridges[i].continuityOut.characters || []).find(
      (c) => c.characterId === characterId
    );
    if (character) {
      return { shotId: bridges[i].shotId, position: character.position, state: character };
    }
  }
  return undefined;
}

export function whoHoldsProp(
  state: ContinuityState,
  propId: string
): { holderId: string | null; prop: ContinuityPropState } | undefined {
  const prop = state.props.find((p) => p.propId === propId);
  if (!prop) return undefined;
  return { holderId: prop.holderId ?? null, prop };
}

export function activeWardrobeVersion(
  state: ContinuityState,
  characterId: string
): { clothing?: string; version: number } | undefined {
  const character = (state.characters || []).find((c) => c.characterId === characterId);
  if (!character) return undefined;
  return {
    clothing: character.wardrobe?.clothing || state.wardrobe.clothing,
    version: character.version,
  };
}

export function characterTravelDirection(
  state: ContinuityState,
  characterId?: string
): string | undefined {
  if (characterId) {
    const character = (state.characters || []).find((c) => c.characterId === characterId);
    return character?.screenDirection || state.spatial.screenDirection;
  }
  return state.spatial.screenDirection;
}

export function cameraAxisSide(state: ContinuityState): string | undefined {
  return state.axis?.cameraSide;
}

export function lightingToInherit(state: ContinuityState): ContinuityState["lighting"] {
  return { ...state.lighting };
}
