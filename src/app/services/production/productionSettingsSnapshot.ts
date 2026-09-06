/**
 * Immutable production settings snapshot.
 *
 * Captured once at production creation so later generation cannot silently
 * rebind to live / mutated Spark settings.
 */

import type {
  AspectMode,
  Brand,
  Character,
  ContentFormat,
  GenerationCreditSettings,
  MemoryItem,
  Production,
  ProductionBrief,
  ProductionFormatSettings,
  ViralSpark,
} from "../../domain/types";
import {
  DEFAULT_CREDIT_SETTINGS,
  DEFAULT_FORMAT_SETTINGS,
  getEffectiveCreditSettings,
  getEffectiveFormatSettings,
} from "../../domain/types";
import {
  normalizeModeString,
  resolveProductionMode,
  type ResolvedMode,
} from "./resolveProductionMode";

export const PRODUCTION_SETTINGS_SNAPSHOT_VERSION = 1 as const;

export interface ProductionSettingsSnapshot {
  version: typeof PRODUCTION_SETTINGS_SNAPSHOT_VERSION;
  capturedAt: string;
  /** Flat convenience fields for resolvers / debug */
  productionMode: ResolvedMode;
  contentFormat: ContentFormat;
  brand: {
    id?: string;
    name: string;
    niche: string;
    archetype: string;
    purpose: string;
    country?: string;
    language?: string;
  };
  content: {
    contentFormat: ContentFormat;
    productionMode: ResolvedMode;
    aspectMode: AspectMode;
    targetDurationSec: number;
    automationMode?: string;
  };
  video: {
    preferredVideoProvider?: string;
    preferredVideoModel?: string;
    shortsDurationSec: number;
    cinematicDurationSec: number;
    maxVideoClips: number;
    keyframeCount: number;
  };
  character: {
    primaryCharacterId?: string;
    primaryCharacterName?: string;
    characterSheetUrl?: string;
    hasLockedCharacterSheet: boolean;
  };
  voice: {
    voiceProvider?: string;
    voiceId?: string;
    voiceName?: string;
  };
  creative: {
    tones: string[];
    deliveryStyles: string[];
    contentPillars: Array<{ label: string; active: boolean }>;
    activeContentPillarCount: number;
    audience?: string;
    painPoints: string[];
    desires: string[];
  };
  intelligence: {
    researchContextPresent: boolean;
    memoryRuleCount: number;
    /** Deduped memory fingerprints — duplicates do not raise importance */
    memoryFingerprints: string[];
  };
  formatSettings: ProductionFormatSettings;
  creditSettings: GenerationCreditSettings;
}

export function isCinematicMode(mode?: string | null): boolean {
  const n = normalizeModeString(mode);
  if (n === "deep") return true;
  const raw = String(mode || "").toLowerCase();
  return raw.includes("cinematic") || raw.includes("deep");
}

export function isNarratorMode(mode?: string | null): boolean {
  const n = normalizeModeString(mode);
  if (n === "express") return true;
  const raw = String(mode || "").toLowerCase();
  return (
    raw.includes("narrator") ||
    raw.includes("express") ||
    raw.includes("slideshow")
  );
}

