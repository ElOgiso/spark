-- media_assets RLS fix.
--
-- media_assets had ROW LEVEL SECURITY enabled but ZERO policies. In Postgres, RLS-enabled
-- with no policy denies ALL access, so every insert from persistProductionAssetCreate() was
-- silently rejected and the table stayed empty (0 rows). That broke the durable media index
-- used to recover/re-sign generated scene clips, thumbnails, and masters on login.
--
-- media_assets.uploaded_by holds the owning brand id (stored as text). Allow brand owners to
-- manage their own media metadata, mirroring the productions owner policy
-- (user_owns_brand(brand_id) / owner_id = auth.uid()).

ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "media_assets_owner_policy" ON public.media_assets;
CREATE POLICY "media_assets_owner_policy" ON public.media_assets
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id::text = public.media_assets.uploaded_by
        AND b.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id::text = public.media_assets.uploaded_by
        AND b.owner_id = auth.uid()
    )
  );
