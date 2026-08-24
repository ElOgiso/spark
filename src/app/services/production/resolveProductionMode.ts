import type { Production, ProductionBrief, ViralSpark, Brand } from "../../domain/types";

export type ResolvedMode = "express" | "standard" | "deep";

/**
 * Normalizes any legacy mode string ("narrator", "slideshow", "hybrid", "cinematic", etc.)
 * into one of the three canonical 2026 production modes: "express" | "standard" | "deep".
 */
export function normalizeModeString(rawMode?: string | null): ResolvedMode | undefined {
  if (!rawMode || typeof rawMode !== "string") return undefined;
  const clean = rawMode.trim().toLowerCase();

  if (
    clean.includes("express") ||
    clean.includes("narrator") ||
    clean.includes("slideshow") ||
    clean.includes("vo") ||
    clean.includes("faceless")
  ) {
    return "express";
  }
  if (
    clean.includes("deep") ||
    clean.includes("cinematic") ||
    clean.includes("one-take") ||
    clean.includes("filmic") ||
    clean.includes("story-film")
  ) {
    return "deep";
  }
  if (
    clean.includes("standard") ||
    clean.includes("hybrid") ||
    clean.includes("host") ||
    clean.includes("talking-head")
  ) {
    return "standard";
  }
  return undefined;
}

export interface ModeResolutionParams {
  modeOverride?: string;
  production?: Production;
  brief?: ProductionBrief;
  spark?: ViralSpark;
  brand?: Brand;
}

/**
 * Single Source of Mode Truth.
 * Priority:
 * 1) Explicit modeOverride
 * 2) production.mode
 * 3) brief.productionMode
 * 4) spark.suggestedMode / spark.suggestedProductionMode
 * 5) brand.productionMode
 * 6) Fallback: "standard"
 */
export function resolveProductionMode(params: ModeResolutionParams): ResolvedMode {
  const { modeOverride, production, brief, spark, brand } = params;

  const fromOverride = normalizeModeString(modeOverride);
  if (fromOverride) return fromOverride;

  const fromProd = normalizeModeString(production?.mode);
  if (fromProd) return fromProd;

  const fromBrief = normalizeModeString(brief?.productionMode);
  if (fromBrief) return fromBrief;

  const fromSpark =
    normalizeModeString(spark?.suggestedMode) ||
    normalizeModeString(spark?.suggestedProductionMode);
  if (fromSpark) return fromSpark;

  const fromBrand = normalizeModeString(brand?.productionMode as any);
  if (fromBrand) return fromBrand;

  return "standard";
}
