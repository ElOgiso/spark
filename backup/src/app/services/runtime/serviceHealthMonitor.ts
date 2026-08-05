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

  static getInstance(): ServiceHealthMonitor {
    if (!ServiceHealthMonitor.instance) {
      ServiceHealthMonitor.instance = new ServiceHealthMonitor();
    }
    return ServiceHealthMonitor.instance;
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
  }
}
