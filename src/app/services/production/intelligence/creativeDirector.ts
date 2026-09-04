/**
 * Creative Director — structured creative direction from raw idea + creator/project context.
 * Unknown values are explicit; project instructions win over creator defaults / memory.
 */

import { classifyCreativeIntent, type GenreClassification } from "./genreClassifier";
import { composeGrammars, type ComposedGrammar } from "../grammar";
import type {
  CreativeSpec,
  ContentGenreId,
  PlatformId,
  AspectRatioId,
  CreativeControlMode,
} from "../specification/productionSpec";
import type { CreatorProfile } from "../specification/creatorProfile";
import type { Brand, Character, MemoryItem, ViralSpark } from "../../../domain/types";
import {
  resolveProductionPreferences,
  type LearnedPreferences,
  type ProjectInstructionOverrides,
} from "./preferenceResolver";
import {
  resolveIntelligenceRoleProvider,
  type IntelligenceRoleTrace,
} from "./intelligenceRoles";
import {
  buildCreativeStrategy,
  type CreativeStrategy,
  type CreativePreflightResult,
  type BuildCreativeStrategyResult,
} from "./strategy";

export type TriStateRequirement = true | false | "unknown";

export interface CreativeDirection {
  contentType: string;
  genre: ContentGenreId | "unknown";
  subgenre?: string;
  tone: string;
  audience: string;
  platform: PlatformId[];
  durationSec?: number;
  aspectRatio: AspectRatioId | "unknown";
  visualStyle: string;
  pacing: string;
  narrativeApproach: string;
  productionComplexity: "simple" | "standard" | "complex" | "unknown";
  characterRequirement: TriStateRequirement;
  dialogueRequirement: TriStateRequirement;
  narrationRequirement: TriStateRequirement;
  researchRequirement: TriStateRequirement;
  audioRequirement: TriStateRequirement;
  animationRequirement: TriStateRequirement;
  visualGenerationRequirement: TriStateRequirement;
  confidence: number;
  ambiguous: boolean;
  unknownFields: string[];
  rationale: string[];
}

export interface CreativeDirectorInput {
  idea: string;
  creativeControl?: CreativeControlMode;
  preferredPlatforms?: PlatformId[];
  preferredAspectRatio?: AspectRatioId;
  targetDurationSec?: number;
  productionMode?: string;
  automationMode?: "manual" | "balanced" | "autonomous";
  hasHostCharacter?: boolean;
  brandNiche?: string;
  brand?: Brand;
  character?: Character;
  creatorProfile?: CreatorProfile;
  memoryItems?: MemoryItem[];
  /** Phase 8 structured creative learnings */
  creativeLearnings?: import("./performance").CreativeLearning[];
  performanceHints?: import("./strategy").CreativePerformanceHints;
  accountId?: string;
  spark?: ViralSpark;
  researchContextPresent?: boolean;
  /** Explicit project overrides — always win */
  projectOverrides?: ProjectInstructionOverrides;
  learned?: LearnedPreferences;
  optimizationProfile?: import("./strategy").OptimizationProfile;
  existingMasters?: import("../specification/assetSpec").MasterAssetRef[];
  explicitObjective?: string;
}

export interface CreativeDirectorResult {
  classification: GenreClassification;
  grammar: ComposedGrammar;
  direction: CreativeDirection;
  creative: CreativeSpec;
  preferences: ReturnType<typeof resolveProductionPreferences>;
  roleTrace: IntelligenceRoleTrace;
  /** Phase 7 executive strategy */
  strategy?: CreativeStrategy;
  preflight?: CreativePreflightResult;
  strategyBundle?: BuildCreativeStrategyResult;
  errors: string[];
}

function tri(value: boolean | undefined, unknownWhenAmbiguous: boolean): TriStateRequirement {
  if (unknownWhenAmbiguous) return "unknown";
  return Boolean(value);
}

