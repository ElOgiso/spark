import type {
  Brand,
  Character,
  MemoryItem,
  ProductionMode,
  ProductionFormatSettings,
} from "../../domain/types";
import { buildRankedBrandLaws } from "./rankBrandLaws";

export interface SeriesBible {
  brandId: string;
  brandName: string;
  character?: Character;
  characterSheetUrls: string[];
  defaultVoice?: {
    voiceId?: string;
    name: string;
    language: string;
    tone: string;
    locked: boolean;
  };
  productionMode: ProductionMode;
  pacingLaws: string[];
  formatLaws: string[];
  neverLaws: string[];
  alwaysLaws: string[];
  rankedSeriesLawsBlock: string;
}

/**
 * Resolves the persistent "Series Bible" for a brand so episode N matches episode 1:
 * - Locked character sheet & identity visuals
 * - Locked default ElevenLabs brand voice
 * - Locked pacing, hook, and format rules from pinned Brand Memory
 * - Production mode & format settings
 */
export function resolveSeriesBible(params: {
  brand?: Brand;
  brandId?: string;
  character?: Character;
  characters?: Character[];
  memoryItems?: MemoryItem[];
  formatSettings?: ProductionFormatSettings;
}): SeriesBible {
  const {
    brand,
    brandId = (brand as any)?.id || "default-brand",
    character: directChar,
    characters = [],
    memoryItems = [],
    formatSettings = brand?.formatSettings,
  } = params;

  // 1. Resolve Primary Character & Character Sheet URLs
  const primaryChar =
    directChar ||
    characters.find((c: any) => c.brandId === brandId || c.is_default) ||
    characters[0] ||
    undefined;

  const characterSheetUrls: string[] = [];
  if (primaryChar) {
    if (primaryChar.characterSheetUrl) characterSheetUrls.push(primaryChar.characterSheetUrl);
    const sheetList = (primaryChar as any).sheet_image_urls;
    if (Array.isArray(sheetList)) {
      for (const url of sheetList) {
        if (url && !characterSheetUrls.includes(url)) characterSheetUrls.push(url);
      }
    }
    if (primaryChar.imageUrl && !characterSheetUrls.includes(primaryChar.imageUrl)) {
      characterSheetUrls.push(primaryChar.imageUrl);
    }
  }

  // 2. Resolve Default Brand Voice
  let defaultVoice = primaryChar?.voice;
  if (!defaultVoice && (brand as any)?.voice) {
    defaultVoice = (brand as any).voice;
  }

  // 3. Resolve Production Mode Preference
  const rawMode = (brand?.productionMode || (formatSettings as any)?.productionMode || "standard").toLowerCase();
  const productionMode: ProductionMode =
    rawMode === "deep" || rawMode === "cinematic"
      ? "deep"
      : rawMode === "express" || rawMode === "narrator"
      ? "express"
      : "standard";

  // 4. Extract Pacing, Format, Never, and Always Laws from Memory
  const pacingLaws: string[] = [];
  const formatLaws: string[] = [];
  const neverLaws: string[] = [];
  const alwaysLaws: string[] = [];

  for (const m of memoryItems) {
    const text = m.text.trim();
    const cat = (m.category || "").toLowerCase();

    if (cat === "pacing" || cat === "hook" || /hook|pacing|timing|second/i.test(text)) {
      pacingLaws.push(text);
    }
    if (cat === "format" || cat === "structure" || /format|layout|aspect|overlay/i.test(text)) {
      formatLaws.push(text);
    }
    if (m.type === "rule" || m.pinned) {
      if (/^(never|forbid|prohibit|do not|no )/i.test(text)) {
        neverLaws.push(text);
      } else {
        alwaysLaws.push(text);
      }
    }
  }

  // 5. Build Unified Ranked Series Laws Block
  const rankedLaws = buildRankedBrandLaws(memoryItems);
  const rankedSeriesLawsBlock = rankedLaws.lawsBlock;

  return {
    brandId,
    brandName: brand?.name || "Brand",
    character: primaryChar,
    characterSheetUrls,
    defaultVoice,
    productionMode,
    pacingLaws,
    formatLaws,
    neverLaws,
    alwaysLaws,
    rankedSeriesLawsBlock,
  };
}
