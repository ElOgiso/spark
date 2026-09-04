/**
 * Production Orchestrator — intelligent planning entry point.
 *
 * User Idea
 *   → Creative Director
 *   → Genre Classifier
 *   → Production Grammar
 *   → Narrative Planner
 *   → Production Planner
 *   → ProductionSpec
 *   → Cinematography / Continuity / Strategy / Routing / Prompt / Generation Tasks
 *   → validated ProductionSpec (+ ProductionBrief for existing UI)
 *
 * Does NOT execute media generation API calls.
 */

import type { Brand, Character, MemoryItem, Production, ProductionBrief, ViralSpark } from "../../../domain/types";
import type {
  ProductionSpec,
  CreativeControlMode,
  PlatformId,
  AspectRatioId,
} from "../specification/productionSpec";
import { buildDefaultAudioSpec } from "../specification/audioSpec";
import { createDefaultRoutingSpec } from "../specification/routingSpec";
import { createDefaultQualitySpec } from "../specification/qualitySpec";
import {
  productionSpecToBrief,
  legacyProductionToSpec,
  SPEC_VERSION,
  COMPILER_VERSION,
} from "../specification/adapters";
import { validateProductionSpec, type SpecValidationResult } from "../specification";
import { buildResearchRequirement } from "../specification/researchRequirement";
import type { GenerationTask } from "../specification/generationTask";
import { directCreativeIntent, type CreativeDirectorResult, type CreativeDirection } from "./creativeDirector";
import { planNarrative, type NarrativeBeatPlan } from "./narrativePlanner";
import { planProductionScenes } from "./productionPlanner";
import type { ComposedGrammar } from "../grammar";
import type { GenreClassification } from "./genreClassifier";
import type { CreatorProfile } from "../specification/creatorProfile";
import type { LearnedPreferences, ProjectInstructionOverrides } from "./preferenceResolver";
import {
  resolveIntelligenceRoleProvider,
  type IntelligenceRoleTrace,
  type ProductionIntelligenceRole,
} from "./intelligenceRoles";
import {
  validateCreativeDirection,
  validateGenreClassification,
  validateGrammarSelection,
  validateNarrativePlan,
  sanitizeNarrativeBeats,
} from "./stageValidation";
import { applyVisualPlanningPipeline } from "../generation/visualPlanningPipeline";
import type { ProductionDag } from "../dag/productionDag";

export interface OrchestrateIdeaInput {
  idea: string;
  productionId?: string;
  brand?: Brand;
  character?: Character;
  spark?: ViralSpark;
  memoryItems?: MemoryItem[];
  creatorProfile?: CreatorProfile;
  creativeControl?: CreativeControlMode;
  preferredPlatforms?: PlatformId[];
  preferredAspectRatio?: AspectRatioId;
  targetDurationSec?: number;
  productionMode?: string;
  projectOverrides?: ProjectInstructionOverrides;
  learned?: LearnedPreferences;
  /** Optional: restrict routing to these provider ids (e.g. keyed providers) */
  availableProviderIds?: string[];
  /** When false, skip Phase 3 cinematography/routing (blueprint stubs only) */
  applyVisualPlanning?: boolean;
}

export interface ProductionIntelligenceTrace {
  productionRequestId: string;
  idea: string;
  creativeDirection: CreativeDirection;
  classification: GenreClassification;
  selectedGrammarIds: string[];
  grammarLabel: string;
  narrativeStructureId: string;
  narrativeBeats: NarrativeBeatPlan[];
  productionSpecVersion: string;
  roles: IntelligenceRoleTrace[];
  errors: string[];
  warnings: string[];
  createdAt: string;
  /** Phase 3 visual planning stats */
  cinematographyApplied?: boolean;
  shotCount?: number;
  routedShots?: number;
  generationTaskCount?: number;
  continuityBridges?: number;
}

export interface OrchestrateIdeaResult {
  ok: boolean;
  spec?: ProductionSpec;
  brief?: ProductionBrief;
  validation: SpecValidationResult;
  directed: CreativeDirectorResult;
  narrative?: {
    structureId: string;
    beats: NarrativeBeatPlan[];
  };
  grammar?: ComposedGrammar;
  classification?: GenreClassification;
  generationTasks?: GenerationTask[];
  dag?: ProductionDag;
  trace: ProductionIntelligenceTrace;
  errors: string[];
}

export type CreateProductionPlanInput = OrchestrateIdeaInput;
export type CreateProductionPlanResult = OrchestrateIdeaResult;

