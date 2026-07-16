// ── Media Service ─────────────────────────────────────────────────────
// Manages asset registries and tracks generated media assets.
// Singleton – obtain via MediaService.getInstance().

export interface MediaAsset {
  id: string;
  url: string;
  type: 'image' | 'video' | 'audio' | 'text' | 'caption';
  label: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export class MediaService {
  private static instance: MediaService;
  private assets: Map<string, MediaAsset> = new Map();

  private constructor() {}

  public static getInstance(): MediaService {
    if (!MediaService.instance) {
      MediaService.instance = new MediaService();
    }
    return MediaService.instance;
  }

  public registerAsset(url: string, type: MediaAsset['type'], label: string, metadata?: Record<string, any>): MediaAsset {
    const asset: MediaAsset = {
      id: `asset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      url,
      type,
      label,
      metadata,
      createdAt: new Date().toISOString(),
    };
    this.assets.set(asset.id, asset);
    console.log(`[MediaService] Registered ${type} asset: ${label} (${url})`);
    return asset;
  }

  public getAsset(id: string): MediaAsset | undefined {
    return this.assets.get(id);
  }

  public getAssetsByType(type: MediaAsset['type']): MediaAsset[] {
    return Array.from(this.assets.values()).filter((a) => a.type === type);
  }

  public getAllAssets(): MediaAsset[] {
    return Array.from(this.assets.values());
  }

  public clear(): void {
    this.assets.clear();
  }
}
