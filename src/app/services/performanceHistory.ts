export interface ProviderMetrics {
  provider: string;
  model: string;
  successRate: number;
  avgLatencyMs: number;
  avgCostUsd: number;
  qualityScore: number;
  recentHealth: "healthy" | "degraded" | "unhealthy";
  totalExecutions: number;
  totalFailures: number;
  totalTokensUsed: number;
  lastExecutionAt: string;
}

export class PerformanceHistory {
  private static instance: PerformanceHistory;
  private metrics: Map<string, ProviderMetrics> = new Map();

  private constructor() {
    this.recordMetrics({
      provider: "openai", model: "gpt-4o",
      successRate: 0.97, avgLatencyMs: 1500, avgCostUsd: 0.015, qualityScore: 92,
      recentHealth: "healthy", totalExecutions: 0, totalFailures: 0, totalTokensUsed: 0, lastExecutionAt: ""
    });
    this.recordMetrics({
      provider: "openai", model: "gpt-4o-mini",
      successRate: 0.95, avgLatencyMs: 600, avgCostUsd: 0.002, qualityScore: 78,
      recentHealth: "healthy", totalExecutions: 0, totalFailures: 0, totalTokensUsed: 0, lastExecutionAt: ""
    });
    this.recordMetrics({
      provider: "anthropic", model: "claude-sonnet-4",
      successRate: 0.98, avgLatencyMs: 2100, avgCostUsd: 0.02, qualityScore: 96,
      recentHealth: "healthy", totalExecutions: 0, totalFailures: 0, totalTokensUsed: 0, lastExecutionAt: ""
    });
    this.recordMetrics({
      provider: "google", model: "gemini-2.5-pro",
      successRate: 0.96, avgLatencyMs: 2500, avgCostUsd: 0.01, qualityScore: 94,
      recentHealth: "healthy", totalExecutions: 0, totalFailures: 0, totalTokensUsed: 0, lastExecutionAt: ""
    });
    this.recordMetrics({
      provider: "google", model: "gemini-2.5-flash",
      successRate: 0.94, avgLatencyMs: 800, avgCostUsd: 0.0015, qualityScore: 75,
      recentHealth: "healthy", totalExecutions: 0, totalFailures: 0, totalTokensUsed: 0, lastExecutionAt: ""
    });

    // Register Media Providers
    const imageProviders = ["flux", "ideogram", "recraft", "openai_images"];
    for (const p of imageProviders) {
      this.recordMetrics({
        provider: p, model: p === "openai_images" ? "dall-e-3" : `${p}-model`,
        successRate: 0.98, avgLatencyMs: 3000, avgCostUsd: 0.04, qualityScore: 90,
        recentHealth: "healthy", totalExecutions: 0, totalFailures: 0, totalTokensUsed: 0, lastExecutionAt: ""
      });
    }

    const videoProviders = ["seedance", "higgsfield", "runway", "veo", "kling", "pika", "luma", "wan"];
    for (const p of videoProviders) {
      this.recordMetrics({
        provider: p, model: `${p}-model`,
        successRate: 0.97, avgLatencyMs: 12000, avgCostUsd: 0.20, qualityScore: 92,
        recentHealth: "healthy", totalExecutions: 0, totalFailures: 0, totalTokensUsed: 0, lastExecutionAt: ""
      });
    }
  }

  public static getInstance(): PerformanceHistory {
    if (!PerformanceHistory.instance) {
      PerformanceHistory.instance = new PerformanceHistory();
    }
    return PerformanceHistory.instance;
  }

  public recordMetrics(metrics: ProviderMetrics): void {
    const key = `${metrics.provider}:${metrics.model}`;
    this.metrics.set(key, metrics);
  }

  public getMetricsFor(provider: string, model: string): ProviderMetrics | undefined {
    return this.metrics.get(`${provider}:${model}`);
  }

  public getAllMetrics(): ProviderMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Called automatically after every provider execution to update rolling averages.
   */
  public recordExecution(
    provider: string,
    model: string,
    success: boolean,
    latencyMs: number,
    costUsd: number,
    tokensUsed: number
  ): void {
    const key = `${provider}:${model}`;
    const existing = this.metrics.get(key);

    if (!existing) {
      console.warn(`[Performance History] Unknown provider/model: ${key}`);
      return;
    }

    const n = existing.totalExecutions + 1;
    const failures = existing.totalFailures + (success ? 0 : 1);

    const updatedMetrics: ProviderMetrics = {
      ...existing,
      totalExecutions: n,
      totalFailures: failures,
      totalTokensUsed: existing.totalTokensUsed + tokensUsed,
      successRate: (n - failures) / n,
      avgLatencyMs: ((existing.avgLatencyMs * existing.totalExecutions) + latencyMs) / n,
      avgCostUsd: ((existing.avgCostUsd * existing.totalExecutions) + costUsd) / n,
      recentHealth: success ? "healthy" : (failures / n > 0.3 ? "unhealthy" : "degraded"),
      lastExecutionAt: new Date().toISOString()
    };

    this.metrics.set(key, updatedMetrics);
    console.log(`[Performance History] Updated ${key}: executions=${n}, successRate=${updatedMetrics.successRate.toFixed(2)}, avgLatency=${updatedMetrics.avgLatencyMs.toFixed(0)}ms`);
  }
}
