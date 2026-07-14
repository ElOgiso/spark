export interface ProviderMetrics {
  provider: "openai" | "anthropic" | "google";
  model: string;
  successRate: number;
  avgLatencyMs: number;
  avgCostUsd: number;
  qualityScore: number;
  recentHealth: "healthy" | "degraded" | "unhealthy";
}

export class PerformanceHistory {
  private static instance: PerformanceHistory;
  private metrics: Map<string, ProviderMetrics> = new Map();

  private constructor() {
    // Register baseline historical stats for models
    this.recordMetrics({
      provider: "openai",
      model: "gpt-4o",
      successRate: 0.97,
      avgLatencyMs: 1500,
      avgCostUsd: 0.015,
      qualityScore: 92,
      recentHealth: "healthy"
    });

    this.recordMetrics({
      provider: "openai",
      model: "gpt-4o-mini",
      successRate: 0.95,
      avgLatencyMs: 600,
      avgCostUsd: 0.002,
      qualityScore: 78,
      recentHealth: "healthy"
    });

    this.recordMetrics({
      provider: "anthropic",
      model: "claude-3-5-sonnet",
      successRate: 0.98,
      avgLatencyMs: 2100,
      avgCostUsd: 0.02,
      qualityScore: 96,
      recentHealth: "healthy"
    });

    this.recordMetrics({
      provider: "google",
      model: "gemini-1.5-pro",
      successRate: 0.96,
      avgLatencyMs: 2500,
      avgCostUsd: 0.01,
      qualityScore: 94,
      recentHealth: "healthy"
    });

    this.recordMetrics({
      provider: "google",
      model: "gemini-1.5-flash",
      successRate: 0.94,
      avgLatencyMs: 800,
      avgCostUsd: 0.0015,
      qualityScore: 75,
      recentHealth: "healthy"
    });
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
}
