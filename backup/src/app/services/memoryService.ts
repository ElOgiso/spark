import { IMemoryService } from "../domain/contracts";
import { MemoryItem } from "../domain/types";
import { loadPersistedState, savePersistedState } from "../state/persistence";

const defaultMemoryItems: MemoryItem[] = [];

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

  async addMemoryItem(text: string, type: "learned" | "rule", category?: any): Promise<MemoryItem> {
    const memoryItems = await this.getMemoryItems();
    const newItem: MemoryItem = {
      id: `m-${Date.now()}`,
      type,
      text,
      dateAdded: new Date().toISOString().split("T")[0],
      category
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
