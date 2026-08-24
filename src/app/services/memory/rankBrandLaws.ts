import type { MemoryItem } from "../../domain/types";

export interface RankedBrandLawsResult {
  lawsBlock: string;
  used: MemoryItem[];
  droppedCount: number;
}

export const MAX_BRAND_LAWS = 8;

const CATEGORY_PRIORITY: Record<string, number> = {
  brand: 1,
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
 * Shared helper to rank, cap, deduplicate, and format brand memory items into strict laws.
 */
export function buildRankedBrandLaws(
  memoryItems: MemoryItem[] = [],
  maxLaws: number = MAX_BRAND_LAWS
): RankedBrandLawsResult {
  if (!memoryItems || memoryItems.length === 0) {
    return {
      lawsBlock: "- [BRAND] ALWAYS: Maintain sharp executive authority, high-contrast framing, and zero filler words.",
      used: [],
      droppedCount: 0,
    };
  }

  // Deduplicate by fingerprint or normalized text
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

  // Priority Sort: Pinned -> Type (rule > learned) -> Category Weight -> Recency
  const sorted = [...uniqueItems].sort((a, b) => {
    // 1) Pinned
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;

    // 2) Type
    if (a.type === "rule" && b.type !== "rule") return -1;
    if (a.type !== "rule" && b.type === "rule") return 1;

    // 3) Category Priority
    const weightA = getCategoryWeight(a.category);
    const weightB = getCategoryWeight(b.category);
    if (weightA !== weightB) return weightA - weightB;

    // 4) Recency
    return getTimestamp(b) - getTimestamp(a);
  });

  const used = sorted.slice(0, maxLaws);
  const droppedCount = Math.max(0, sorted.length - maxLaws);

  const formattedLines = used.map((m) => {
    const rawCat = (m.category || "Rule").trim().toUpperCase();
    let text = m.text.trim();

    // Cap text to ~120 chars
    if (text.length > 120) {
      text = text.slice(0, 117).trim() + "…";
    }

    if (/^(always|never|hook|law)/i.test(text)) {
      return `- [${rawCat}]: ${text}`;
    }

    if (m.type === "rule" || rawCat.includes("NEVER") || text.toLowerCase().includes("don't") || text.toLowerCase().includes("never")) {
      return `- [${rawCat}] NEVER: ${text}`;
    }

    return `- [${rawCat}] ALWAYS: ${text}`;
  });

  return {
    lawsBlock: formattedLines.join("\n"),
    used,
    droppedCount,
  };
}
