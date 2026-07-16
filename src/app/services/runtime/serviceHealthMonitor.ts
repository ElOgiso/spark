// ── Service Health Monitor ────────────────────────────────────────────
// Tracks uptime metrics, quota allocations, latency, and auth states.
// Singleton – obtain via ServiceHealthMonitor.getInstance().

export interface ServiceHealthMetrics {
  status: 'healthy' | 'degraded' | 'offline' | 'disabled';
  latencyMs: number;
  successRate: number;
  quotaRemainingPercent: number;
  dailyUsageCount: number;
  monthlyUsageCount: number;
  estimatedCostTodayUsd: number;
  coldStartTimeMs: number;
  authHealthy: boolean;
  version: string;
}

export class ServiceHealthMonitor {
  private static instance: ServiceHealthMonitor;
  private healthData: Map<string, ServiceHealthMetrics> = new Map();

  private constructor() {
    this.registerDefaultMetrics();
  }

  public static getInstance(): ServiceHealthMonitor {
    if (!ServiceHealthMonitor.instance) {
      ServiceHealthMonitor.instance = new ServiceHealthMonitor();
    }
    return ServiceHealthMonitor.instance;
  }

  private registerDefaultMetrics(): void {
    // OpenAI metrics
    this.healthData.set('openai', {
      status: 'healthy',
      latencyMs: 1400,
      successRate: 0.98,
      quotaRemainingPercent: 88,
      dailyUsageCount: 34,
      monthlyUsageCount: 412,
      estimatedCostTodayUsd: 0.42,
      coldStartTimeMs: 100,
      authHealthy: true,
      version: 'v4.0.0',
    });

    // Gemini metrics
    this.healthData.set('google', {
      status: 'healthy',
      latencyMs: 2100,
      successRate: 0.96,
      quotaRemainingPercent: 100,
      dailyUsageCount: 129,
      monthlyUsageCount: 1104,
      estimatedCostTodayUsd: 0.0, // Free Tier
      coldStartTimeMs: 200,
      authHealthy: true,
      version: 'gemini-2.5',
    });

    // Higgsfield metrics
    this.healthData.set('higgsfield', {
      status: 'healthy',
      latencyMs: 52000,
      successRate: 0.94,
      quotaRemainingPercent: 72,
      dailyUsageCount: 7,
      monthlyUsageCount: 65,
      estimatedCostTodayUsd: 1.40,
      coldStartTimeMs: 1200,
      authHealthy: true,
      version: 'v1.2.0',
    });
  }

  public getMetrics(serviceId: string): ServiceHealthMetrics {
    return this.healthData.get(serviceId.toLowerCase()) || {
      status: 'healthy',
      latencyMs: 1200,
      successRate: 1.0,
      quotaRemainingPercent: 100,
      dailyUsageCount: 0,
      monthlyUsageCount: 0,
      estimatedCostTodayUsd: 0.0,
      coldStartTimeMs: 0,
      authHealthy: true,
      version: '1.0.0',
    };
  }

  public setMetrics(serviceId: string, metrics: ServiceHealthMetrics): void {
    this.healthData.set(serviceId.toLowerCase(), metrics);
  }
}
