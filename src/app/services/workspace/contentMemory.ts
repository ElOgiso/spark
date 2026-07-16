// ── Content Memory Engine ─────────────────────────────────────────────
// Stores attributes of high-performing published items.
// Singleton – obtain via ContentMemory.getInstance().

export interface ContentMemoryEntry {
  id: string;
  hook: string;
  cta: string;
  transitionType: string;
  openingSceneType: string;
  shotOrder: string[];
  durationSeconds: number;
  platform: string;
  audience: string;
  retentionRate: number; // 0.0 to 1.0 (e.g. 0.82)
  performanceScore: number; // e.g. 98
}

export class ContentMemory {
  private static instance: ContentMemory;
  private entries: ContentMemoryEntry[] = [];

  private constructor() {
    this.loadDefaults();
  }

  public static getInstance(): ContentMemory {
    if (!ContentMemory.instance) {
      ContentMemory.instance = new ContentMemory();
    }
    return ContentMemory.instance;
  }

  private loadDefaults(): void {
    this.entries.push({
      id: 'entry-default-1',
      hook: 'Building a production-ready AI agent runtime is harder than it looks.',
      cta: 'Try Spark Media OS locally today.',
      transitionType: 'crossDissolve',
      openingSceneType: 'wideShot',
      shotOrder: ['wide', 'closeUp', 'medium', 'insert'],
      durationSeconds: 45,
      platform: 'tiktok',
      audience: 'Technical creators',
      retentionRate: 0.84,
      performanceScore: 95,
    });
  }

  public registerEntry(entry: Omit<ContentMemoryEntry, 'id'>): ContentMemoryEntry {
    const newEntry: ContentMemoryEntry = {
      id: `c-mem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ...entry,
    };
    this.entries.push(newEntry);
    console.log(`[ContentMemory] Registered successful content memory template: ${newEntry.id} (Score: ${newEntry.performanceScore})`);
    return newEntry;
  }

  public getBestEntries(platform?: string): ContentMemoryEntry[] {
    const list = platform
      ? this.entries.filter((e) => e.platform.toLowerCase() === platform.toLowerCase())
      : this.entries;
    return list.sort((a, b) => b.performanceScore - a.performanceScore);
  }
}
