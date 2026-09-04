/**
 * Structured continuity specification beyond last-frame chaining.
 */

export interface ContinuityIdentityState {
  face?: string;
  body?: string;
  hair?: string;
  definingCharacteristics: string[];
  characterRefs: string[];
}

export interface ContinuityWardrobeState {
  clothing?: string;
  accessories?: string[];
  colors?: string[];
  state?: string;
}

export interface ContinuityPropState {
  propId: string;
  identity: string;
  position?: string;
  state?: string;
}

export interface ContinuityLocationState {
  locationId?: string;
  geography?: string;
  architecture?: string;
  environment?: string;
}

export interface ContinuityLightingState {
  direction?: string;
  intensity?: string;
  color?: string;
  time?: string;
}

export interface ContinuitySpatialState {
  subjectPosition?: string;
  screenDirection?: string;
  cameraRelationship?: string;
}

export interface ContinuityState {
  identity: ContinuityIdentityState;
  wardrobe: ContinuityWardrobeState;
  props: ContinuityPropState[];
  location: ContinuityLocationState;
  lighting: ContinuityLightingState;
  time: {
    dayNight?: string;
    storyTime?: string;
  };
  spatial: ContinuitySpatialState;
  emotionalState?: string;
  objectState?: string;
  cameraState?: string;
  audioState?: string;
  summary: string;
}

export interface ShotContinuityBridge {
  shotId: string;
  continuityIn: ContinuityState;
  continuityOut: ContinuityState;
}

export interface ContinuitySpec {
  globalLocks: string[];
  identityPackSummary: string;
  shotBridges: ShotContinuityBridge[];
  /** Prefer structured state; last-frame URLs remain operational aids */
  lastFrameChainEnabled: boolean;
}

export function emptyContinuityState(summary = ""): ContinuityState {
  return {
    identity: { definingCharacteristics: [], characterRefs: [] },
    wardrobe: {},
    props: [],
    location: {},
    lighting: {},
    time: {},
    spatial: {},
    summary,
  };
}

export function bridgeContinuity(
  previousOut: ContinuityState,
  shotChanges: Partial<ContinuityState> & { summary: string }
): { continuityIn: ContinuityState; continuityOut: ContinuityState } {
  const continuityIn: ContinuityState = {
    ...previousOut,
    identity: {
      ...previousOut.identity,
      ...(shotChanges.identity || {}),
      definingCharacteristics:
        shotChanges.identity?.definingCharacteristics ?? previousOut.identity.definingCharacteristics,
      characterRefs: shotChanges.identity?.characterRefs ?? previousOut.identity.characterRefs,
    },
    wardrobe: { ...previousOut.wardrobe, ...(shotChanges.wardrobe || {}) },
    props: shotChanges.props ?? previousOut.props,
    location: { ...previousOut.location, ...(shotChanges.location || {}) },
    lighting: { ...previousOut.lighting, ...(shotChanges.lighting || {}) },
    time: { ...previousOut.time, ...(shotChanges.time || {}) },
    spatial: { ...previousOut.spatial, ...(shotChanges.spatial || {}) },
    emotionalState: shotChanges.emotionalState ?? previousOut.emotionalState,
    objectState: shotChanges.objectState ?? previousOut.objectState,
    cameraState: shotChanges.cameraState ?? previousOut.cameraState,
    audioState: shotChanges.audioState ?? previousOut.audioState,
    summary: previousOut.summary,
  };

  const continuityOut: ContinuityState = {
    ...continuityIn,
    ...shotChanges,
    identity: continuityIn.identity,
    wardrobe: continuityIn.wardrobe,
    props: continuityIn.props,
    location: continuityIn.location,
    lighting: continuityIn.lighting,
    time: continuityIn.time,
    spatial: continuityIn.spatial,
    summary: shotChanges.summary,
  };

  return { continuityIn, continuityOut };
}
