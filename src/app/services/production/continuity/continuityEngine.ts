/**
 * State-based continuity engine — builds ContinuityState bridges across shots.
 * Complements last-frame chaining (visualContinuityGate) with structured state.
 */

import type { ProductionSpec } from "../specification/productionSpec";
import {
  bridgeContinuity,
  emptyContinuityState,
  type ContinuitySpec,
  type ContinuityState,
  type ShotContinuityBridge,
} from "../specification/continuitySpec";

export function buildInitialContinuityState(spec: ProductionSpec): ContinuityState {
  const character = spec.characters[0];
  return {
    ...emptyContinuityState("Production open"),
    identity: {
      face: character?.visualAttributes.face,
      body: character?.visualAttributes.body,
      hair: character?.visualAttributes.hair,
      definingCharacteristics: character?.visualAttributes.definingCharacteristics || [],
      characterRefs: character ? [character.identity.ref] : [],
    },
    wardrobe: {
      clothing: character?.wardrobeState?.description,
      colors: character?.wardrobeState?.colors,
      state: "initial",
    },
    location: {
      locationId: spec.world.locations[0]?.id,
      environment: spec.world.locations[0]?.description || spec.world.settingSummary,
    },
    lighting: {
      color: spec.visualStyle.lightingLanguage,
      time: "day",
    },
    time: { dayNight: "day", storyTime: "t0" },
    spatial: { subjectPosition: "center-right", screenDirection: "audience-facing" },
    emotionalState: spec.creative.tone,
    cameraState: "eye-level",
    audioState: spec.audio.hasNarration ? "narration" : spec.audio.hasDialogue ? "dialogue" : "music",
    summary: "Initial continuity lock",
  };
}

export function applyContinuityEngine(spec: ProductionSpec): ProductionSpec {
  let previous = buildInitialContinuityState(spec);
  const bridges: ShotContinuityBridge[] = [];

  const scenes = spec.scenes.map((scene) => {
    const shots = scene.shots.map((shot) => {
      const { continuityIn, continuityOut } = bridgeContinuity(previous, {
        lighting: {
          ...previous.lighting,
          ...(shot.lighting.timeOfDay ? { time: shot.lighting.timeOfDay } : {}),
          color: shot.lighting.color || previous.lighting.color,
          direction: shot.lighting.direction || previous.lighting.direction,
          intensity: shot.lighting.intensity || previous.lighting.intensity,
        },
        spatial: {
          subjectPosition: shot.blocking || previous.spatial.subjectPosition,
          cameraRelationship: shot.camera.cameraPosition,
          screenDirection: previous.spatial.screenDirection,
        },
        cameraState: `${shot.camera.shotType}:${shot.camera.cameraMovement}`,
        emotionalState: shot.atmosphere || previous.emotionalState,
        summary: shot.motion.endState,
        identity: previous.identity,
        wardrobe: previous.wardrobe,
        props: previous.props,
        location: {
          ...previous.location,
          environment: shot.environment || previous.location.environment,
        },
        time: previous.time,
      });

      bridges.push({ shotId: shot.id, continuityIn, continuityOut });
      previous = continuityOut;

      return {
        ...shot,
        continuityRequirements: Array.from(
          new Set([
            ...shot.continuityRequirements,
            continuityIn.summary,
            `OUT: ${continuityOut.summary}`,
          ])
        ),
      };
    });
    return { ...scene, shots };
  });

  const continuity: ContinuitySpec = {
    ...spec.continuity,
    shotBridges: bridges,
    identityPackSummary: previous.identity.definingCharacteristics.join(", ") || spec.continuity.identityPackSummary,
  };

  return { ...spec, scenes, continuity };
}
