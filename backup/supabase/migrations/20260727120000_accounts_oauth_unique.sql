-- Ensure one connected account row per brand+platform for OAuth upserts
CREATE UNIQUE INDEX IF NOT EXISTS accounts_brand_id_platform_uidx
  ON public.accounts (brand_id, platform);

CREATE INDEX IF NOT EXISTS accounts_status_idx
  ON public.accounts (status);
