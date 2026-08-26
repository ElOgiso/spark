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
 * Locked Priority:
 * 1) Explicit modeOverride (state.productionMode) if valid
 * 2) production.mode if valid
 * 3) brand.productionMode if valid
 * 4) brief.productionMode if valid
 * 5) spark.suggestedMode / spark.suggestedProductionMode ONLY if 1–4 empty
 * 6) Fallback: "standard"
 */
export function resolveProductionMode(params: ModeResolutionParams): ResolvedMode {
  const { modeOverride, production, brief, spark, brand } = params;

  const fromOverride = normalizeModeString(modeOverride);
  if (fromOverride) return fromOverride;

  const fromProd = normalizeModeString(production?.mode);
  if (fromProd) return fromProd;

  const fromBrand = normalizeModeString(brand?.productionMode as any);
  if (fromBrand) return fromBrand;

  const fromBrief = normalizeModeString(brief?.productionMode);
  if (fromBrief) return fromBrief;

  const fromSpark =
    normalizeModeString(spark?.suggestedMode) ||
    normalizeModeString(spark?.suggestedProductionMode);
  if (fromSpark) return fromSpark;

  return "standard";
}
