import { IMemoryService } from "../domain/contracts";
import { MemoryItem } from "../domain/types";
import { loadPersistedState, savePersistedState } from "../state/persistence";

const defaultMemoryItems: MemoryItem[] = [
  { id: "m-1", type: "learned", text: "Keep the presenter persona authentic, direct, and slightly cynical about empty marketing hype.", dateAdded: "2026-06-28", category: "Character" },
  { id: "m-2", type: "learned", text: "Use conversational pacing (140-150 words per minute) with select Nigerian pidgin slang for maximum localized resonance.", dateAdded: "2026-06-29", category: "Voice" },
  { id: "m-3", type: "learned", text: "Ensure the distinctive purple/slate accent theme is consistent across all overlays, graphics, and backgrounds.", dateAdded: "2026-06-30", category: "Brand" },
  { id: "m-4", type: "rule", text: "Focus strictly on AI automation, digital creators, and tech efficiency in emerging markets.", dateAdded: "2026-06-15", category: "Niche" },
  { id: "m-5", type: "rule", text: "Keep background ambient synth music ducked to -18dB when active voice speaking is present.", dateAdded: "2026-06-18", category: "Audio" },
  { id: "m-6", type: "rule", text: "Use high-contrast split-screen comparisons in the first 3 seconds of all clips to spike retention.", dateAdded: "2026-06-20", category: "Winning hooks" },
  { id: "m-7", type: "rule", text: "Emphasize highly expressive human reactions paired with high-contrast text overlays.", dateAdded: "2026-06-22", category: "Winning thumbnails" },
  { id: "m-8", type: "learned", text: "Rapid tutorial pacing with direct code/tool visualization on screen outperforms standard face-cam.", dateAdded: "2026-06-24", category: "Audience preferences" },
  { id: "m-9", type: "rule", text: "Avoid generic stock-footage loops or long high-tempo corporate intro sequences which drop retention by 45%.", dateAdded: "2026-06-25", category: "Failures" },
  { id: "m-10", type: "rule", text: "Automatically queue and publish items exactly 2 hours before regional peak times (Tue-Thu 2-4 PM).", dateAdded: "2026-06-26", category: "Publishing behavior" },
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
