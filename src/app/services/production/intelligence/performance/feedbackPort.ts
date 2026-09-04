/**
 * Implements CreativePerformanceFeedbackPort using CreativeLearning / MemoryItem.
 */

import type { MemoryItem } from "../../../../domain/types";
import type { CreativePerformanceFeedbackPort } from "../strategy/types";
import type { CreativeLearning } from "./types";
import { parseLearningHintsFromMemory, memoryItemsFromLearnings } from "./memoryBridge";
import { selectLearningsForContext } from "./learning";

export function createPerformanceFeedbackPort(opts: {
  getLearnings?: () => Promise<CreativeLearning[]> | CreativeLearning[];
  getMemoryItems?: () => Promise<MemoryItem[]> | MemoryItem[];
  accountId?: string;
  platform?: string;
  brandId?: string;
}): CreativePerformanceFeedbackPort {
  return {
    async getHints(brandId?: string) {
      const learningsRaw = opts.getLearnings ? await opts.getLearnings() : [];
      const memoryRaw = opts.getMemoryItems ? await opts.getMemoryItems() : [];
      const selected = selectLearningsForContext(learningsRaw, {
        accountId: opts.accountId,
        platform: opts.platform,
        brandId: brandId || opts.brandId,
      });
      const fromMemory = parseLearningHintsFromMemory(memoryRaw);
      const strongHooks = [
        ...fromMemory.strongHooks,
        ...selected
          .filter((l) => l.kind === "hook_pattern" && /stronger/i.test(l.claim))
          .map((l) => {
            const m = l.claim.match(/"([^"]+)"/);
            return m?.[1];
          })
          .filter(Boolean) as string[],
      ];
      const strongFormats = [
        ...fromMemory.strongFormats,
        ...selected
          .filter((l) => l.kind === "format_pattern" && /stronger/i.test(l.claim))
          .map((l) => {
            const m = l.claim.match(/"([^"]+)"/);
            return m?.[1];
          })
          .filter(Boolean) as string[],
      ];
      const notes = [
        ...fromMemory.notes,
        ...selected.slice(0, 3).map((l) => l.recommendation || l.claim),
      ];
      return {
        strongHooks: [...new Set(strongHooks)],
        strongFormats: [...new Set(strongFormats)],
        strongStyles: [],
        notes: notes.slice(0, 8),
      };
    },
  };
}

export function persistLearningsAsMemory(
  learnings: CreativeLearning[],
  existing: MemoryItem[] = []
): MemoryItem[] {
  const mapped = memoryItemsFromLearnings(learnings);
  const byFp = new Map(existing.map((m) => [m.fingerprint || m.id, m]));
  for (const m of mapped) {
    byFp.set(m.fingerprint || m.id, m);
  }
  return [...byFp.values()];
}
