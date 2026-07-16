// ── Service Discovery ──────────────────────────────────────────────────
// Automatically parses remote URLs or JSON manifests and installs them.
// Singleton – obtain via ServiceDiscovery.getInstance().

import { IntegrationManifest } from './integrationManifest';
import { IntegrationManager } from './integrationManager';

export class ServiceDiscovery {
  private static instance: ServiceDiscovery;

  private constructor() {}

  public static getInstance(): ServiceDiscovery {
    if (!ServiceDiscovery.instance) {
      ServiceDiscovery.instance = new ServiceDiscovery();
    }
    return ServiceDiscovery.instance;
  }

  /**
   * Imports an integration manifest via URL and registers it automatically.
   */
  public async discoverFromUrl(url: string): Promise<IntegrationManifest> {
    console.log(`[ServiceDiscovery] Crawling manifest file at: ${url}`);
    
    // Simulate fetching and parsing manifest config
    const mockManifest: IntegrationManifest = {
      id: 'community-custom-adapter',
      provider: 'Community ElevenLabs Custom',
      category: 'Voice',
      type: 'REST',
      version: '1.0.4',
      capabilities: ['voiceGeneration', 'voiceCloning'],
      executionStrategy: 'streaming',
      fallbackPolicy: { retryCount: 1, allowFallback: true },
      permissions: { read: true, write: false, execute: true, destructive: false },
      authentication: { type: 'ApiKey', hasCredentials: false },
      costMetrics: { avgCostPerRequest: 0.08, billingType: 'PayAsYouGo' },
    };

    IntegrationManager.getInstance().installIntegration(mockManifest);
    return mockManifest;
  }

  /**
   * Parses pasted raw text JSON manifests and registers it automatically.
   */
  public discoverFromText(rawJson: string): IntegrationManifest {
    console.log('[ServiceDiscovery] Parsing pasted manifest text...');
    
    const parsed = JSON.parse(rawJson) as IntegrationManifest;
    
    // Validate required fields
    if (!parsed.id || !parsed.provider || !parsed.capabilities) {
      throw new Error('Manifest validation failed: missing id, provider, or capabilities.');
    }

    IntegrationManager.getInstance().installIntegration(parsed);
    return parsed;
  }
}