export function directCreativeIntent(input: CreativeDirectorInput): CreativeDirectorResult {
  const errors: string[] = [];
  const rawIdea = (input.idea || input.spark?.hook || input.spark?.title || "").trim();
  if (!rawIdea) {
    errors.push("empty_idea");
  }

  const preferences = resolveProductionPreferences({
    project: {
      idea: rawIdea,
      targetDurationSec: input.projectOverrides?.targetDurationSec ?? input.targetDurationSec,
      aspectRatio: input.projectOverrides?.aspectRatio ?? input.preferredAspectRatio,
      platforms: input.projectOverrides?.platforms ?? input.preferredPlatforms,
      creativeControl: input.projectOverrides?.creativeControl ?? input.creativeControl,
      productionMode: input.projectOverrides?.productionMode ?? input.productionMode,
      tone: input.projectOverrides?.tone,
      visualStyle: input.projectOverrides?.visualStyle,
    },
    creator: input.creatorProfile,
    learned: input.learned,
  });

  const classification = classifyCreativeIntent(rawIdea || " ", {
    preferredPlatforms: preferences.platforms,
    preferredAspectRatio: preferences.aspectRatio,
    targetDurationSec: preferences.targetDurationSec,
  });

  const grammar = composeGrammars(
    classification.primaryGenre,
    classification.secondaryGenres,
    classification.styleTags
  );

  const duration =
    preferences.targetDurationSec ||
    classification.durationHintSec ||
    input.brand?.formatSettings?.targetDurationSec ||
    undefined;

  const ambiguous = classification.ambiguous || Boolean(errors.length);
  const faceless = classification.styleTags.includes("faceless");
  const talkingHead =
    classification.styleTags.includes("talking-head") ||
    Boolean(input.hasHostCharacter) ||
    Boolean(input.character);

  const contentType =
    classification.primaryGenre === "custom" && ambiguous
      ? "unknown"
      : classification.primaryGenre.replace(/_/g, " ");

  let productionComplexity: CreativeDirection["productionComplexity"] = "unknown";
  if (duration != null) {
    if (duration <= 45) productionComplexity = "simple";
    else if (duration <= 180) productionComplexity = "standard";
    else productionComplexity = "complex";
  } else if (!ambiguous) {
    productionComplexity = "standard";
  }

  // Phase 7 — Creative Strategy (executive decisions above specialist planners)
  const strategyBundle = buildCreativeStrategy({
    idea: rawIdea,
    genre: classification.primaryGenre,
    styleTags: classification.styleTags,
    tone: preferences.tone || classification.tone,
    audienceHint: classification.audience,
    platforms: classification.platformHints.map(String),
    durationSec: duration,
    aspectRatio:
      (preferences.aspectRatio as string) ||
      (classification.aspectRatioHint as string) ||
      undefined,
    productionMode: preferences.productionMode || input.productionMode,
    creativeControl: preferences.creativeControl || input.creativeControl,
    automationMode: input.automationMode,
    brand: input.brand,
    character: input.character,
    creatorProfile: input.creatorProfile,
    spark: input.spark,
    memoryItems: input.memoryItems,
    creativeLearnings: input.creativeLearnings,
    performanceHints: input.performanceHints,
    accountId: input.accountId,
    existingMasters: input.existingMasters,
    requiresCharacters:
      talkingHead ||
      ["narrative_film", "anime", "animation", "comedy"].includes(classification.primaryGenre),
    requiresDialogue: grammar.audioBias.dialogue && !faceless,
    requiresNarration: grammar.audioBias.narration || faceless || !talkingHead,
    requiresMusic: grammar.audioBias.music,
    requiresProduct: ["advertisement", "product_demo"].includes(classification.primaryGenre),
    optimizationProfile: input.optimizationProfile,
    explicitObjective: input.explicitObjective,
  });

  const estimatedSceneCount = strategyBundle.strategy.complexity.estimatedScenes;
  const estimatedShotCount = strategyBundle.strategy.complexity.estimatedShots;

  // Map Phase 7 complexity onto legacy direction field
  const levelMap: Record<string, CreativeDirection["productionComplexity"]> = {
    simple: "simple",
    moderate: "standard",
    complex: "complex",
    high_complexity: "complex",
  };
  productionComplexity = levelMap[strategyBundle.strategy.complexity.level] || productionComplexity;

  const requiresCharacters =
    talkingHead ||
    ["narrative_film", "anime", "animation", "comedy"].includes(classification.primaryGenre);
  const requiresNarration = grammar.audioBias.narration || faceless || !talkingHead;
  const requiresDialogue = grammar.audioBias.dialogue && !faceless;
  const requiresAnimation = ["animation", "anime"].includes(classification.primaryGenre);
  const requiresResearch =
    ["documentary", "news_explainer", "educational"].includes(classification.primaryGenre) ||
    Boolean(input.researchContextPresent) ||
    Boolean(input.spark?.researchContext) ||
    /current|trend|today|202\d|bitcoin/.test(rawIdea.toLowerCase());

  const visualStyle =
    preferences.visualStyle ||
    [grammar.label, ...classification.styleTags].filter(Boolean).join(" / ") ||
    "unknown";

  const tone = preferences.tone || classification.tone || "unknown";

  const direction: CreativeDirection = {
    contentType,
    genre: ambiguous && classification.primaryGenre === "custom" ? "unknown" : classification.primaryGenre,
    subgenre: classification.secondaryGenres[0] || classification.styleTags[0],
    tone,
    audience: classification.audience,
    platform: classification.platformHints,
    durationSec: duration,
    aspectRatio: preferences.aspectRatio || classification.aspectRatioHint || "unknown",
    visualStyle,
    pacing: grammar.pacingBias,
    narrativeApproach: grammar.narrativeFunctions.slice(0, 6).join(" → ") || "unknown",
    productionComplexity,
    characterRequirement: tri(requiresCharacters, ambiguous && !input.character),
    dialogueRequirement: tri(requiresDialogue, ambiguous),
    narrationRequirement: tri(requiresNarration, ambiguous),
    researchRequirement: tri(requiresResearch, ambiguous && !requiresResearch),
    audioRequirement: tri(grammar.audioBias.music || requiresNarration, ambiguous),
    animationRequirement: tri(requiresAnimation, false),
    visualGenerationRequirement: tri(true, false),
    confidence: classification.confidence,
    ambiguous,
    unknownFields: [
      ...classification.unknownFields,
      ...(duration == null ? ["duration"] : []),
      ...(visualStyle === "unknown" ? ["visualStyle"] : []),
    ],
    rationale: [
      ...classification.rationale,
      ...preferences.precedenceNotes,
      `Grammar: ${grammar.label}`,
      duration != null
        ? `Estimated ${estimatedSceneCount} scenes / ${estimatedShotCount} shots for ~${duration}s`
        : "Duration unknown — scene count deferred to planner defaults",
      input.brandNiche || input.brand?.niche
        ? `Brand niche context: ${input.brandNiche || input.brand?.niche}`
        : "",
      strategyBundle.strategy.userFacingSummary,
      strategyBundle.preflight.status === "ready" ? "Creative preflight ready" : `Creative preflight: ${strategyBundle.preflight.status}`,
    ].filter(Boolean),
  };

  const creative: CreativeSpec = {
    intent: rawIdea || "(empty idea)",
    genre: (direction.genre === "unknown" ? "custom" : direction.genre) as ContentGenreId,
    grammarTags: Array.from(new Set([...grammar.tags, ...classification.styleTags])),
    subgenre: direction.subgenre,
    tone: direction.tone,
    audience: direction.audience,
    narrativeStructure: direction.narrativeApproach,
    visualLanguage: direction.visualStyle,
    pacing: direction.pacing,
    emotionalArc: direction.tone === "unknown" ? "unknown" : `${direction.tone} progression`,
    requiresHost: direction.characterRequirement === true && talkingHead && !faceless,
    requiresCharacters: direction.characterRequirement === true,
    requiresNarration: direction.narrationRequirement !== false,
    requiresDialogue: direction.dialogueRequirement === true,
    requiresAnimation: direction.animationRequirement === true,
    requiresProductShots: ["advertisement", "product_demo"].includes(classification.primaryGenre),
    requiresDocumentaryTreatment:
      classification.primaryGenre === "documentary" || classification.primaryGenre === "news_explainer",
    requiresResearch: direction.researchRequirement === true,
    requiresGeneratedEnvironments: true,
    requiresStockOrUserAssets: classification.primaryGenre === "documentary",
    requiresImageGeneration: true,
    requiresVideoGeneration: true,
    requiresVoiceGeneration: direction.narrationRequirement !== false || direction.dialogueRequirement === true,
    requiresMusic: grammar.audioBias.music,
    requiresSoundDesign: grammar.audioBias.soundDesign,
    requiresEditing: true,
    estimatedSceneCount,
    estimatedShotCount,
    confidence: direction.confidence,
    rationale: direction.rationale,
  };

  const roleTrace: IntelligenceRoleTrace = {
    role: "creativeDirection",
    routingCategory: "production",
    provider: resolveIntelligenceRoleProvider("creativeDirection"),
  };

  return {
    classification,
    grammar,
    direction,
    creative,
    preferences,
    roleTrace,
    strategy: strategyBundle.strategy,
    preflight: strategyBundle.preflight,
    strategyBundle,
    errors,
  };
}
