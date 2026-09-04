/**
 * Bridge CreativeLearning ↔ existing MemoryItem infrastructure.
 * Does not create a separate memory system.
 */

import type { MemoryItem } from "../../../../domain/types";
import type { CreativeLearning } from "./types";

const CATEGORY_BY_KIND: Record<string, MemoryItem["category"]> = {
  hook_pattern: "Winning hooks",
  format_pattern: "Audience preferences",
  duration_pattern: "Audience preferences",
  audience_pattern: "Audience preferences",
  platform_pattern: "Publishing behavior",
  brand_pattern: "Brand",
  character_pattern: "Character",
  audio_pattern: "Audio",
  editing_pattern: "Audience preferences",
  failure_pattern: "Failures",
  series_pattern: "Audience preferences",
  reliability_pattern: "Failures",
};

export function learningToMemoryItem(learning: CreativeLearning): MemoryItem {
  const confPct = Math.round(learning.confidence.score * 100);
  const scopeBit = learning.scopeKey ? `${learning.scope}:${learning.scopeKey}` : learning.scope;
  const text = [
    `[CREATIVE LEARNING:${learning.kind}]`,
    learning.claim,
    learning.recommendation ? `Recommendation: ${learning.recommendation}` : null,
    `scope=${scopeBit}; evidence=${learning.evidenceCount}; confidence=${confPct}%; strength_score=${learning.confidence.score.toFixed(2)}`,
    `provenance=${learning.provenance.evidenceType}; snapshots=${learning.supportingSnapshotIds.length}`,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    id: `m-learn-${learning.id}`,
    type: "learned",
    text,
    dateAdded: learning.createdAt.split("T")[0],
    category: CATEGORY_BY_KIND[learning.kind] || "Audience preferences",
    fingerprint: `fp-clearn-${learning.id}`,
    firstSeenAt: learning.createdAt,
    lastSeenAt: learning.updatedAt,
    syncCount: learning.evidenceCount,
    archived: Boolean(learning.stale || learning.supersededBy),
  };
}

export function memoryItemsFromLearnings(learnings: CreativeLearning[]): MemoryItem[] {
  return learnings.map(learningToMemoryItem);
}

/** Extract CreativeLearning-shaped hints from MemoryItem texts written by this bridge. */
export function parseLearningHintsFromMemory(items: MemoryItem[]): {
  strongHooks: string[];
  strongFormats: string[];
  notes: string[];
} {
  const strongHooks: string[] = [];
  const strongFormats: string[] = [];
  const notes: string[] = [];

  for (const item of items) {
    if (item.archived) continue;
    const t = item.text || "";
    if (!t.includes("[CREATIVE LEARNING:")) continue;

    const hookMatch = t.match(/Hook type "([^"]+)" correlates with stronger/i);
    if (hookMatch) strongHooks.push(hookMatch[1]);

    const formatMatch = t.match(/Format "([^"]+)" correlates with stronger/i);
    if (formatMatch) strongFormats.push(formatMatch[1]);

    const rec = t.match(/Recommendation: ([^.]+\.)/);
    if (rec) notes.push(rec[1].trim());
    else if (item.category === "Winning hooks" || item.category === "Audience preferences") {
      notes.push(t.slice(0, 160));
    }
  }

  return {
    strongHooks: [...new Set(strongHooks)],
    strongFormats: [...new Set(strongFormats)],
    notes: notes.slice(0, 8),
  };
}
