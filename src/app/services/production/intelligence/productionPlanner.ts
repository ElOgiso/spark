/**
 * Production planner — Creative Direction + Narrative + Grammar → ProductionSpec blueprint.
 * Establishes scenes/assets/audio/continuity requirements.
 * Does NOT choose final providers (later phase).
 * Shot stubs are blueprint-only; full camera/motion planning is the next phase.
 */

import type { CreativeSpec, WorldSpec, VisualStyleSpec, AspectRatioId } from "../specification/productionSpec";
import type { SceneSpec } from "../specification/sceneSpec";
import type { ShotSpec } from "../specification/shotSpec";
import type { CharacterMaster } from "../specification/assetSpec";
import { createCharacterMaster, createLocationMaster } from "../specification/assetSpec";
import type { ComposedGrammar } from "../grammar";
import type { NarrativeBeatPlan } from "./narrativePlanner";
import { ANTI_SLOP_RULES } from "../productionPromptPacks";
import { strategyFromAlias } from "../specification/generationStrategy";

export function planProductionScenes(params: {
  productionId: string;
  creative: CreativeSpec;
  grammar: ComposedGrammar;
  beats: NarrativeBeatPlan[];
  aspectRatio: AspectRatioId | string;
  character?: { name: string; description?: string; sheetUrl?: string | null };
  /** Blueprint mode: stub shots only (Phase 2). Full shot planning comes later. */
  blueprintShots?: boolean;
}): {
  scenes: SceneSpec[];
  characters: CharacterMaster[];
  world: WorldSpec;
  visualStyle: VisualStyleSpec;
} {
  const blueprintShots = params.blueprintShots !== false;
  const characters: CharacterMaster[] = [];
  if (params.creative.requiresCharacters || params.creative.requiresHost) {
    characters.push(
      createCharacterMaster({
        baseId: "character_001",
        name: params.character?.name || "Primary Subject",
        description: params.character?.description || "Consistent primary on-screen subject",
        role: params.creative.requiresHost ? "host" : "primary",
        referenceUrls: params.character?.sheetUrl ? [params.character.sheetUrl] : [],
      })
    );
  }

  const characterIds = characters.map((c) => c.identity.ref);

  const scenes: SceneSpec[] = params.beats.map((beat) => {
    const sceneId = `${params.productionId}_scene_${beat.index}`;
    const environment = environmentFor(beat.narrativeFunction, params.creative, params.grammar);
    const entrance =
      beat.index === 0
        ? "Open production with locked identity and established geography"
        : "Continue from previous scene exit with locked identity";
    const exit = `Complete ${beat.narrativeFunction} with clear end state`;

    const stubShot: ShotSpec = {
      id: `${sceneId}_shot_0`,
      sceneId,
      index: 0,
      purpose: `Blueprint coverage for ${beat.narrativeFunction}`,
      productionReason: `Scene requires visual coverage to deliver: ${beat.purpose}`,
      timingStartSec: 0,
      startTime: 0,
      durationSec: beat.durationSec,
      camera: {
        shotType: params.grammar.coverage.preferredShotTypes[0] || "medium",
        framing: "to be planned in shot/camera phase",
        composition: "subject priority",
        cameraPosition: "eye-level",
        cameraMovement: params.grammar.coverage.preferredMovements[0] || "static",
      },
      subject: characterIds[0] || "primary_subject",
      subjectAction: beat.purpose,
      environment,
      lighting: { atmosphere: params.creative.tone },
      atmosphere: params.creative.tone,
      motion: {
        subjectMovement: beat.purpose,
        cameraMovementDetail: "Motivated move TBD in cinematography phase",
        beginState: entrance,
        endState: exit,
      },
      references: {
        characterRefs: characterIds,
        locationRefs: [],
        styleRefs: [],
      },
      continuityRequirements: ["identity", "wardrobe", "set"],
      characterIds,
      propIds: [],
      assetIds: characterIds,
      generationStrategy: blueprintShots ? "image_to_video" : "image_to_video",
      generationStrategySpec: strategyFromAlias("image_to_video"),
      aspectRatio: String(params.aspectRatio),
      generationStatus: "planned",
      qcStatus: "pending",
    };

    const scene: SceneSpec = {
      id: sceneId,
      index: beat.index,
      title: `Scene ${beat.index + 1}: ${beat.narrativeFunction}`,
      purpose: beat.purpose,
      narrativeFunction: beat.narrativeFunction,
      environment,
      durationSec: beat.durationSec,
      characterIds,
      propIds: [],
      emotionalObjective: params.creative.tone,
      narration: params.creative.requiresNarration ? beat.spokenHint : undefined,
      dialogue: params.creative.requiresDialogue ? beat.spokenHint : undefined,
      music: params.creative.requiresMusic ? params.grammar.tags.includes("luxury") ? "premium bed" : "supportive score" : undefined,
      ambience: params.creative.requiresSoundDesign ? "location ambience" : undefined,
      soundEffects: params.creative.requiresSoundDesign ? ["soft practicals"] : [],
      continuity: {
        entranceState: entrance,
        exitState: exit,
        identityLocks: characterIds.length ? ["character_identity"] : [],
        wardrobeLocks: characterIds.length ? ["wardrobe_state"] : [],
        propLocks: [],
      },
      shots: [stubShot],
      valueJob: beat.narrativeFunction,
      spokenLines: beat.spokenHint,
      visualDescription: beat.purpose,
      status: "planned",
    };
    return scene;
  });

  const locationMasters = [
    createLocationMaster({
      baseId: "location_001",
      name: "Primary Location",
      description: scenes[0]?.environment || "Primary production environment",
      environment: scenes[0]?.environment || "Primary production environment",
    }),
  ];

  const world: WorldSpec = {
    settingSummary: params.creative.visualLanguage,
    era: params.creative.grammarTags.includes("african") ? "as specified by idea" : undefined,
    locations: locationMasters.map((l) => ({
      id: l.identity.ref,
      name: l.name,
      description: l.description,
      masterAssetId: l.identity.ref,
    })),
  };

  const visualStyle: VisualStyleSpec = {
    look: params.creative.visualLanguage,
    colorLanguage: params.grammar.tags.includes("luxury")
      ? "premium restrained grade"
      : "coherent cinematic grade",
    cameraLanguage: params.grammar.coverage.preferredMovements.join(", "),
    lightingLanguage: "consistent key across scenes",
    references: [],
    antiSlopLaws: ANTI_SLOP_RULES.split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 8),
  };

  return { scenes, characters, world, visualStyle };
}

function environmentFor(
  fn: string,
  creative: CreativeSpec,
  grammar: ComposedGrammar
): string {
  if (creative.requiresProductShots && (fn === "product" || fn === "proof")) {
    return "Clean product stage with controlled reflections";
  }
  if (creative.requiresDocumentaryTreatment) {
    return "Real-world location plate matching documentary treatment";
  }
  if (creative.requiresAnimation) {
    return "Stylized animated environment with consistent design language";
  }
  if (grammar.tags.includes("african") || creative.grammarTags.includes("african")) {
    return "Historically grounded African kingdom environment matching creative intent";
  }
  return "Brand-consistent primary set / location";
}
