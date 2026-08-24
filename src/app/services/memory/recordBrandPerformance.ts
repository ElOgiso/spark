import type { MemoryItem, Production, ProductionBrief, Brand } from "../../domain/types";
import { computeFingerprint } from "../research/researchDepartmentService";

export interface RecordPerformanceWinParams {
  brandId: string;
  production: Production;
  brief?: ProductionBrief;
  platform?: string;
  existingMemories?: MemoryItem[];
}

export interface RecordPerformanceWinResult {
  memoryItem: MemoryItem;
  isNew: boolean;
  updatedMemories: MemoryItem[];
}

/**
 * Extracts winning brand performance patterns when a production is approved or published,
 * writing or updating a durable, fingerprint-deduplicated MemoryItem rule.
 */
export function recordBrandPerformanceWin(
  params: RecordPerformanceWinParams
): RecordPerformanceWinResult {
  const { brandId, production, brief = production.brief, platform = production.formats?.[0] || "YouTube Shorts", existingMemories = [] } = params;

  const mode = (production.mode || brief?.productionMode || "standard").toLowerCase();
  const title = production.title || brief?.title || "Production Winner";
  const hookSnippet = brief?.hook ? brief.hook.slice(0, 45).replace(/\n/g, " ") : title.slice(0, 45);

  const rawKey = `${brandId}:${mode}:${platform}:${hookSnippet.slice(0, 20)}`;
  const fingerprint = `fp-win-${computeFingerprint(rawKey)}`;
  const dateStr = new Date().toISOString().split("T")[0];
  const now = new Date().toISOString();

  const ruleText = `[BRAND WIN] ALWAYS: Repeat ${mode.toUpperCase()} mode video concept ("${hookSnippet}...") on ${platform} — proven shipped win.`;

  const existingIdx = existingMemories.findIndex((m) => m.fingerprint === fingerprint || (m.text && m.text.includes(hookSnippet.slice(0, 20))));

  if (existingIdx >= 0) {
    const existing = existingMemories[existingIdx];
    const updated: MemoryItem = {
      ...existing,
      text: ruleText,
      lastSeenAt: now,
      syncCount: (existing.syncCount || 1) + 1,
    };

    const updatedMemories = [...existingMemories];
    updatedMemories[existingIdx] = updated;

    return {
      memoryItem: updated,
      isNew: false,
      updatedMemories,
    };
  }

  const newMemory: MemoryItem = {
    id: `m-win-${Date.now()}`,
    type: "rule",
    category: "Brand",
    text: ruleText,
    dateAdded: dateStr,
    pinned: true,
    fingerprint,
    firstSeenAt: now,
    lastSeenAt: now,
    syncCount: 1,
  };

  return {
    memoryItem: newMemory,
    isNew: true,
    updatedMemories: [newMemory, ...existingMemories],
  };
}
