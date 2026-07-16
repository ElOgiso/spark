// ── Budget Intelligence ───────────────────────────────────────────────
// Enforces budgets and analyzes model costs versus quality expectations.
// Singleton – obtain via BudgetIntelligence.getInstance().

import { PerformanceHistory } from '../performanceHistory';

export interface BudgetProfile {
  totalBudgetLimit: number;
  currentSpend: number;
}

export class BudgetIntelligence {
  private static instance: BudgetIntelligence;
  private profile: BudgetProfile = {
    totalBudgetLimit: 100.0, // Default limit of $100 per campaign run
    currentSpend: 0.0,
  };

  private constructor() {}

  public static getInstance(): BudgetIntelligence {
    if (!BudgetIntelligence.instance) {
      BudgetIntelligence.instance = new BudgetIntelligence();
    }
    return BudgetIntelligence.instance;
  }

  public recordSpend(amount: number): void {
    this.profile.currentSpend += amount;
    console.log(`[BudgetIntelligence] Recorded spend: $${amount.toFixed(4)}. Total: $${this.profile.currentSpend.toFixed(4)}`);
  }

  public getBudgetStatus(): { limit: number; spent: number; remaining: number } {
    return {
      limit: this.profile.totalBudgetLimit,
      spent: this.profile.currentSpend,
      remaining: Math.max(0, this.profile.totalBudgetLimit - this.profile.currentSpend),
    };
  }

  /**
   * Recommends the optimal model based on cost limitations and historical quality.
   */
  public selectOptimalProvider(
    capability: string,
    providers: string[],
    qualityWeight: number = 0.6
  ): string {
    if (providers.length === 0) return 'google';

    const history = PerformanceHistory.getInstance();
    let bestProvider = providers[0];
    let bestScore = -1;

    const allMetrics = history.getAllMetrics();
    for (const provider of providers) {
      const stats = allMetrics.find(m => m.provider === provider) || { avgCostUsd: 0.01, qualityScore: 90 };
      
      // Calculate quality / cost ratio
      const cost = stats.avgCostUsd || 0.01;
      const quality = stats.qualityScore || 90;
      
      const score = (quality * qualityWeight) + ((1 / cost) * (1 - qualityWeight));
      
      if (score > bestScore) {
        bestScore = score;
        bestProvider = provider;
      }
    }

    console.log(`[BudgetIntelligence] Selected "${bestProvider}" for "${capability}" based on cost/quality scoring.`);
    return bestProvider;
  }
}
