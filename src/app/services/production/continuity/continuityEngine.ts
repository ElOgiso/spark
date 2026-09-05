/**
 * State-based continuity engine — builds ContinuityState bridges across shots.
 * Complements last-frame chaining (visualContinuityGate) with structured state.
 * Phase 7 enriches bridges with constraints, risk, and generation handoff.
 */

import type { ProductionSpec } from "../specification/productionSpec";
import {
  bridgeContinuity,
  emptyContinuityState,
  type ContinuitySpec,
  type ContinuityState,
  type ShotContinuityBridge,
} from "../specification/continuitySpec";
import { deriveConstraintsFromState } from "./continuityConstraints";
import { assessContinuityRisk } from "./continuityRisk";
import { buildGenerationHandoff } from "./generationHandoff";
import { lockSubject } from "./continuityLocks";

export function buildInitialContinuityState(spec: ProductionSpec): ContinuityState {
  const character = spec.characters[0];
  const locks = character
    ? [
        lockSubject({
          targetKind: "character",
          subjectId: character.identity.ref,
          field: "identity",
          reason: "production identity lock",
          scope: "production",
        }),
        lockSubject({
          targetKind: "wardrobe",
          subjectId: character.identity.ref,
          field: "clothing",
          reason: "production wardrobe lock",
          scope: "scene",
        }),
      ]
    : [];

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
    time: { dayNight: "day", storyTime: "t0", temporalMode: "continuous" },
    spatial: { subjectPosition: "center-right", screenDirection: "audience-facing" },
    emotionalState: spec.creative.tone,
    cameraState: "eye-level",
    audioState: spec.audio.hasNarration ? "narration" : spec.audio.hasDialogue ? "dialogue" : "music",
    summary: "Initial continuity lock",
    productionId: spec.id,
    scope: "production",
    characters: character
      ? [
          {
            characterId: character.identity.ref,
            version: 1,
            identity: character.name,
            appearance: character.visualAttributes.definingCharacteristics.join(", "),
            hair: character.visualAttributes.hair,
            wardrobe: {
              clothing: character.wardrobeState?.description,
              colors: character.wardrobeState?.colors,
              state: "initial",
            },
            heldPropIds: [],
            lockedFields: ["identity", "clothing"],
            scope: "production",
            screenDirection: "left_to_right",
          },
        ]
      : [],
    products: [],
    spatialRelations: [],
    environmentFlags: {},
    interactions: [],
    visualTreatmentId: spec.visualStyle.look,
    locks,
    version: 1,
    source: { kind: "ProductionSpec", confidence: 0.95 },
    axis: {
      axisId: "axis_main",
      orientation: "scene-axis",
      cameraSide: "A",
      crossingIntent: "none",
    },
  };
}

export function applyContinuityEngine(spec: ProductionSpec): ProductionSpec {
  let previous = buildInitialContinuityState(spec);
  const bridges: ShotContinuityBridge[] = [];
  const snapshots: NonNullable<ContinuitySpec["snapshots"]> = [];
  let lastSceneId: string | undefined;

  const scenes = spec.scenes.map((scene) => {
    if (lastSceneId && lastSceneId !== scene.id) {
      snapshots.push({
        id: `snap_scene_${scene.id}`,
        boundary: "scene_start",
        sceneId: scene.id,
        state: structuredClone(previous),
      });
    }
    lastSceneId = scene.id;

    const shots = scene.shots.map((shot) => {
      const { continuityIn, continuityOut } = bridgeContinuity(
        {
          ...previous,
          sceneId: scene.id,
          shotId: shot.id,
          scope: "shot",
        },
        {
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
          characters: previous.characters,
          products: previous.products,
          axis: previous.axis,
          locks: previous.locks,
          location: {
            ...previous.location,
            environment: shot.environment || previous.location.environment,
          },
          time: previous.time,
          sceneId: scene.id,
          shotId: shot.id,
          actionPhase: shot.motion.endState,
        }
      );

      const constraints = deriveConstraintsFromState(continuityOut, shot.id);
      const risk = assessContinuityRisk({
        shotId: shot.id,
        continuityIn,
        continuityOut,
      });
      const generationHandoff = buildGenerationHandoff({
        shotId: shot.id,
        sceneId: scene.id,
        continuityIn,
        continuityOut,
        requiredConstraints: constraints.required,
        optionalConstraints: constraints.optional,
        risk,
      });

      bridges.push({
        shotId: shot.id,
        continuityIn,
        continuityOut,
        requiredConstraints: constraints.required,
        optionalConstraints: constraints.optional,
        risk,
        generationHandoff,
      });
      previous = continuityOut;

      return {
        ...shot,
        continuityRequirements: Array.from(
          new Set([
            ...shot.continuityRequirements,
            continuityIn.summary,
            `OUT: ${continuityOut.summary}`,
            ...constraints.required.map((c) => c.description),
          ])
        ),
      };
    });
    return { ...scene, shots };
  });

  const continuity: ContinuitySpec = {
    ...spec.continuity,
    shotBridges: bridges,
    identityPackSummary:
      previous.identity.definingCharacteristics.join(", ") || spec.continuity.identityPackSummary,
    structuredLocks: previous.locks,
    snapshots,
  };

  return { ...spec, scenes, continuity };
}
