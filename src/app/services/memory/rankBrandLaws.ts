import type { MemoryItem } from "../../domain/types";

export interface RankedBrandLawsResult {
  lawsBlock: string;
  hardLaws: string[];
  softLaws: string[];
  used: MemoryItem[];
  droppedCount: number;
}

export const MAX_BRAND_LAWS = 12;

const CATEGORY_PRIORITY: Record<string, number> = {
  brand: 1,
  legal: 1,
  claims: 1,
  never: 1,
  always: 1,
  "winning hooks": 2,
  hook: 2,
  strategy: 3,
  "audience preferences": 4,
  audience: 4,
  visual: 5,
  voice: 6,
  character: 7,
  audio: 8,
  failures: 9,
  "publishing behavior": 10,
};

function getCategoryWeight(category?: string): number {
  if (!category) return 99;
  const key = category.trim().toLowerCase();
  return CATEGORY_PRIORITY[key] ?? 50;
}

function getTimestamp(item: MemoryItem): number {
  const tsStr = (item as any).updatedAt || item.lastSeenAt || item.dateAdded || (item as any).createdAt || (item as any).firstSeenAt;
  if (!tsStr) return 0;
  const parsed = Date.parse(tsStr);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Shared helper to rank, cap, deduplicate, and format brand memory items into strict executive laws.
 */
export function buildRankedBrandLaws(
  memoryItems: MemoryItem[] = [],
  maxLaws: number = MAX_BRAND_LAWS
): RankedBrandLawsResult {
  if (!memoryItems || memoryItems.length === 0) {
    return {
      lawsBlock: "- [BRAND LAW] ALWAYS: Maintain sharp executive authority, high-contrast framing, and zero filler words.",
      hardLaws: ["Maintain sharp executive authority, high-contrast framing, and zero filler words."],
      softLaws: [],
      used: [],
      droppedCount: 0,
    };
  }

  // 1. Deduplicate by fingerprint or normalized text
  const seenMap = new Set<string>();
  const uniqueItems: MemoryItem[] = [];

  for (const item of memoryItems) {
    if (!item || !item.text) continue;
    const normText = item.text.trim().toLowerCase();
    const key = item.fingerprint || normText;
    if (!seenMap.has(key)) {
      seenMap.add(key);
      uniqueItems.push(item);
    }
  }

  // 2. Priority Sort: Pinned -> Type (rule > learned) -> Category Weight -> Recency
  const sorted = [...uniqueItems].sort((a, b) => {
    // Pinned rules always top
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;

    // Hard rules over soft learned insights
    if (a.type === "rule" && b.type !== "rule") return -1;
    if (a.type !== "rule" && b.type === "rule") return 1;

    // Category constraints
    const weightA = getCategoryWeight(a.category);
    const weightB = getCategoryWeight(b.category);
    if (weightA !== weightB) return weightA - weightB;

    // Recency tie breaker
    return getTimestamp(b) - getTimestamp(a);
  });

  const used = sorted.slice(0, maxLaws);
  const droppedCount = Math.max(0, sorted.length - maxLaws);

  const hardLaws: string[] = [];
  const softLaws: string[] = [];

  const formattedLines = used.map((m) => {
    const rawCat = (m.category || "Rule").trim().toUpperCase();
    let text = m.text.trim();

    // Cap text to ~120 chars
    if (text.length > 120) {
      text = text.slice(0, 117).trim() + "…";
    }

    const isHardRule = m.type === "rule" || m.pinned || rawCat.includes("NEVER") || rawCat.includes("LEGAL") || rawCat.includes("CLAIMS");

    if (isHardRule) {
      hardLaws.push(text);
    } else {
      softLaws.push(text);
    }

    if (/^(always|never|hook|law)/i.test(text)) {
      return `- [${rawCat} LAW]: ${text}`;
    }

    if (rawCat.includes("NEVER") || text.toLowerCase().includes("don't") || text.toLowerCase().includes("never") || text.toLowerCase().includes("avoid")) {
      return `- [${rawCat} LAW] NEVER: ${text}`;
    }

    return `- [${rawCat} LAW] ALWAYS: ${text}`;
  });

  return {
    lawsBlock: formattedLines.join("\n"),
    hardLaws,
    softLaws,
    used,
    droppedCount,
  };
}

/**
 * Validates text against hard NEVER brand laws.
 */
export function validateAgainstHardLaws(
  text: string,
  hardLaws: string[] = []
): { compliant: boolean; violations: string[] } {
  if (!text || hardLaws.length === 0) return { compliant: true, violations: [] };

  const lowerText = text.toLowerCase();
  const violations: string[] = [];

  for (const law of hardLaws) {
    const lowerLaw = law.toLowerCase();
    if (lowerLaw.includes("never") || lowerLaw.includes("avoid") || lowerLaw.includes("do not")) {
      // Extract key prohibited phrase if evident
      const forbiddenPhrase = lowerLaw.replace(/^(never|avoid|do not|don't)\s+/i, "").trim();
      if (forbiddenPhrase.length > 6 && lowerText.includes(forbiddenPhrase)) {
        violations.push(law);
      }
    }
  }

  return {
    compliant: violations.length === 0,
    violations,
  };
}
