import { IntegrationManifest } from './integrationManifest';
import { ServiceRegistry } from './serviceRegistry';
import { ServiceHealthMonitor } from './serviceHealthMonitor';

export class IntegrationManager {
  private static instance: IntegrationManager;

  static getInstance(): IntegrationManager {
    if (!IntegrationManager.instance) {
      IntegrationManager.instance = new IntegrationManager();
    }
    return IntegrationManager.instance;
  }

  installIntegration(manifest: IntegrationManifest): void {
    ServiceRegistry.getInstance().registerService(manifest);
    ServiceHealthMonitor.getInstance().setMetrics(manifest.id, {
      status: 'healthy',
      latencyMs: 30,
      errorRate: 0,
      lastCheck: new Date().toISOString(),
    });
  }

  uninstallIntegration(id: string): void {
    ServiceRegistry.getInstance().unregisterService(id);
  }

  enableIntegration(id: string): void {
    const health = ServiceHealthMonitor.getInstance();
    health.setMetrics(id, {
      ...health.getMetrics(id),
      status: 'healthy',
    });
  }

  disableIntegration(id: string): void {
    const health = ServiceHealthMonitor.getInstance();
    health.setMetrics(id, {
      ...health.getMetrics(id),
      status: 'disabled',
    });
  }
}
