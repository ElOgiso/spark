import { IMemoryService } from "../domain/contracts";
import { MemoryItem } from "../domain/types";
import { loadPersistedState, savePersistedState } from "../state/persistence";

const defaultMemoryItems: MemoryItem[] = [
  { id: "m-1", type: "learned", text: "Hook style: 'Nobody talks about this' achieves 3× retention on TikTok", dateAdded: "2026-06-28" },
  { id: "m-2", type: "learned", text: "Peak engagement window: Tue–Thu 2–4 PM across all accounts", dateAdded: "2026-06-29" },
  { id: "m-3", type: "learned", text: "Long-form YouTube content outperforms short-form by 2.4× for this audience", dateAdded: "2026-06-30" },
  { id: "m-4", type: "rule", text: "Never publish without a clear call to action in final 10 seconds", dateAdded: "2026-06-15" },
  { id: "m-5", type: "rule", text: "All thumbnails must include a human face with visible emotion", dateAdded: "2026-06-18" },
  { id: "m-6", type: "rule", text: "Avoid Western examples without local Nigerian context equivalent", dateAdded: "2026-06-20" },
];

export class MemoryService implements IMemoryService {
  private getFullState() {
    return loadPersistedState<any>() || {};
  }

  private saveFullState(updates: any) {
    const current = this.getFullState();
    savePersistedState({ ...current, ...updates });
  }

  async getMemoryItems(): Promise<MemoryItem[]> {
    const state = this.getFullState();
    if (!state.memoryItems) {
      this.saveFullState({ memoryItems: defaultMemoryItems });
      return defaultMemoryItems;
    }
    return state.memoryItems;
  }

  async addMemoryItem(text: string, type: "learned" | "rule"): Promise<MemoryItem> {
    const memoryItems = await this.getMemoryItems();
    const newItem: MemoryItem = {
      id: `m-${Date.now()}`,
      type,
      text,
      dateAdded: new Date().toISOString().split("T")[0]
    };
    const updated = [newItem, ...memoryItems];
    this.saveFullState({ memoryItems: updated });
    return newItem;
  }

  async removeMemoryItem(id: string): Promise<void> {
    const memoryItems = await this.getMemoryItems();
    const updated = memoryItems.filter((item) => item.id !== id);
    this.saveFullState({ memoryItems: updated });
  }
}

export const memoryService = new MemoryService();