/**
 * Clean public entry point for intelligent production planning.
 * Idea → Creative Director → Grammar → Narrative → ProductionSpec (no media generation).
 */
export function createProductionPlan(input: CreateProductionPlanInput): CreateProductionPlanResult {
  return orchestrateIdeaToProductionSpec(input);
}

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function role(roleName: ProductionIntelligenceRole): IntelligenceRoleTrace {
  return {
    role: roleName,
    routingCategory: roleName === "narrativePlanning" ? "executive" : roleName === "research" ? "research" : "production",
    provider: resolveIntelligenceRoleProvider(roleName),
  };
}

export function orchestrateIdeaToProductionSpec(input: OrchestrateIdeaInput): OrchestrateIdeaResult {
  const now = new Date().toISOString();
  const productionId = input.productionId || newId("prod");
  const requestId = newId("req");
  const errors: string[] = [];

  const directed = directCreativeIntent({
    idea: input.idea || input.spark?.hook || input.spark?.title || "",
    creativeControl: input.creativeControl || "auto",
    preferredPlatforms: input.preferredPlatforms,
    preferredAspectRatio: input.preferredAspectRatio,
    targetDurationSec:
      input.targetDurationSec || input.brand?.formatSettings?.targetDurationSec || undefined,
    productionMode: input.productionMode,
    hasHostCharacter: Boolean(input.character),
    brandNiche: input.brand?.niche,
    brand: input.brand,
    character: input.character,
    creatorProfile: input.creatorProfile,
    memoryItems: input.memoryItems,
    spark: input.spark,
    researchContextPresent: Boolean(input.spark?.researchContext),
    projectOverrides: input.projectOverrides,
    learned: input.learned,
  });

  errors.push(...directed.errors);

  const directionGate = validateCreativeDirection(directed.direction);
  const classGate = validateGenreClassification(directed.classification);
  const grammarGate = validateGrammarSelection(directed.grammar);
  errors.push(...directionGate.errors, ...classGate.errors, ...grammarGate.errors);

  const emptyTrace = (extraErrors: string[] = []): ProductionIntelligenceTrace => ({
    productionRequestId: requestId,
    idea: input.idea || "",
    creativeDirection: directed.direction,
    classification: directed.classification,
    selectedGrammarIds: directed.grammar.sources,
    grammarLabel: directed.grammar.label,
    narrativeStructureId: "none",
    narrativeBeats: [],
    productionSpecVersion: SPEC_VERSION,
    roles: [directed.roleTrace],
    errors: [...errors, ...extraErrors],
    warnings: [
      ...directed.direction.unknownFields.map((f) => `unknown:${f}`),
      ...directionGate.warnings,
      ...classGate.warnings,
    ],
    createdAt: now,
  });

  if (directed.errors.includes("empty_idea") || directionGate.errors.length > 0) {
    return {
      ok: false,
      validation: { ok: false, errors: errors.length ? errors : ["empty_idea"], warnings: directionGate.warnings },
      directed,
      grammar: directed.grammar,
      classification: directed.classification,
      trace: emptyTrace(["Cannot plan production without valid creative direction"]),
      errors: errors.length ? errors : ["empty_idea", "Cannot plan production without an idea"],
    };
  }

  const duration =
    directed.preferences.targetDurationSec ||
    directed.direction.durationSec ||
    directed.classification.durationHintSec ||
    input.brand?.formatSettings?.targetDurationSec ||
    60;

  const aspect: AspectRatioId | string =
    directed.preferences.aspectRatio ||
    (directed.direction.aspectRatio !== "unknown" ? directed.direction.aspectRatio : undefined) ||
    directed.classification.aspectRatioHint ||
    (input.brand?.formatSettings?.aspectMode === "landscape" ? "16:9" : "9:16");

  const narrativePlan = planNarrative({
    idea: directed.creative.intent,
    creative: directed.creative,
    grammar: directed.grammar,
    targetDurationSec: duration,
  });
  const beats = sanitizeNarrativeBeats(narrativePlan.beats);
  const structureId = narrativePlan.structureId;
  const narrative = narrativePlan.narrative;

  const narrativeGate = validateNarrativePlan(beats, structureId);
  if (!narrativeGate.ok) {
    errors.push(...narrativeGate.errors);
    return {
      ok: false,
      validation: { ok: false, errors: narrativeGate.errors, warnings: narrativeGate.warnings },
      directed,
      grammar: directed.grammar,
      classification: directed.classification,
      narrative: { structureId, beats },
      trace: emptyTrace(narrativeGate.errors),
      errors,
    };
  }

  const planned = planProductionScenes({
    productionId,
    creative: directed.creative,
    grammar: directed.grammar,
    beats,
    aspectRatio: aspect,
    character: input.character
      ? {
          name: input.character.name,
          description: [input.character.style, ...(input.character.traits || [])]
            .filter(Boolean)
            .join(". "),
          sheetUrl: input.character.characterSheetUrl || input.character.imageUrl,
        }
      : undefined,
    blueprintShots: true,
  });

  narrative.acts[0].sceneIds = planned.scenes.map((s) => s.id);

  const preferI2V = String(input.productionMode || directed.preferences.productionMode || "standard") !== "express";

  const spec: ProductionSpec = {
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
      productionMode:
        input.productionMode ||
        directed.preferences.productionMode ||
        input.brand?.productionMode ||
        "standard",
      creativeControl: directed.preferences.creativeControl || input.creativeControl || "auto",
      targetDurationSec: duration,
      platforms: directed.classification.platformHints,
      aspectRatio: aspect as AspectRatioId,
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
    // Routing policy — Phase 3 fills shotDecisions via visual planning pipeline
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
    researchRequirements: buildResearchRequirement({
      idea: directed.creative.intent,
      requiresResearch: directed.creative.requiresResearch,
      genre: directed.creative.genre,
      existingResearchPresent: Boolean(input.spark?.researchContext),
    }),
    researchContext: input.spark?.researchContext,
    meta: {
      specVersion: SPEC_VERSION,
      compilerVersion: COMPILER_VERSION,
      createdFrom: input.spark ? "spark" : "idea",
      legacyProductionId: productionId,
      grammarIds: directed.grammar.sources,
    },
  };

  // Phase 3: cinematography → continuity → strategy → routing → prompts → generation tasks
  // Still planning-only — no media API calls.
  let generationTasks: GenerationTask[] | undefined;
  let dag: ProductionDag | undefined;
  let visualStats:
    | {
        shotCount: number;
        routedShots: number;
        generationTaskCount: number;
        continuityBridges: number;
      }
    | undefined;

  let plannedSpec = spec;
  if (input.applyVisualPlanning !== false) {
    const visual = applyVisualPlanningPipeline(spec, {
      grammar: directed.grammar,
      preferI2V,
      availableProviderIds: input.availableProviderIds,
    });
    plannedSpec = visual.spec;
    generationTasks = visual.generationTasks;
    dag = visual.dag;
    visualStats = {
      shotCount: visual.stats.shotCount,
      routedShots: visual.stats.routedShots,
      generationTaskCount: visual.stats.generationTaskCount,
      continuityBridges: visual.stats.continuityBridges,
    };
  }

  const shotCount = plannedSpec.scenes.reduce((n, s) => n + s.shots.length, 0);
  plannedSpec = {
    ...plannedSpec,
    approvalSummary: {
      projectTitle: plannedSpec.project.title,
      genreLabel: directed.grammar.label,
      styleLabel: plannedSpec.visualStyle.look,
      structureLabel: `${plannedSpec.scenes.length} scenes / ${shotCount} shots`,
      characterCount: plannedSpec.characters.length,
      locationCount: plannedSpec.world.locations.length,
      sceneCount: plannedSpec.scenes.length,
      shotCount,
      audioSummary: [
        plannedSpec.audio.hasNarration ? "Narrator" : null,
        plannedSpec.audio.hasDialogue ? "Dialogue" : null,
        plannedSpec.audio.hasMusic ? "Music" : null,
        plannedSpec.audio.hasSfx ? "SFX" : null,
      ]
        .filter(Boolean)
        .join(" + ") || "Visual-led",
      generationStrategy: visualStats
        ? `Planning complete — ${visualStats.generationTaskCount} generation tasks routed (media deferred until approval)`
        : "Planning only — generation deferred until approval",
      estimatedGenerationTasks:
        visualStats?.generationTaskCount ??
        shotCount + (plannedSpec.audio.hasNarration ? 1 : 0),
      qualityTarget: plannedSpec.quality.target === "cinema" ? "Cinema" : "Social",
    },
  };

  const validation = validateProductionSpec(plannedSpec);
  if (!validation.ok) {
    errors.push("invalid_production_spec", ...validation.errors);
  }

  // Never let malformed specs silently continue as "ok"
  const ok = validation.ok && errors.length === 0;

  const brief = ok ? productionSpecToBrief(plannedSpec) : undefined;

  const trace: ProductionIntelligenceTrace = {
    productionRequestId: requestId,
    idea: directed.creative.intent,
    creativeDirection: directed.direction,
    classification: directed.classification,
    selectedGrammarIds: directed.grammar.sources,
    grammarLabel: directed.grammar.label,
    narrativeStructureId: structureId,
    narrativeBeats: beats,
    productionSpecVersion: SPEC_VERSION,
    roles: [
      directed.roleTrace,
      role("narrativePlanning"),
      role("productionPlanning"),
      role("visualReasoning"),
      ...(directed.creative.requiresResearch ? [role("research")] : []),
    ],
    errors,
    warnings: [
      ...validation.warnings,
      ...directed.direction.unknownFields.map((f) => `unknown:${f}`),
      ...(directed.direction.ambiguous ? ["ambiguous_classification"] : []),
    ],
    createdAt: now,
    cinematographyApplied: Boolean(visualStats),
    shotCount: visualStats?.shotCount ?? shotCount,
    routedShots: visualStats?.routedShots,
    generationTaskCount: visualStats?.generationTaskCount,
    continuityBridges: visualStats?.continuityBridges,
  };

  return {
    ok,
    spec: ok ? plannedSpec : undefined,
    brief,
    validation,
    directed,
    narrative: { structureId, beats },
    grammar: directed.grammar,
    classification: directed.classification,
    generationTasks: ok ? generationTasks : undefined,
    dag: ok ? dag : undefined,
    trace,
    errors,
  };
}

