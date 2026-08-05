import { IntegrationManifest } from './integrationManifest';

export class ServiceRegistry {
  private static instance: ServiceRegistry;
  private services: Map<string, IntegrationManifest> = new Map();

  constructor() {
    const defaults: IntegrationManifest[] = [
      {
        id: 'openai',
        provider: 'OpenAI GPT-4o',
        category: 'LLM',
        type: 'CloudAPI',
        version: '1.0.0',
        capabilities: ['textGeneration', 'reasoning'],
        executionStrategy: 'streaming',
        fallbackPolicy: { retryCount: 2, allowFallback: true },
        permissions: { read: true, write: false, execute: true, destructive: false },
      },
      {
        id: 'gemini',
        provider: 'Google Gemini 1.5 Pro',
        category: 'LLM',
        type: 'CloudAPI',
        version: '1.5.0',
        capabilities: ['textGeneration', 'multimodal'],
        executionStrategy: 'streaming',
        fallbackPolicy: { retryCount: 2, allowFallback: true },
        permissions: { read: true, write: false, execute: true, destructive: false },
      },
      {
        id: 'fal-flux',
        provider: 'Fal AI Flux.1',
        category: 'MediaGeneration',
        type: 'CloudAPI',
        version: '1.0.0',
        capabilities: ['imageGeneration'],
        executionStrategy: 'sync',
        fallbackPolicy: { retryCount: 2, allowFallback: true },
        permissions: { read: true, write: false, execute: true, destructive: false },
      },
    ];
    defaults.forEach((s) => this.services.set(s.id, s));
  }

  static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry();
    }
    return ServiceRegistry.instance;
  }

  getAllServices(): IntegrationManifest[] {
    return Array.from(this.services.values());
  }

  getService(id: string): IntegrationManifest | undefined {
    return this.services.get(id);
  }

  registerService(service: IntegrationManifest): void {
    this.services.set(service.id, service);
  }

  unregisterService(id: string): void {
    this.services.delete(id);
  }
}
