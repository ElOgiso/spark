import type { MemoryItem } from "../../domain/types";

export interface RankedBrandLawsResult {
  lawsBlock: string;
  hardLaws: string[];
  softLaws: string[];
  used: MemoryItem[];
  droppedCount: number;
}

/** Brief / still compilers read at most 10 ranked laws. Empty Memory → empty block. */
export const MAX_BRAND_LAWS = 10;

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

function isHookLaw(item: MemoryItem): boolean {
  const cat = (item.category || "").trim().toLowerCase();
  return cat === "winning hooks" || cat === "hook";
}

function clipLaw(text: string, max = 200): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

function formatLawLine(item: MemoryItem): { line: string; hard: boolean; text: string } {
  const rawCat = (item.category || "Rule").trim().toUpperCase();
  const text = clipLaw(item.text || "");
  const isHardRule =
    item.type === "rule" ||
    Boolean(item.pinned) ||
    rawCat.includes("NEVER") ||
    rawCat.includes("LEGAL") ||
    rawCat.includes("CLAIMS") ||
    /\[LAW\]\s+NEVER:/i.test(text);

  if (/^\[LAW\]\s+(ALWAYS|NEVER|PREFER):/i.test(text) || /^\[LAW\]/i.test(text)) {
    return { line: `- ${text}`, hard: isHardRule, text };
  }

  const looksNever =
    rawCat.includes("NEVER") ||
    /\b(never|don't|do not|avoid)\b/i.test(text);

  if (looksNever) {
    const body = text.replace(/^(never|avoid|do not|don't)\s*:?\s+/i, "");
    return { line: `- [LAW] NEVER: ${body}`, hard: true, text };
  }

  if (item.type === "rule" || item.pinned) {
    if (/^(always|prefer):/i.test(text)) {
      return { line: `- [LAW] ${text}`, hard: true, text };
    }
    return { line: `- [LAW] ALWAYS: ${text}`, hard: true, text };
  }

  const preferBody = text.replace(/^prefer:\s*/i, "");
  return { line: `- [LAW] PREFER: ${preferBody}`, hard: false, text };
}

/**
 * Rank Memory as engagement case law. Pinned and hook laws first. Cap 10.
 * Empty Memory returns an empty laws block — never invents executive-authority filler.
 */
export function buildRankedBrandLaws(
  memoryItems: MemoryItem[] = [],
  maxLaws: number = MAX_BRAND_LAWS
): RankedBrandLawsResult {
  if (!memoryItems || memoryItems.length === 0) {
    return {
      lawsBlock: "",
      hardLaws: [],
      softLaws: [],
      used: [],
      droppedCount: 0,
    };
  }

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

  const sorted = [...uniqueItems].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;

    const hookA = isHookLaw(a);
    const hookB = isHookLaw(b);
    if (hookA && !hookB) return -1;
    if (!hookA && hookB) return 1;

    if (a.type === "rule" && b.type !== "rule") return -1;
    if (a.type !== "rule" && b.type === "rule") return 1;

    const weightA = getCategoryWeight(a.category);
    const weightB = getCategoryWeight(b.category);
    if (weightA !== weightB) return weightA - weightB;

    return getTimestamp(b) - getTimestamp(a);
  });

  const used = sorted.slice(0, maxLaws);
  const droppedCount = Math.max(0, sorted.length - maxLaws);

  const hardLaws: string[] = [];
  const softLaws: string[] = [];
  const formattedLines = used.map((m) => {
    const formatted = formatLawLine(m);
    if (formatted.hard) hardLaws.push(formatted.text);
    else softLaws.push(formatted.text);
    return formatted.line;
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
