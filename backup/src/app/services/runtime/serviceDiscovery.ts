import { IntegrationManifest } from './integrationManifest';

export class ServiceDiscovery {
  private static instance: ServiceDiscovery;

  static getInstance(): ServiceDiscovery {
    if (!ServiceDiscovery.instance) {
      ServiceDiscovery.instance = new ServiceDiscovery();
    }
    return ServiceDiscovery.instance;
  }

  async discoverAvailableServices(): Promise<Partial<IntegrationManifest>[]> {
    return [];
  }
}
