import type { Character } from "../../domain/types";

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

  const directSheet = character.characterSheetUrl;
  if (isHttpOrData(directSheet)) {
    return { hasSheet: true, sheetUrl: directSheet!, isWeak: false };
  }

  const sheetList = (character as any).sheet_image_urls;
  if (Array.isArray(sheetList)) {
    for (const u of sheetList) {
      if (isHttpOrData(u)) {
        return { hasSheet: true, sheetUrl: u, isWeak: false };
      }
    }
  }

  const imgUrl = character.imageUrl;
  if (isHttpOrData(imgUrl)) {
    console.log("[CharacterSheetGate] weak sheet — prefer turnaround:", imgUrl);
    return { hasSheet: true, sheetUrl: imgUrl!, isWeak: true };
  }

  const avatarUrl = character.avatarUrl;
  if (isHttpOrData(avatarUrl)) {
    console.log("[CharacterSheetGate] weak sheet — prefer turnaround:", avatarUrl);
    return { hasSheet: true, sheetUrl: avatarUrl!, isWeak: true };
  }

  return { hasSheet: false, isWeak: false };
}
