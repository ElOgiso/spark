// ── Integration Manager ───────────────────────────────────────────────
// Performs hot-installation, toggling, enablement, and removal of integrations.
// Singleton – obtain via IntegrationManager.getInstance().

import { IntegrationManifest } from './integrationManifest';
import { ServiceRegistry } from './serviceRegistry';
import { ServiceHealthMonitor } from './serviceHealthMonitor';

export class IntegrationManager {
  private static instance: IntegrationManager;
  private installedServices: Set<string> = new Set();

  private constructor() {
    // Register initial set
    this.installedServices.add('openai');
    this.installedServices.add('google');
    this.installedServices.add('flux');
  }

  public static getInstance(): IntegrationManager {
    if (!IntegrationManager.instance) {
      IntegrationManager.instance = new IntegrationManager();
    }
    return IntegrationManager.instance;
  }

  public installIntegration(manifest: IntegrationManifest): void {
    ServiceRegistry.getInstance().register(manifest);
    this.installedServices.add(manifest.id.toLowerCase());
    console.log(`[IntegrationManager] Hot-installed integration: ${manifest.provider}`);
  }

  public uninstallIntegration(serviceId: string): void {
    ServiceRegistry.getInstance().remove(serviceId);
    this.installedServices.delete(serviceId.toLowerCase());
    console.log(`[IntegrationManager] Uninstalled integration: ${serviceId}`);
  }

  public disableIntegration(serviceId: string): void {
    const monitor = ServiceHealthMonitor.getInstance();
    const metrics = monitor.getMetrics(serviceId);
    monitor.setMetrics(serviceId, {
      ...metrics,
      status: 'disabled',
    });
    console.log(`[IntegrationManager] Disabled integration: ${serviceId}`);
  }

  public enableIntegration(serviceId: string): void {
    const monitor = ServiceHealthMonitor.getInstance();
    const metrics = monitor.getMetrics(serviceId);
    monitor.setMetrics(serviceId, {
      ...metrics,
      status: 'healthy',
    });
    console.log(`[IntegrationManager] Enabled integration: ${serviceId}`);
  }

  public getInstalledServices(): string[] {
    return Array.from(this.installedServices);
  }
}