/**
 * Attach ProductionSpec to an existing Production for UI compatibility.
 * Uses orchestrator when no storyboard exists; otherwise legacy adapter only.
 * Does not trigger media generation.
 */
export function upgradeProductionWithSpec(
  production: Production,
  opts?: {
    brand?: Brand;
    character?: Character;
    spark?: ViralSpark;
    idea?: string;
    creatorProfile?: CreatorProfile;
    memoryItems?: MemoryItem[];
  }
): { production: Production; spec: ProductionSpec; trace?: ProductionIntelligenceTrace; ok: boolean } {
  const idea =
    opts?.idea || production.brief?.hook || opts?.spark?.hook || production.title;

  if (!production.brief?.storyboard?.length && !production.productionScenes?.length) {
    const result = orchestrateIdeaToProductionSpec({
      idea,
      productionId: production.id,
      brand: opts?.brand,
      character: opts?.character,
      spark: opts?.spark,
      creatorProfile: opts?.creatorProfile,
      memoryItems: opts?.memoryItems,
      targetDurationSec: production.targetDurationSec,
      productionMode: String(production.mode || production.productionMode || "standard"),
      preferredAspectRatio: production.aspectRatio as AspectRatioId,
    });

    if (!result.ok || !result.spec || !result.brief) {
      return {
        ok: false,
        spec: result.spec || legacyProductionToSpec({ production, brand: opts?.brand, character: opts?.character, spark: opts?.spark }),
        trace: result.trace,
        production: {
          ...production,
          reasoning: {
            ...(typeof production.reasoning === "object" && production.reasoning ? production.reasoning : {}),
            productionIntelligenceTrace: result.trace,
            productionIntelligenceErrors: result.errors,
          },
        },
      };
    }

    return {
      ok: true,
      spec: result.spec,
      trace: result.trace,
      production: {
        ...production,
        brief: {
          ...result.brief,
          ...production.brief,
          storyboard: result.brief.storyboard,
          beats: result.brief.beats,
          visualDirection: result.brief.visualDirection,
          whyThisWorks: result.brief.whyThisWorks,
        },
        productionScenes: result.brief.storyboard,
        targetDurationSec: result.spec.project.targetDurationSec,
        reasoning: {
          ...(typeof production.reasoning === "object" && production.reasoning ? production.reasoning : {}),
          productionSpec: result.spec,
          approvalSummary: result.spec.approvalSummary,
          productionIntelligenceTrace: result.trace,
          creativeDirection: result.directed.direction,
          grammarIds: result.spec.meta.grammarIds,
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

  return {
    ok: true,
    spec,
    production: {
      ...production,
      reasoning: {
        ...(typeof production.reasoning === "object" && production.reasoning ? production.reasoning : {}),
        productionSpec: spec,
        approvalSummary: spec.approvalSummary,
      },
    },
  };
}

export { directCreativeIntent } from "./creativeDirector";
export { classifyCreativeIntent } from "./genreClassifier";
export { planNarrative } from "./narrativePlanner";
