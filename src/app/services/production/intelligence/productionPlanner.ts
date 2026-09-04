/**
 * Production planner — builds SceneSpec[] + assets from creative + narrative plans.
 */

import type { CreativeSpec, WorldSpec, VisualStyleSpec, AspectRatioId } from "../specification/productionSpec";
import type { SceneSpec } from "../specification/sceneSpec";
import type { CharacterMaster } from "../specification/assetSpec";
import { createCharacterMaster, createLocationMaster } from "../specification/assetSpec";
import type { ComposedGrammar } from "../grammar";
import type { NarrativeBeatPlan } from "./narrativePlanner";
import { planShotsForScene } from "../cinematography/shotPlanner";
import { ANTI_SLOP_RULES } from "../productionPromptPacks";

export function planProductionScenes(params: {
  productionId: string;
  creative: CreativeSpec;
  grammar: ComposedGrammar;
  beats: NarrativeBeatPlan[];
  aspectRatio: AspectRatioId | string;
  character?: { name: string; description?: string; sheetUrl?: string | null };
  preferI2V: boolean;
}): {
  scenes: SceneSpec[];
  characters: CharacterMaster[];
  world: WorldSpec;
  visualStyle: VisualStyleSpec;
} {
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
  const maxShots = Math.max(1, Math.round(params.creative.estimatedShotCount / Math.max(1, params.beats.length)));

  const scenes: SceneSpec[] = params.beats.map((beat) => {
    const sceneId = `${params.productionId}_scene_${beat.index}`;
    const environment = environmentFor(beat.narrativeFunction, params.creative);
    const base: Omit<SceneSpec, "shots"> = {
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
      soundEffects: params.creative.requiresSoundDesign ? ["soft practical ambience"] : [],
      continuity: {
        entranceState:
          beat.index === 0
            ? "Cold open into first frame"
            : `Continue from previous scene exit with locked identity`,
        exitState: `Complete ${beat.narrativeFunction} with clear end state`,
        identityLocks: characterIds.length ? ["character_identity"] : [],
        wardrobeLocks: characterIds.length ? ["wardrobe_state"] : [],
        propLocks: [],
      },
      valueJob: beat.narrativeFunction,
      spokenLines: beat.spokenHint,
      visualDescription: beat.purpose,
      status: "planned",
    };

    const shots = planShotsForScene({
      scene: base,
      grammar: params.grammar,
      aspectRatio: String(params.aspectRatio),
      maxShots,
      preferI2V: params.preferI2V,
      characterIds,
    });

    return { ...base, shots };
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
    locations: locationMasters.map((l) => ({
      id: l.identity.ref,
      name: l.name,
      description: l.description,
      masterAssetId: l.identity.ref,
    })),
  };

  const visualStyle: VisualStyleSpec = {
    look: params.creative.visualLanguage,
    colorLanguage: params.grammar.tags.includes("luxury") ? "premium restrained grade" : "coherent cinematic grade",
    cameraLanguage: params.grammar.coverage.preferredMovements.join(", "),
    lightingLanguage: "consistent key across scenes",
    references: [],
    antiSlopLaws: ANTI_SLOP_RULES.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 8),
  };

  return {
    scenes,
    characters,
    world: {
      ...world,
      locations: [
        ...world.locations,
      ],
    },
    visualStyle,
  };
}

function environmentFor(fn: string, creative: CreativeSpec): string {
  if (creative.requiresProductShots && (fn === "product" || fn === "proof")) {
    return "Clean product stage with controlled reflections";
  }
  if (creative.requiresDocumentaryTreatment) {
    return "Real-world location plate matching documentary treatment";
  }
  if (creative.requiresAnimation) {
    return "Stylized animated environment with consistent design language";
  }
  return "Brand-consistent primary set / location";
}
