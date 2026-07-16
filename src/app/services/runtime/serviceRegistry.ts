// ── Service Registry ──────────────────────────────────────────────────
// Houses all active IntegrationManifest configurations and resolves capabilities.
// Singleton – obtain via ServiceRegistry.getInstance().

import { IntegrationManifest } from './integrationManifest';
import { CapabilityScoringEngine } from './capabilityScoringEngine';
import { ServiceHealthMonitor } from './serviceHealthMonitor';

export class ServiceRegistry {
  private static instance: ServiceRegistry;
  private services: Map<string, IntegrationManifest> = new Map();
  private defaultOverrides: Map<string, string> = new Map(); // capability -> serviceId

  private constructor() {
    this.registerDefaults();
  }

  public static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry();
    }
    return ServiceRegistry.instance;
  }

  private registerDefaults(): void {
    // OpenAI Manifest
    this.register({
      id: 'openai',
      provider: 'OpenAI',
      category: 'MediaGeneration',
      type: 'CloudAPI',
      version: '1.0.0',
      capabilities: ['imageGeneration', 'voice', 'textGeneration', 'research'],
      executionStrategy: 'sync',
      fallbackPolicy: { retryCount: 2, allowFallback: true },
      permissions: { read: true, write: true, execute: true, destructive: false },
      authentication: { type: 'ApiKey', hasCredentials: true },
      costMetrics: { avgCostPerRequest: 0.015, billingType: 'PayAsYouGo' },
      limits: { rateLimitPerMinute: 200 },
    });

    // Gemini Manifest
    this.register({
      id: 'google',
      provider: 'Google Gemini',
      category: 'MediaGeneration',
      type: 'CloudAPI',
      version: '2.5.0',
      capabilities: ['imageGeneration', 'videoGeneration', 'voice', 'textGeneration', 'videoAnalysis', 'research'],
      executionStrategy: 'sync',
      fallbackPolicy: { retryCount: 3, allowFallback: true },
      permissions: { read: true, write: true, execute: true, destructive: false },
      authentication: { type: 'ApiKey', hasCredentials: true },
      costMetrics: { avgCostPerRequest: 0.0, billingType: 'Free' },
      limits: { rateLimitPerMinute: 1000 },
    });

    // Flux Manifest
    this.register({
      id: 'flux',
      provider: 'Fal Flux',
      category: 'MediaGeneration',
      type: 'CloudAPI',
      version: '1.0.0',
      capabilities: ['imageGeneration', 'characterConsistency'],
      executionStrategy: 'polling',
      fallbackPolicy: { retryCount: 2, allowFallback: true },
      permissions: { read: true, write: false, execute: true, destructive: false },
      authentication: { type: 'ApiKey', hasCredentials: true },
      costMetrics: { avgCostPerRequest: 0.05, billingType: 'PayAsYouGo' },
      limits: { rateLimitPerMinute: 50 },
    });
  }

  public register(manifest: IntegrationManifest): void {
    this.services.set(manifest.id.toLowerCase(), manifest);
    console.log(`[ServiceRegistry] Registered Service "${manifest.provider}" (${manifest.id})`);
  }

  public remove(serviceId: string): void {
    this.services.delete(serviceId.toLowerCase());
    console.log(`[ServiceRegistry] Removed Service "${serviceId}"`);
  }

  public getService(id: string): IntegrationManifest | undefined {
    return this.services.get(id.toLowerCase());
  }

  public getAllServices(): IntegrationManifest[] {
    return Array.from(this.services.values());
  }

  public setDefaultService(capability: string, serviceId: string): void {
    this.defaultOverrides.set(capability.toLowerCase(), serviceId);
  }

  public getDefaultService(capability: string): string | undefined {
    return this.defaultOverrides.get(capability.toLowerCase());
  }

  /**
   * Resolves the optimal service provider based on scores and health profiles.
   */
  public resolveOptimalService(capability: string): IntegrationManifest | undefined {
    const defaultOverride = this.getDefaultService(capability);
    if (defaultOverride) {
      const s = this.getService(defaultOverride);
      if (s) return s;
    }

    const candidates = this.getAllServices().filter((s) =>
      s.capabilities.includes(capability)
    );

    if (candidates.length === 0) return undefined;

    const scoring = CapabilityScoringEngine.getInstance();
    const healthMonitor = ServiceHealthMonitor.getInstance();

    let bestService: IntegrationManifest | undefined = undefined;
    let maxScore = -1;

    for (const candidate of candidates) {
      const health = healthMonitor.getMetrics(candidate.id);
      
      const score = scoring.calculateScore(candidate, {
        latencyMs: health.latencyMs,
        costUsd: candidate.costMetrics?.avgCostPerRequest || 0.01,
        successRate: health.successRate,
        qualityRating: candidate.id === 'google' ? 95 : 90,
        healthStatus: health.status,
        confidenceRating: 95,
      });

      if (score > maxScore) {
        maxScore = score;
        bestService = candidate;
      }
    }

    return bestService;
  }
}
