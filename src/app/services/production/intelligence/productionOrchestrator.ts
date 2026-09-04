/**
 * Production Orchestrator — idea → ProductionSpec (approve before expensive generation).
 * Wires Creative Director → Grammar → Narrative → Scenes/Shots → Routing → Prompt compile.
 */

import type { Brand, Character, Production, ProductionBrief, ViralSpark } from "../../../domain/types";
import type { ProductionSpec, CreativeControlMode, PlatformId, AspectRatioId } from "../specification/productionSpec";
import { buildDefaultAudioSpec } from "../specification/audioSpec";
import { createDefaultRoutingSpec } from "../specification/routingSpec";
import { createDefaultQualitySpec } from "../specification/qualitySpec";
import { productionSpecToBrief, legacyProductionToSpec, SPEC_VERSION, COMPILER_VERSION } from "../specification/adapters";
import { validateProductionSpec } from "../specification";
import { directCreativeIntent } from "./creativeDirector";
import { planNarrative } from "./narrativePlanner";
import { planProductionScenes } from "./productionPlanner";
import { routeProductionShots } from "../routing/capabilityRouter";
import { compileProductionPrompts } from "../generation/promptCompiler";
import { applyContinuityEngine } from "../continuity/continuityEngine";

export interface OrchestrateIdeaInput {
  idea: string;
  productionId?: string;
  brand?: Brand;
  character?: Character;
  spark?: ViralSpark;
  creativeControl?: CreativeControlMode;
  preferredPlatforms?: PlatformId[];
  preferredAspectRatio?: AspectRatioId;
  targetDurationSec?: number;
  productionMode?: string;
}

export interface OrchestrateIdeaResult {
  spec: ProductionSpec;
  brief: ProductionBrief;
  validation: ReturnType<typeof validateProductionSpec>;
}

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

export function orchestrateIdeaToProductionSpec(input: OrchestrateIdeaInput): OrchestrateIdeaResult {
  const now = new Date().toISOString();
  const productionId = input.productionId || newId("prod");
  const directed = directCreativeIntent({
    idea: input.idea || input.spark?.hook || input.spark?.title || "Create a video",
    creativeControl: input.creativeControl || "auto",
    preferredPlatforms: input.preferredPlatforms,
    preferredAspectRatio: input.preferredAspectRatio,
    targetDurationSec:
      input.targetDurationSec ||
      input.brand?.formatSettings?.targetDurationSec ||
      undefined,
    hasHostCharacter: Boolean(input.character),
    brandNiche: input.brand?.niche,
  });

  const duration =
    input.targetDurationSec ||
    directed.classification.durationHintSec ||
    input.brand?.formatSettings?.targetDurationSec ||
    60;

  const aspect =
    input.preferredAspectRatio ||
    directed.classification.aspectRatioHint ||
    (input.brand?.formatSettings?.aspectMode === "landscape" ? "16:9" : "9:16");

  const { narrative, beats } = planNarrative({
    idea: directed.creative.intent,
    creative: directed.creative,
    grammar: directed.grammar,
    targetDurationSec: duration,
  });

  const preferI2V = String(input.productionMode || "standard") !== "express";
  const planned = planProductionScenes({
    productionId,
    creative: directed.creative,
    grammar: directed.grammar,
    beats,
    aspectRatio: aspect,
    character: input.character
      ? {
          name: input.character.name,
          description: [input.character.style, ...(input.character.traits || [])].filter(Boolean).join(". "),
          sheetUrl: input.character.characterSheetUrl || input.character.imageUrl,
        }
      : undefined,
    preferI2V,
  });

  narrative.acts[0].sceneIds = planned.scenes.map((s) => s.id);

  let spec: ProductionSpec = {
    id: `spec_${productionId}`,
    version: 1,
    project: {
      id: productionId,
      title: (input.spark?.title || input.idea || "Untitled Production").slice(0, 120),
      brandId: input.brand?.id,
      sparkId: input.spark?.id,
      idea: directed.creative.intent,
      createdAt: now,
      updatedAt: now,
      productionMode: input.productionMode || input.brand?.productionMode || "standard",
      creativeControl: input.creativeControl || "auto",
      targetDurationSec: duration,
      platforms: directed.classification.platformHints,
      aspectRatio: aspect,
      formats: directed.classification.platformHints.map(String),
      status: "brief_pending_approval",
    },
    creative: directed.creative,
    world: planned.world,
    characters: planned.characters,
    assets: [...planned.characters],
    narrative,
    scenes: planned.scenes,
    audio: buildDefaultAudioSpec({
      requiresNarration: directed.creative.requiresNarration,
      requiresDialogue: directed.creative.requiresDialogue,
      requiresMusic: directed.creative.requiresMusic,
      requiresSoundDesign: directed.creative.requiresSoundDesign,
      narratorVoiceRef: input.character?.voice?.voiceId,
    }),
    visualStyle: planned.visualStyle,
    continuity: {
      globalLocks: ["identity", "wardrobe", "set_lighting"],
      identityPackSummary: planned.characters[0]?.description || "no host lock",
      shotBridges: [],
      lastFrameChainEnabled: preferI2V,
    },
    routing: createDefaultRoutingSpec({
      capabilityPolicy: {
        preferCharacterConsistency: directed.creative.requiresCharacters,
        preferFirstLastFrame: preferI2V,
        preferNativeAudio: directed.creative.requiresDialogue,
        preferSpeed: directed.creative.pacing === "compressed",
        preferCost: false,
      },
    }),
    quality: createDefaultQualitySpec(duration >= 180 ? "cinema" : "social"),
    researchContext: input.spark?.researchContext,
    meta: {
      specVersion: SPEC_VERSION,
      compilerVersion: COMPILER_VERSION,
      createdFrom: input.spark ? "spark" : "idea",
      legacyProductionId: productionId,
      grammarIds: directed.grammar.sources,
    },
  };

  spec = routeProductionShots(spec);
  spec = applyContinuityEngine(spec);
  spec = compileProductionPrompts(spec);

  const shotCount = spec.scenes.reduce((n, s) => n + s.shots.length, 0);
  spec.approvalSummary = {
    projectTitle: spec.project.title,
    genreLabel: `${directed.grammar.label}`,
    styleLabel: spec.visualStyle.look,
    structureLabel: `${spec.scenes.length} scenes / ${shotCount} shots`,
    characterCount: spec.characters.length,
    locationCount: spec.world.locations.length,
    sceneCount: spec.scenes.length,
    shotCount,
    audioSummary: [
      spec.audio.hasNarration ? "Narrator" : null,
      spec.audio.hasDialogue ? "Dialogue" : null,
      spec.audio.hasMusic ? "Music" : null,
      spec.audio.hasSfx ? "SFX" : null,
    ]
      .filter(Boolean)
      .join(" + ") || "Silent visual",
    generationStrategy: preferI2V ? "Hybrid image-to-video + keyframes" : "Narrator slideshow stills",
    estimatedGenerationTasks: shotCount + (spec.audio.hasNarration ? 1 : 0),
    qualityTarget: spec.quality.target === "cinema" ? "Cinema" : "Social",
  };

  const brief = productionSpecToBrief(spec);
  const validation = validateProductionSpec(spec);
  return { spec, brief, validation };
}