function fingerprintMemory(item: MemoryItem | any): string {
  const text = String(item?.text || item?.content || item?.rule || item?.title || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  return text.slice(0, 240);
}

function dedupeMemoryItems(items: MemoryItem[] | undefined): {
  count: number;
  fingerprints: string[];
} {
  const seen = new Set<string>();
  const fingerprints: string[] = [];
  for (const item of items || []) {
    const fp = fingerprintMemory(item);
    if (!fp || seen.has(fp)) continue;
    seen.add(fp);
    fingerprints.push(fp);
  }
  return { count: fingerprints.length, fingerprints };
}

export function buildProductionSettingsSnapshot(params: {
  brand: Brand;
  spark?: ViralSpark | null;
  character?: Character | null;
  characters?: Character[];
  memoryItems?: MemoryItem[];
  formatSettings?: ProductionFormatSettings;
  creditSettings?: GenerationCreditSettings;
  productionMode?: string | ResolvedMode;
  automationMode?: string;
  capturedAt?: string;
}): ProductionSettingsSnapshot {
  const { brand, spark } = params;
  const formatSettings = getEffectiveFormatSettings({
    formatSettings: params.formatSettings || brand.formatSettings,
    brand,
  });
  const creditSettings = getEffectiveCreditSettings({
    creditSettings: params.creditSettings || brand.creditSettings,
    brand,
  });
  const productionMode =
    normalizeModeString(params.productionMode as string) ||
    resolveProductionMode({
      spark: spark || undefined,
      brand,
      modeOverride: params.productionMode as string,
    });

  const primaryCharacter = params.character || params.characters?.[0] || undefined;
  const characterSheetUrl =
    primaryCharacter?.characterSheetUrl ||
    primaryCharacter?.imageUrl ||
    primaryCharacter?.avatarUrl ||
    undefined;

  const pillars = brand.contentPillars || [];
  const activePillars = pillars.filter((p) => p.active !== false);
  const memory = dedupeMemoryItems(params.memoryItems);

  const contentFormat =
    (formatSettings.contentFormat as ContentFormat) ||
    (DEFAULT_FORMAT_SETTINGS.contentFormat as ContentFormat) ||
    "host";

  return {
    version: PRODUCTION_SETTINGS_SNAPSHOT_VERSION,
    capturedAt: params.capturedAt || new Date().toISOString(),
    productionMode,
    contentFormat,
    brand: {
      id: brand.id,
      name: brand.name,
      niche: brand.niche,
      archetype: brand.archetype,
      purpose: brand.purpose,
      country: brand.country,
      language: brand.language,
    },
    content: {
      contentFormat,
      productionMode,
      aspectMode: formatSettings.aspectMode,
      targetDurationSec: formatSettings.targetDurationSec,
      automationMode: params.automationMode || brand.automation_mode,
    },
    video: {
      preferredVideoProvider: formatSettings.preferredVideoProvider,
      preferredVideoModel: formatSettings.preferredVideoModel,
      shortsDurationSec: creditSettings.shortsDurationSec,
      cinematicDurationSec: creditSettings.cinematicDurationSec,
      maxVideoClips: creditSettings.maxVideoClips ?? creditSettings.keyframeCount,
      keyframeCount: creditSettings.keyframeCount,
    },
    character: {
      primaryCharacterId: primaryCharacter?.id,
      primaryCharacterName: primaryCharacter?.name,
      characterSheetUrl: characterSheetUrl || undefined,
      hasLockedCharacterSheet: Boolean(characterSheetUrl),
    },
    voice: {
      voiceProvider: "elevenlabs",
      voiceId: primaryCharacter?.voice?.voiceId,
      voiceName: primaryCharacter?.voice?.name,
    },
    creative: {
      tones: (brand.tone || []).filter((t) => t.active !== false).map((t) => t.label),
      deliveryStyles: (brand.style || []).filter((s) => s.active !== false).map((s) => s.label),
      contentPillars: pillars.map((p) => ({ label: p.label, active: p.active })),
      activeContentPillarCount: activePillars.length,
      audience: brand.audience?.primary,
      painPoints: [...(brand.audience?.painPoints || [])],
      desires: [...(brand.audience?.desires || [])],
    },
    intelligence: {
      researchContextPresent: Boolean(
        spark?.researchContext ||
          (brand as any).researchContext ||
          ((brand as any).researchCache &&
            Object.keys((brand as any).researchCache || {}).length > 0)
      ),
      memoryRuleCount: memory.count,
      memoryFingerprints: memory.fingerprints,
    },
    formatSettings: { ...DEFAULT_FORMAT_SETTINGS, ...formatSettings },
    creditSettings: { ...DEFAULT_CREDIT_SETTINGS, ...creditSettings },
  };
}

export function readProductionSettingsSnapshot(
  production?: Production | null,
  brief?: ProductionBrief | null,
): ProductionSettingsSnapshot | null {
  const raw =
    (production as any)?.settingsSnapshot ||
    (production as any)?.productionSettingsSnapshot ||
    (brief as any)?.settingsSnapshot ||
    (brief as any)?.productionSettingsSnapshot ||
    null;
  if (!raw || typeof raw !== "object") return null;
  if (raw.version !== PRODUCTION_SETTINGS_SNAPSHOT_VERSION) return null;
  if (!raw.formatSettings || !raw.content) return null;
  return raw as ProductionSettingsSnapshot;
}

export function attachProductionSettingsSnapshot(
  production: Production,
  snapshot: ProductionSettingsSnapshot,
): Production {
  const nextBrief: ProductionBrief = {
    ...(production.brief || ({} as ProductionBrief)),
    formatSettings: snapshot.formatSettings,
    targetDurationSec: snapshot.content.targetDurationSec,
    productionMode: snapshot.content.productionMode,
  };
  (nextBrief as any).settingsSnapshot = snapshot;
  return {
    ...production,
    mode: snapshot.content.productionMode as Production["mode"],
    productionMode: snapshot.content.productionMode,
    targetDurationSec: snapshot.content.targetDurationSec,
    formatSettings: snapshot.formatSettings,
    brief: nextBrief,
    ...({ settingsSnapshot: snapshot } as any),
  };
}

/**
 * Prefer the immutable snapshot for generation. Fall back to live brand only
 * when no snapshot exists (legacy productions).
 */
export function resolveGenerationSettings(params: {
  production?: Production | null;
  brief?: ProductionBrief | null;
  brand?: Brand | null;
  formatSettings?: ProductionFormatSettings | null;
  creditSettings?: GenerationCreditSettings | null;
  spark?: ViralSpark | null;
}): {
  formatSettings: ProductionFormatSettings;
  creditSettings: GenerationCreditSettings;
  productionMode: ResolvedMode;
  preferredVideoProvider?: string;
  preferredVideoModel?: string;
  snapshot: ProductionSettingsSnapshot | null;
  source: "snapshot" | "live";
} {
  const snapshot = readProductionSettingsSnapshot(params.production, params.brief);
  if (snapshot) {
    return {
      formatSettings: snapshot.formatSettings,
      creditSettings: snapshot.creditSettings,
      productionMode: snapshot.content.productionMode,
      preferredVideoProvider: snapshot.video.preferredVideoProvider,
      preferredVideoModel: snapshot.video.preferredVideoModel,
      snapshot,
      source: "snapshot",
    };
  }

  const formatSettings = getEffectiveFormatSettings({
    formatSettings:
      params.formatSettings ||
      params.brief?.formatSettings ||
      params.production?.formatSettings ||
      params.brand?.formatSettings,
    brand: params.brand,
  });
  const creditSettings = getEffectiveCreditSettings({
    creditSettings: params.creditSettings || params.brand?.creditSettings,
    brand: params.brand,
  });
  const productionMode = resolveProductionMode({
    production: params.production || undefined,
    brief: params.brief || undefined,
    spark: params.spark || undefined,
    brand: params.brand || undefined,
  });

  return {
    formatSettings: { ...DEFAULT_FORMAT_SETTINGS, ...formatSettings },
    creditSettings: { ...DEFAULT_CREDIT_SETTINGS, ...creditSettings },
    productionMode,
    preferredVideoProvider: formatSettings.preferredVideoProvider,
    preferredVideoModel: formatSettings.preferredVideoModel,
    snapshot: null,
    source: "live",
  };
}

/** Compact debug / traceability object for a production. */
export function buildProductionTraceability(params: {
  production?: Production | null;
  brief?: ProductionBrief | null;
  review?: any;
  media?: {
    canonicalMasterUrl?: string;
    sceneClipUrls?: string[];
    lineageSource?: string;
  };
}): Record<string, unknown> {
  const snapshot = readProductionSettingsSnapshot(params.production, params.brief);
  const production = params.production;
  const brief = params.brief || production?.brief;
  return {
    productionId: production?.id || null,
    settingsSource: snapshot ? "snapshot" : "live_or_missing",
    capturedAt: snapshot?.capturedAt || null,
    brandName: snapshot?.brand.name || null,
    contentFormat: snapshot?.contentFormat || brief?.formatSettings?.contentFormat || null,
    productionMode: snapshot?.productionMode || production?.mode || brief?.productionMode || null,
    preferredVideoProvider:
      snapshot?.video.preferredVideoProvider ||
      brief?.formatSettings?.preferredVideoProvider ||
      null,
    preferredVideoModel:
      snapshot?.video.preferredVideoModel ||
      brief?.formatSettings?.preferredVideoModel ||
      null,
    targetDurationSec:
      snapshot?.content.targetDurationSec ||
      production?.targetDurationSec ||
      brief?.targetDurationSec ||
      null,
    character: snapshot?.character || null,
    voice: snapshot?.voice || null,
    activeContentPillarCount: snapshot?.creative.activeContentPillarCount ?? null,
    researchContextPresent: snapshot?.intelligence.researchContextPresent ?? null,
    memoryRuleCount: snapshot?.intelligence.memoryRuleCount ?? null,
    canonicalMasterUrl: params.media?.canonicalMasterUrl || null,
    sceneClipCount: params.media?.sceneClipUrls?.length ?? null,
    reviewVideoUrl: params.review?.videoUrl || null,
    lineageSource: params.media?.lineageSource || null,
  };
}
