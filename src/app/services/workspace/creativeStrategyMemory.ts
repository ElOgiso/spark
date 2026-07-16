// ── Creative Strategy Memory ──────────────────────────────────────────
// Stores details of top campaign strategies, emotional arcs, and pacing.
// Singleton – obtain via CreativeStrategyMemory.getInstance().

export interface StrategyEntry {
  id: string;
  campaignAngle: string;
  emotionalArc: string;
  storytellingFramework: string;
  humorStyle: string;
  pacing: 'slow' | 'balanced' | 'fast';
  performanceScore: number;
}

export class CreativeStrategyMemory {
  private static instance: CreativeStrategyMemory;
  private entries: StrategyEntry[] = [];

  private constructor() {
    this.loadDefaults();
  }

  public static getInstance(): CreativeStrategyMemory {
    if (!CreativeStrategyMemory.instance) {
      CreativeStrategyMemory.instance = new CreativeStrategyMemory();
    }
    return CreativeStrategyMemory.instance;
  }

  private loadDefaults(): void {
    this.entries.push({
      id: 'strat-1',
      campaignAngle: 'Agitate build pain points and show immediate OS setup solutions',
      emotionalArc: 'Curiosity ➔ Empathy ➔ Solution',
      storytellingFramework: 'Hook-Story-Offer',
      humorStyle: 'Playful teasing',
      pacing: 'balanced',
      performanceScore: 92,
    });
  }

  public registerStrategy(strat: Omit<StrategyEntry, 'id'>): StrategyEntry {
    const newEntry: StrategyEntry = {
      id: `strat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ...strat,
    };
    this.entries.push(newEntry);
    console.log(`[CreativeStrategyMemory] Stored strategy template: ${newEntry.id} (Score: ${newEntry.performanceScore})`);
    return newEntry;
  }

  public getBestStrategies(): StrategyEntry[] {
    return [...this.entries].sort((a, b) => b.performanceScore - a.performanceScore);
  }
}
