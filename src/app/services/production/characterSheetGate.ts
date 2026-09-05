import type { Brand, Character, Production, ProductionBrief } from "../../domain/types";
import type { ProductionAssetRegistry } from "./assets/registry";
import { hasValidCharacterIdentityAnchor as identityAnchorFromAssets } from "./assets/characterIdentity";
import { hasValidCharacterSheet } from "./characterSheetValidation";

export type EffectiveContentFormat = "faceless" | "host" | "story" | "anime";

export { hasValidCharacterSheet };

/**
 * Determines the effective content format for the production:
 * - "faceless": Sheet optional (slideshows, B-roll, stock, voiceover-only, infographics, etc.)
 * - "host": Requires locked character reference sheet (host/presenter/creator)
 * - "story": Requires locked character reference sheet (story-film/narrative/cinematic)
 * - "anime": Requires locked character reference sheet (anime/stylized)
 */
export function getEffectiveContentFormat(params: {
  production?: Partial<Production> | null;
  brief?: Partial<ProductionBrief> | null;
  brand?: Partial<Brand> | null;
  character?: Partial<Character> | null;
  formatSettings?: any;
}): EffectiveContentFormat {
  const { production, brief, brand, character, formatSettings } = params;

  // 1. Explicit formatSettings contentFormat or archetype
  const explicitFormat = (
    (production as any)?.formatSettings?.contentFormat ||
    (brief as any)?.formatSettings?.contentFormat ||
    (brand as any)?.formatSettings?.contentFormat ||
    (brand as any)?.settings?.contentFormat ||
    (brand as any)?.contentFormat ||
    formatSettings?.contentFormat ||
    (production as any)?.contentFormat ||
    (brief as any)?.contentFormat
  )?.toString().toLowerCase().trim();

  if (explicitFormat) {
    if (
      explicitFormat.includes("faceless") ||
      explicitFormat.includes("slideshow") ||
      explicitFormat.includes("voiceover")
    ) {
      return "faceless";
    }
    if (
      explicitFormat.includes("anime") ||
      explicitFormat.includes("manga") ||
      explicitFormat.includes("animation")
    ) {
      return "anime";
    }
    if (
      explicitFormat.includes("story") ||
      explicitFormat.includes("film") ||
      explicitFormat.includes("narrative")
    ) {
      return "story";
    }
    if (
      explicitFormat.includes("host") ||
      explicitFormat.includes("creator") ||
      explicitFormat.includes("presenter")
    ) {
      return "host";
    }
  }

  // 2. Infer from production mode, platform fit, visual directions, and style tags
  const combinedStrings = [
    production?.mode,
    brief?.productionMode,
    brand?.productionMode,
    brand?.archetype,
    brand?.niche,
    character?.style,
    brief?.visualDirection,
    (production?.formats || []).join(" "),
  ]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase())
    .join(" ");

  if (
    combinedStrings.includes("faceless") ||
    combinedStrings.includes("no-host") ||
    combinedStrings.includes("voiceover-only") ||
    combinedStrings.includes("b-roll") ||
    combinedStrings.includes("stock-only") ||
    combinedStrings.includes("infographic")
  ) {
    return "faceless";
  }

  if (
    combinedStrings.includes("anime") ||
    combinedStrings.includes("manga") ||
    combinedStrings.includes("animated")
  ) {
    return "anime";
  }

  if (
    combinedStrings.includes("story") ||
    combinedStrings.includes("story-film") ||
    combinedStrings.includes("cinematic") ||
    combinedStrings.includes("short-film") ||
    combinedStrings.includes("drama") ||
    combinedStrings.includes("narrative")
  ) {
    return "story";
  }

  // Default format is "host"
  return "host";
}

/**
 * Phase 4 identity anchor — thin wrapper over assets/characterIdentity.
 * Prefer registry canonical/approved character refs when registry is provided;
 * otherwise fall back to URL sheet validation.
 */
export function hasValidCharacterIdentityAnchor(params: {
  character?: Partial<Character> | null;
  registry?: ProductionAssetRegistry;
  productionId?: string;
  entityId?: string;
}): {
  valid: boolean;
  reason?: string;
  assetId?: string;
  isWeak?: boolean;
  authority?: string;
  sheetUrl?: string;
} {
  return identityAnchorFromAssets(params);
}

/**
 * Gate check before starting asset generation.
 * - faceless: sheet optional, generate proceeds.
 * - host | story | anime: requires a real character identity anchor (registry) or sheet URL.
 * Optional registry/productionId/entityId enable Phase 4 identity-anchor checks;
 * URL fallback remains for backward compatibility.
 */
export function canStartAssetGeneration(params: {
  production?: Partial<Production> | null;
  brief?: Partial<ProductionBrief> | null;
  brand?: Partial<Brand> | null;
  character?: Partial<Character> | null;
  formatSettings?: any;
  registry?: ProductionAssetRegistry;
  productionId?: string;
  entityId?: string;
}): { allowed: boolean; reason?: string; contentFormat: EffectiveContentFormat } {
  const contentFormat = getEffectiveContentFormat(params);

  // Faceless format: character sheet is optional; generate proceeds
  if (contentFormat === "faceless") {
    return { allowed: true, contentFormat };
  }

  // host | story | anime: identity anchor or character sheet required
  if (params.registry && (params.productionId || params.production?.id)) {
    const anchor = hasValidCharacterIdentityAnchor({
      character: params.character,
      registry: params.registry,
      productionId: params.productionId || params.production?.id,
      entityId: params.entityId || params.character?.id,
    });
    if (!anchor.valid) {
      return {
        allowed: false,
        reason: anchor.reason || "Add a character sheet in My Spark or Onboard first.",
        contentFormat,
      };
    }
    return { allowed: true, contentFormat };
  }

  const { hasSheet } = hasValidCharacterSheet(params.character);
  if (!hasSheet) {
    return {
      allowed: false,
      reason: "Add a character sheet in My Spark or Onboard first.",
      contentFormat,
    };
  }

  return { allowed: true, contentFormat };
}
