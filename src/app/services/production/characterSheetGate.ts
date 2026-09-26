import type { Brand, Character, Production, ProductionBrief } from "../../domain/types";
import type { ProductionAssetRegistry } from "./assets/registry";
import { hasValidCharacterIdentityAnchor as identityAnchorFromAssets } from "./assets/characterIdentity";
import { hasValidCharacterSheet } from "./characterSheetValidation";

export type EffectiveContentFormat = "faceless" | "host" | "story" | "ugc" | "ads" | "explainer" | "anime";

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
    if (explicitFormat === "ugc" || explicitFormat.includes("selfie")) {
      return "ugc";
    }
    if (explicitFormat === "ads" || explicitFormat.includes("advert")) {
      return "ads";
    }
    if (explicitFormat.includes("explain")) {
      return "explainer";
    }
    if (
      explicitFormat.includes("anime") ||
      explicitFormat.includes("manga")
    ) {
      // Anime is a look, not a production format. Gate it as story (needs identity).
      return "story";
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
    return "story";
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

  return "host";
}

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

  if (contentFormat === "faceless") {
    return { allowed: true, contentFormat };
  }

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
