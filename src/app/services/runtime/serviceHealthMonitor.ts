export type HealthStatus = 'healthy' | 'degraded' | 'error' | 'disabled';

export interface HealthMetrics {
  status: HealthStatus;
  latencyMs: number;
  errorRate: number;
  lastCheck: string;
}

export class ServiceHealthMonitor {
  private static instance: ServiceHealthMonitor;
  private metricsMap: Map<string, HealthMetrics> = new Map();
  private observedIds = new Set<string>();
  private sampleCounts = new Map<string, number>();

  static getInstance(): ServiceHealthMonitor {
    if (!ServiceHealthMonitor.instance) {
      ServiceHealthMonitor.instance = new ServiceHealthMonitor();
    }
    return ServiceHealthMonitor.instance;
  }

  /** True only after a real execution outcome or an explicit setMetrics call. */
  hasObservation(id: string): boolean {
    return this.observedIds.has(id);
  }

  getMetrics(id: string): HealthMetrics {
    return (
      this.metricsMap.get(id) || {
        status: 'healthy',
        latencyMs: 45,
        errorRate: 0.001,
        lastCheck: new Date().toISOString(),
      }
    );
  }

  setMetrics(id: string, metrics: HealthMetrics): void {
    this.metricsMap.set(id, metrics);
    this.observedIds.add(id);
  }

  /**
   * Fold one finished provider attempt into the snapshot the canonical router reads.
   * A single failure degrades. Error requires a repeated failure rate, so one timeout
   * does not hard-reject the provider.
   */
  recordOutcome(id: string, outcome: { ok: boolean; latencyMs: number }): void {
    const had = this.observedIds.has(id);
    const prev = had ? this.metricsMap.get(id) : undefined;
    const samples = (this.sampleCounts.get(id) || 0) + 1;
    this.sampleCounts.set(id, samples);
    const prevErrors = prev ? prev.errorRate * (samples - 1) : 0;
    const errorRate = (prevErrors + (outcome.ok ? 0 : 1)) / samples;
    const latencyMs = prev
      ? Math.round(prev.latencyMs * 0.7 + Math.max(0, outcome.latencyMs) * 0.3)
      : Math.max(0, Math.round(outcome.latencyMs));
    let status: HealthStatus = "healthy";
    if (!outcome.ok && samples < 2) status = "degraded";
    else if (errorRate >= 0.5) status = "error";
    else if (errorRate >= 0.25) status = "degraded";
    this.setMetrics(id, {
      status,
      latencyMs,
      errorRate,
      lastCheck: new Date().toISOString(),
    });
  }
}
