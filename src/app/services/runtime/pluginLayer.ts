// ── Pluggable Providers Layer ─────────────────────────────────────────
// Manages hot-pluggable media, editing, storage, and analytics plugins.
// Singleton – obtain via PluginLayer.getInstance().

export type PluginType =
  | 'CapabilityProvider'
  | 'MediaProvider'
  | 'EditingProvider'
  | 'PublishingProvider'
  | 'AnalyticsProvider'
  | 'ResearchProvider'
  | 'StorageProvider'
  | 'MemoryProvider';

export interface SparkPlugin {
  id: string;
  name: string;
  type: PluginType;
  version: string;
  execute: (action: string, args: any) => Promise<any>;
}

export class PluginLayer {
  private static instance: PluginLayer;
  private plugins: Map<string, SparkPlugin> = new Map();

  private constructor() {
    this.registerDefaults();
  }

  public static getInstance(): PluginLayer {
    if (!PluginLayer.instance) {
      PluginLayer.instance = new PluginLayer();
    }
    return PluginLayer.instance;
  }

  private registerDefaults(): void {
    // Cutlass Editor Plugin
    this.register({
      id: 'plugin-cutlass-editor',
      name: 'Cutlass Engine',
      type: 'EditingProvider',
      version: '1.0.0',
      execute: async (action, args) => {
        console.log(`[Plugin Cutlass] Executing action: ${action}`);
        return { status: 'success', details: args };
      },
    });

    // YouTube Publishing Plugin
    this.register({
      id: 'plugin-youtube-publisher',
      name: 'YouTube Publisher',
      type: 'PublishingProvider',
      version: '1.0.0',
      execute: async (action, args) => {
        console.log(`[Plugin YouTube] Publishing action: ${action}`);
        return { publishedUrl: `https://youtube.com/watch?v=spark_${Date.now()}` };
      },
    });
  }

  public register(plugin: SparkPlugin): void {
    this.plugins.set(plugin.id, plugin);
    console.log(`[PluginLayer] Registered plugin "${plugin.name}" (${plugin.id}) of type ${plugin.type}`);
  }

  public getPlugin(id: string): SparkPlugin | undefined {
    return this.plugins.get(id);
  }

  public getPluginsByType(type: PluginType): SparkPlugin[] {
    return Array.from(this.plugins.values()).filter((p) => p.type === type);
  }
}
