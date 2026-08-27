import type { Brand, Character, Production, ProductionBrief } from "../../domain/types";

export type EffectiveContentFormat = "faceless" | "host" | "story" | "anime";

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
 * Validates whether the character has a real, usable character sheet URL.
 * - HTTP(S), data:image, or blob URL counts as valid.
 * - Empty initials or missing URL = no sheet.
 * - Portrait (imageUrl or avatarUrl) is accepted as a weak sheet (logs "weak sheet — prefer turnaround").
 */
export function hasValidCharacterSheet(character?: Partial<Character> | null): {
  hasSheet: boolean;
  sheetUrl?: string;
  isWeak: boolean;
} {
  if (!character) return { hasSheet: false, isWeak: false };

  const isHttpOrData = (url?: string | null): boolean => {
    if (!url || typeof url !== "string") return false;
    const clean = url.trim();
    if (!clean) return false;
    if (
      clean.startsWith("initials://") ||
      clean.startsWith("avatar://") ||
      clean === "null" ||
      clean === "undefined"
    ) {
      return false;
    }
    return (
      clean.startsWith("http://") ||
      clean.startsWith("https://") ||
      clean.startsWith("data:image/") ||
      clean.startsWith("blob:")
    );
  };

  // 1. Direct character sheet
  const directSheet = character.characterSheetUrl;
  if (isHttpOrData(directSheet)) {
    return { hasSheet: true, sheetUrl: directSheet!, isWeak: false };
  }

  // 2. Sheet image URLs array
  const sheetList = (character as any).sheet_image_urls;
  if (Array.isArray(sheetList)) {
    for (const u of sheetList) {
      if (isHttpOrData(u)) {
        return { hasSheet: true, sheetUrl: u, isWeak: false };
      }
    }
  }

  // 3. Portrait image (weak sheet)
  const imgUrl = character.imageUrl;
  if (isHttpOrData(imgUrl)) {
    console.log("[CharacterSheetGate] weak sheet — prefer turnaround:", imgUrl);
    return { hasSheet: true, sheetUrl: imgUrl!, isWeak: true };
  }

  // 4. Avatar URL (weak sheet)
  const avatarUrl = character.avatarUrl;
  if (isHttpOrData(avatarUrl)) {
    console.log("[CharacterSheetGate] weak sheet — prefer turnaround:", avatarUrl);
    return { hasSheet: true, sheetUrl: avatarUrl!, isWeak: true };
  }

  return { hasSheet: false, isWeak: false };
}

/**
 * Gate check before starting asset generation.
 * - faceless: sheet optional, generate proceeds.
 * - host | story | anime: requires a real character sheet URL. If missing, returns allowed: false with reason.
 */
export function canStartAssetGeneration(params: {
  production?: Partial<Production> | null;
  brief?: Partial<ProductionBrief> | null;
  brand?: Partial<Brand> | null;
  character?: Partial<Character> | null;
  formatSettings?: any;
}): { allowed: boolean; reason?: string; contentFormat: EffectiveContentFormat } {
  const contentFormat = getEffectiveContentFormat(params);

  // Faceless format: character sheet is optional; generate proceeds
  if (contentFormat === "faceless") {
    return { allowed: true, contentFormat };
  }

  // host | story | anime: character sheet is required
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
