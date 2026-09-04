/**
 * Creative Director — infers production intent from raw idea without user cinematography knowledge.
 */

import { classifyCreativeIntent, type GenreClassification } from "./genreClassifier";
import { composeGrammars, type ComposedGrammar } from "../grammar";
import type { CreativeSpec, ContentGenreId, PlatformId, AspectRatioId, CreativeControlMode } from "../specification/productionSpec";

export interface CreativeDirectorInput {
  idea: string;
  creativeControl?: CreativeControlMode;
  preferredPlatforms?: PlatformId[];
  preferredAspectRatio?: AspectRatioId;
  targetDurationSec?: number;
  hasHostCharacter?: boolean;
  brandNiche?: string;
}

export interface CreativeDirectorResult {
  classification: GenreClassification;
  grammar: ComposedGrammar;
  creative: CreativeSpec;
}

export function directCreativeIntent(input: CreativeDirectorInput): CreativeDirectorResult {
  const classification = classifyCreativeIntent(input.idea, {
    preferredPlatforms: input.preferredPlatforms,
    preferredAspectRatio: input.preferredAspectRatio,
    targetDurationSec: input.targetDurationSec,
  });

  const grammar = composeGrammars(
    classification.primaryGenre,
    classification.secondaryGenres,
    classification.styleTags
  );

  const duration = classification.durationHintSec || input.targetDurationSec || 60;
  const maxClip = 8;
  const estimatedSceneCount = Math.max(3, Math.min(24, Math.ceil(duration / maxClip)));
  const shotsPerScene =
    grammar.coverage.requireEstablishing || grammar.coverage.requireInserts
      ? grammar.coverage.brollDensity === "high"
        ? 3
        : 2
      : duration <= 45
        ? 1
        : 2;
  const estimatedShotCount = estimatedSceneCount * shotsPerScene;

  const faceless = classification.styleTags.includes("faceless");
  const talkingHead = classification.styleTags.includes("talking-head") || Boolean(input.hasHostCharacter);

  const creative: CreativeSpec = {
    intent: input.idea.trim(),
    genre: classification.primaryGenre as ContentGenreId,
    grammarTags: Array.from(new Set([...grammar.tags, ...classification.styleTags])),
    subgenre: classification.secondaryGenres[0],
    tone: classification.tone,
    audience: classification.audience,
    narrativeStructure: grammar.narrativeFunctions.slice(0, 6).join(" → "),
    visualLanguage: [grammar.label, ...classification.styleTags].join(" / "),
    pacing: grammar.pacingBias,
    emotionalArc: `${classification.tone} progression to payoff`,
    requiresHost: talkingHead && !faceless,
    requiresCharacters:
      talkingHead ||
      ["narrative_film", "anime", "animation", "comedy"].includes(classification.primaryGenre),
    requiresNarration: grammar.audioBias.narration || faceless || !talkingHead,
    requiresDialogue: grammar.audioBias.dialogue && !faceless,
    requiresAnimation: ["animation", "anime"].includes(classification.primaryGenre),
    requiresProductShots: ["advertisement", "product_demo"].includes(classification.primaryGenre),
    requiresDocumentaryTreatment: classification.primaryGenre === "documentary" || classification.primaryGenre === "news_explainer",
    requiresResearch:
      ["documentary", "news_explainer", "educational"].includes(classification.primaryGenre) ||
      /current|trend|today|202\d/.test(input.idea.toLowerCase()),
    requiresGeneratedEnvironments: true,
    requiresStockOrUserAssets: classification.primaryGenre === "documentary",
    requiresImageGeneration: true,
    requiresVideoGeneration: true,
    requiresVoiceGeneration: grammar.audioBias.narration || grammar.audioBias.dialogue,
    requiresMusic: grammar.audioBias.music,
    requiresSoundDesign: grammar.audioBias.soundDesign,
    requiresEditing: true,
    estimatedSceneCount,
    estimatedShotCount,
    confidence: classification.confidence,
    rationale: [
      ...classification.rationale,
      `Grammar: ${grammar.label}`,
      `Estimated ${estimatedSceneCount} scenes / ${estimatedShotCount} shots for ~${duration}s`,
      input.brandNiche ? `Brand niche context: ${input.brandNiche}` : "",
    ].filter(Boolean),
  };

  return { classification, grammar, creative };
}
