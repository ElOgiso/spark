import type { ProductionFormatSettings } from "../../domain/types";
import type { ProductionBrief } from "../../domain/types";
import type { StoryboardScene } from "../../domain/types";
import { getEffectiveContentFormat } from "./characterSheetGate";
import { resolveLiveVisualGenre } from "./visualGenreDirectives";

export interface ProductionLookLaw {
  contentFormat: string;
  visualGenre: string;
}

export interface BuildProductionLookLawParams {
  production: any;
  brief: ProductionBrief;
  formatSettings: ProductionFormatSettings;
  brand?: any;
}

export function buildProductionLookLaw(params: BuildProductionLookLawParams): ProductionLookLaw {
  const contentFormat = getEffectiveContentFormat({
    brand: params.brand,
    formatSettings: params.formatSettings,
    production: params.production,
    brief: params.brief,
  });

  const visualGenre = resolveLiveVisualGenre({
    production: params.production,
    brief: params.brief,
    formatSettings: params.formatSettings,
  });

  return {
    contentFormat,
    visualGenre,
  };
}

export function assertLookLawInPrompt(prompt: string, lookLaw: ProductionLookLaw) {
  // Ensure we don't accidentally drop format/genre directives downstream
  if (!prompt.includes("CONTENT FORMAT:")) {
    console.warn("[LookLaw] Missing CONTENT FORMAT: directive in prompt");
  }
  if (!prompt.includes("VISUAL GENRE:")) {
    console.warn("[LookLaw] Missing VISUAL GENRE: directive in prompt");
  }
}