/**
 * Attach/upgrade an existing Production with a ProductionSpec without breaking UI fields.
 */
export function upgradeProductionWithSpec(
  production: Production,
  opts?: { brand?: Brand; character?: Character; spark?: ViralSpark; idea?: string }
): { production: Production; spec: ProductionSpec } {
  const idea =
    opts?.idea ||
    production.brief?.hook ||
    opts?.spark?.hook ||
    production.title;

  if (!production.brief?.storyboard?.length && !production.productionScenes?.length) {
    const { spec, brief } = orchestrateIdeaToProductionSpec({
      idea,
      productionId: production.id,
      brand: opts?.brand,
      character: opts?.character,
      spark: opts?.spark,
      targetDurationSec: production.targetDurationSec,
      productionMode: String(production.mode || production.productionMode || "standard"),
      preferredAspectRatio: production.aspectRatio as AspectRatioId,
    });
    return {
      spec,
      production: {
        ...production,
        brief: { ...brief, ...production.brief, storyboard: brief.storyboard, beats: brief.beats },
        productionScenes: brief.storyboard,
        targetDurationSec: spec.project.targetDurationSec,
        reasoning: {
          ...(typeof production.reasoning === "object" && production.reasoning ? production.reasoning : {}),
          productionSpec: spec,
          approvalSummary: spec.approvalSummary,
        },
      },
    };
  }

  const spec = legacyProductionToSpec({
    production,
    brand: opts?.brand,
    character: opts?.character,
    spark: opts?.spark,
  });
  const routed = compileProductionPrompts(routeProductionShots(spec));
  return {
    spec: routed,
    production: {
      ...production,
      reasoning: {
        ...(typeof production.reasoning === "object" && production.reasoning ? production.reasoning : {}),
        productionSpec: routed,
        approvalSummary: routed.approvalSummary,
      },
    },
  };
}

export { directCreativeIntent } from "./creativeDirector";
export { classifyCreativeIntent } from "./genreClassifier";
export { planNarrative } from "./narrativePlanner";
