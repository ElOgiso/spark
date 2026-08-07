-- Migration: Create Unified Production Assets Table & Storage Buckets for SPARK Media OS
-- Target: production_assets

CREATE TABLE IF NOT EXISTS production_assets (
  id TEXT PRIMARY KEY,
  brand_id TEXT,
  production_id TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('image', 'frame', 'storyboard', 'video', 'audio', 'thumbnail')),
  provider TEXT,
  storage_bucket TEXT DEFAULT 'production-assets',
  storage_path TEXT,
  public_url TEXT,
  mime_type TEXT,
  duration TEXT,
  generation_prompt TEXT,
  generation_settings JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_production_assets_prod_id ON production_assets(production_id);
CREATE INDEX IF NOT EXISTS idx_production_assets_brand_id ON production_assets(brand_id);
