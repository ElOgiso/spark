import type { ComposedGrammar, ProductionGrammar } from "./types";
import { narrativeFilmGrammar } from "./narrativeFilm";
import { documentaryGrammar } from "./documentary";
import { advertisementGrammar } from "./advertisement";
import { musicVideoGrammar } from "./musicVideo";
import { socialGrammar } from "./social";
import { educationalGrammar } from "./educational";
import { newsExplainerGrammar } from "./newsExplainer";
import { animationGrammar } from "./animation";
import { animeGrammar } from "./anime";
import { productDemoGrammar } from "./productDemo";
import { travelGrammar } from "./travel";
import { sportsGrammar } from "./sports";
import { comedyGrammar } from "./comedy";
import { customGrammar } from "./custom";

export const GRAMMAR_REGISTRY: Record<string, ProductionGrammar> = {
  narrative_film: narrativeFilmGrammar,
  documentary: documentaryGrammar,
  advertisement: advertisementGrammar,
  music_video: musicVideoGrammar,
  social: socialGrammar,
  educational: educationalGrammar,
  news_explainer: newsExplainerGrammar,
  animation: animationGrammar,
  anime: animeGrammar,
  product_demo: productDemoGrammar,
  travel: travelGrammar,
  sports: sportsGrammar,
  comedy: comedyGrammar,
  custom: customGrammar,
};

/**
 * Compose multiple grammars + freeform style tags.
 * Genre is NOT the same as visual style — style tags remain separate.
 */
export function composeGrammars(
  primaryId: string,
  extraIds: string[] = [],
  styleTags: string[] = []
): ComposedGrammar {
  const primary = GRAMMAR_REGISTRY[primaryId] || customGrammar;
  const extras = extraIds
    .map((id) => GRAMMAR_REGISTRY[id])
    .filter(Boolean) as ProductionGrammar[];

  const all = [primary, ...extras];
  const tags = Array.from(new Set([...all.flatMap((g) => g.tags), ...styleTags]));

  return {
    ...primary,
    label: [primary.label, ...extras.map((g) => g.label)].join(" + "),
    description: all.map((g) => g.description).join(" | "),
    narrativeFunctions: Array.from(new Set(all.flatMap((g) => g.narrativeFunctions))),
    coverage: {
      preferredShotTypes: Array.from(new Set(all.flatMap((g) => g.coverage.preferredShotTypes))),
      preferredMovements: Array.from(new Set(all.flatMap((g) => g.coverage.preferredMovements))),
      requireEstablishing: all.some((g) => g.coverage.requireEstablishing),
      requireInserts: all.some((g) => g.coverage.requireInserts),
      dialogueCoverage: all.some((g) => g.coverage.dialogueCoverage),
      brollDensity: all.some((g) => g.coverage.brollDensity === "high")
        ? "high"
        : all.some((g) => g.coverage.brollDensity === "medium")
          ? "medium"
          : primary.coverage.brollDensity,
    },
    audioBias: {
      narration: all.some((g) => g.audioBias.narration),
      dialogue: all.some((g) => g.audioBias.dialogue),
      music: all.some((g) => g.audioBias.music),
      soundDesign: all.some((g) => g.audioBias.soundDesign),
    },
    pacingBias:
      tags.includes("short-form") || tags.includes("vertical") ? "compressed" : primary.pacingBias,
    visualNotes: Array.from(new Set(all.flatMap((g) => g.visualNotes))),
    editorialNotes: Array.from(new Set(all.flatMap((g) => g.editorialNotes))),
    tags,
    sources: [primary.id, ...extras.map((g) => g.id)],
  };
}
