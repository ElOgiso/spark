-- ============================================================================
-- SPARK PHASE 18 — SUPABASE SECURITY & DATA BOUNDARY HARDENING
-- Migration: 20260924145147_phase18_security_and_data_hardening.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SECURITY DEFINER FUNCTIONS HARDENING (Explicit search_path & Revoked Anon/Public)
-- ----------------------------------------------------------------------------

-- Helper: is_admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean AS $$
BEGIN
  IF user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = user_id 
      AND (role = 'admin' OR is_super_admin = TRUE)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;

-- Helper: user_owns_brand
CREATE OR REPLACE FUNCTION public.user_owns_brand(brand_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.brands
    WHERE id = brand_uuid
      AND owner_id = auth.uid()
  );
$$;

REVOKE EXECUTE ON FUNCTION public.user_owns_brand(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_owns_brand(uuid) TO authenticated, service_role;

-- Auth trigger function: handle_new_user (System-only trigger execution)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- Admin RPC: admin_set_access_status
REVOKE EXECUTE ON FUNCTION public.admin_set_access_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_access_status(uuid, text) TO authenticated, service_role;

-- Admin RPC: admin_adjust_credits
REVOKE EXECUTE ON FUNCTION public.admin_adjust_credits(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_adjust_credits(uuid, integer, text) TO authenticated, service_role;

-- Financial RPCs: Revoke default PUBLIC & anon access, grant authenticated and service_role
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'spark_reserve_credits') THEN
    REVOKE EXECUTE ON FUNCTION public.spark_reserve_credits(UUID, TEXT, INTEGER, TEXT, TEXT, NUMERIC, JSONB) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.spark_reserve_credits(UUID, TEXT, INTEGER, TEXT, TEXT, NUMERIC, JSONB) TO authenticated, service_role;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'spark_settle_credits') THEN
    REVOKE EXECUTE ON FUNCTION public.spark_settle_credits(UUID, UUID, INTEGER, TEXT, NUMERIC, JSONB) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.spark_settle_credits(UUID, UUID, INTEGER, TEXT, NUMERIC, JSONB) TO authenticated, service_role;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'spark_release_credits') THEN
    REVOKE EXECUTE ON FUNCTION public.spark_release_credits(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.spark_release_credits(UUID, UUID, TEXT, TEXT) TO authenticated, service_role;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'spark_mark_pending_unknown') THEN
    REVOKE EXECUTE ON FUNCTION public.spark_mark_pending_unknown(UUID, UUID, TEXT) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.spark_mark_pending_unknown(UUID, UUID, TEXT) TO authenticated, service_role;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'spark_refund_credits') THEN
    REVOKE EXECUTE ON FUNCTION public.spark_refund_credits(UUID, UUID, INTEGER, TEXT, TEXT) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.spark_refund_credits(UUID, UUID, INTEGER, TEXT, TEXT) TO authenticated, service_role;
  END IF;
END $$;


-- ----------------------------------------------------------------------------
-- 2. CONSOLIDATE RLS POLICIES & ENFORCE STRICT OWNERSHIP
-- ----------------------------------------------------------------------------

-- PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile or admins read all" ON public.profiles;
DROP POLICY IF EXISTS "Users can select own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own display fields or admins update all" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own display fields only" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile or admins insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;

CREATE POLICY "profiles_select_policy"
  ON public.profiles FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = id OR public.is_admin((select auth.uid())));

CREATE POLICY "profiles_update_policy"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = id OR public.is_admin((select auth.uid())))
  WITH CHECK (
    public.is_admin((select auth.uid())) OR (
      (select auth.uid()) = id AND
      role = (SELECT p.role FROM public.profiles p WHERE p.id = (select auth.uid())) AND
      is_super_admin = (SELECT p.is_super_admin FROM public.profiles p WHERE p.id = (select auth.uid())) AND
      credit_balance = (SELECT p.credit_balance FROM public.profiles p WHERE p.id = (select auth.uid())) AND
      access_status = (SELECT p.access_status FROM public.profiles p WHERE p.id = (select auth.uid()))
    )
  );

REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM anon, public;
GRANT SELECT ON public.profiles TO authenticated, service_role;


-- BRANDS
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can select own brands" ON public.brands;
DROP POLICY IF EXISTS "Owners can insert own brands" ON public.brands;
DROP POLICY IF EXISTS "Owners can update own brands" ON public.brands;
DROP POLICY IF EXISTS "Owners can delete own brands" ON public.brands;
DROP POLICY IF EXISTS "brands_owner_policy" ON public.brands;

CREATE POLICY "brands_select_policy"
  ON public.brands FOR SELECT
  TO authenticated
  USING (owner_id = (select auth.uid()) OR public.is_admin((select auth.uid())));

CREATE POLICY "brands_insert_policy"
  ON public.brands FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = (select auth.uid()) OR public.is_admin((select auth.uid())));

CREATE POLICY "brands_update_policy"
  ON public.brands FOR UPDATE
  TO authenticated
  USING (owner_id = (select auth.uid()) OR public.is_admin((select auth.uid())))
  WITH CHECK (owner_id = (select auth.uid()) OR public.is_admin((select auth.uid())));

CREATE POLICY "brands_delete_policy"
  ON public.brands FOR DELETE
  TO authenticated
  USING (owner_id = (select auth.uid()) OR public.is_admin((select auth.uid())));

REVOKE ALL ON public.brands FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brands TO authenticated, service_role;


-- CHARACTERS
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can select brand characters" ON public.characters;
DROP POLICY IF EXISTS "Owners can insert brand characters" ON public.characters;
DROP POLICY IF EXISTS "Owners can update brand characters" ON public.characters;
DROP POLICY IF EXISTS "Owners can delete brand characters" ON public.characters;
DROP POLICY IF EXISTS "characters_owner_policy" ON public.characters;

CREATE POLICY "characters_select_policy"
  ON public.characters FOR SELECT
  TO authenticated
  USING (public.user_owns_brand(brand_id) OR public.is_admin((select auth.uid())));

CREATE POLICY "characters_insert_policy"
  ON public.characters FOR INSERT
  TO authenticated
  WITH CHECK (public.user_owns_brand(brand_id) OR public.is_admin((select auth.uid())));

CREATE POLICY "characters_update_policy"
  ON public.characters FOR UPDATE
  TO authenticated
  USING (public.user_owns_brand(brand_id) OR public.is_admin((select auth.uid())))
  WITH CHECK (public.user_owns_brand(brand_id) OR public.is_admin((select auth.uid())));

CREATE POLICY "characters_delete_policy"
  ON public.characters FOR DELETE
  TO authenticated
  USING (public.user_owns_brand(brand_id) OR public.is_admin((select auth.uid())));

REVOKE ALL ON public.characters FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.characters TO authenticated, service_role;


-- BRAND RULES
ALTER TABLE public.brand_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can select brand rules" ON public.brand_rules;
DROP POLICY IF EXISTS "Owners can insert brand rules" ON public.brand_rules;
DROP POLICY IF EXISTS "Owners can update brand rules" ON public.brand_rules;
DROP POLICY IF EXISTS "Owners can delete brand rules" ON public.brand_rules;

CREATE POLICY "brand_rules_select_policy"
  ON public.brand_rules FOR SELECT
  TO authenticated
  USING (public.user_owns_brand(brand_id) OR public.is_admin((select auth.uid())));

CREATE POLICY "brand_rules_insert_policy"
  ON public.brand_rules FOR INSERT
  TO authenticated
  WITH CHECK (public.user_owns_brand(brand_id) OR public.is_admin((select auth.uid())));

CREATE POLICY "brand_rules_update_policy"
  ON public.brand_rules FOR UPDATE
  TO authenticated
  USING (public.user_owns_brand(brand_id) OR public.is_admin((select auth.uid())))
  WITH CHECK (public.user_owns_brand(brand_id) OR public.is_admin((select auth.uid())));

CREATE POLICY "brand_rules_delete_policy"
  ON public.brand_rules FOR DELETE
  TO authenticated
  USING (public.user_owns_brand(brand_id) OR public.is_admin((select auth.uid())));

REVOKE ALL ON public.brand_rules FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_rules TO authenticated, service_role;


-- MEMORY ITEMS
ALTER TABLE public.memory_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can select brand memory" ON public.memory_items;
DROP POLICY IF EXISTS "Owners can insert brand memory" ON public.memory_items;
DROP POLICY IF EXISTS "Owners can update brand memory" ON public.memory_items;
DROP POLICY IF EXISTS "Owners can delete brand memory" ON public.memory_items;

CREATE POLICY "memory_items_select_policy"
  ON public.memory_items FOR SELECT
  TO authenticated
  USING (public.user_owns_brand(brand_id) OR public.is_admin((select auth.uid())));

CREATE POLICY "memory_items_insert_policy"
  ON public.memory_items FOR INSERT
  TO authenticated
  WITH CHECK (public.user_owns_brand(brand_id) OR public.is_admin((select auth.uid())));

CREATE POLICY "memory_items_update_policy"
  ON public.memory_items FOR UPDATE
  TO authenticated
  USING (public.user_owns_brand(brand_id) OR public.is_admin((select auth.uid())))
  WITH CHECK (public.user_owns_brand(brand_id) OR public.is_admin((select auth.uid())));

CREATE POLICY "memory_items_delete_policy"
  ON public.memory_items FOR DELETE
  TO authenticated
  USING (public.user_owns_brand(brand_id) OR public.is_admin((select auth.uid())));

REVOKE ALL ON public.memory_items FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memory_items TO authenticated, service_role;


-- RESEARCH SOURCES
ALTER TABLE public.research_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "research_sources_owner_policy" ON public.research_sources;

CREATE POLICY "research_sources_select_policy"
  ON public.research_sources FOR SELECT
  TO authenticated
  USING (public.user_owns_brand(brand_id) OR public.is_admin((select auth.uid())));

CREATE POLICY "research_sources_insert_policy"
  ON public.research_sources FOR INSERT
  TO authenticated
  WITH CHECK (public.user_owns_brand(brand_id) OR public.is_admin((select auth.uid())));

CREATE POLICY "research_sources_update_policy"
  ON public.research_sources FOR UPDATE
  TO authenticated
  USING (public.user_owns_brand(brand_id) OR public.is_admin((select auth.uid())))
  WITH CHECK (public.user_owns_brand(brand_id) OR public.is_admin((select auth.uid())));

CREATE POLICY "research_sources_delete_policy"
  ON public.research_sources FOR DELETE
  TO authenticated
  USING (public.user_owns_brand(brand_id) OR public.is_admin((select auth.uid())));

REVOKE ALL ON public.research_sources FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.research_sources TO authenticated, service_role;


-- VIRAL SPARKS
ALTER TABLE public.viral_sparks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can select viral sparks" ON public.viral_sparks;
DROP POLICY IF EXISTS "Owners can insert viral sparks" ON public.viral_sparks;
DROP POLICY IF EXISTS "Owners can update viral sparks" ON public.viral_sparks;
DROP POLICY IF EXISTS "Owners can delete viral sparks" ON public.viral_sparks;

CREATE POLICY "viral_sparks_select_policy"
  ON public.viral_sparks FOR SELECT
  TO authenticated
  USING (public.user_owns_brand(brand_id) OR public.is_admin((select auth.uid())));

CREATE POLICY "viral_sparks_insert_policy"
  ON public.viral_sparks FOR INSERT
  TO authenticated
  WITH CHECK (public.user_owns_brand(brand_id) OR public.is_admin((select auth.uid())));

CREATE POLICY "viral_sparks_update_policy"
  ON public.viral_sparks FOR UPDATE
  TO authenticated
  USING (public.user_owns_brand(brand_id) OR public.is_admin((select auth.uid())))
  WITH CHECK (public.user_owns_brand(brand_id) OR public.is_admin((select auth.uid())));

CREATE POLICY "viral_sparks_delete_policy"
  ON public.viral_sparks FOR DELETE
  TO authenticated
  USING (public.user_owns_brand(brand_id) OR public.is_admin((select auth.uid())));

REVOKE ALL ON public.viral_sparks FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.viral_sparks TO authenticated, service_role;


-- PRODUCTIONS
ALTER TABLE public.productions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can select productions" ON public.productions;
DROP POLICY IF EXISTS "Owners can insert productions" ON public.productions;
DROP POLICY IF EXISTS "Owners can update productions" ON public.productions;
DROP POLICY IF EXISTS "Owners can delete productions" ON public.productions;
DROP POLICY IF EXISTS "productions_owner_policy" ON public.productions;

CREATE POLICY "productions_select_policy"
  ON public.productions FOR SELECT
  TO authenticated
  USING (public.user_owns_brand(brand_id) OR public.is_admin((select auth.uid())));

CREATE POLICY "productions_insert_policy"
  ON public.productions FOR INSERT
  TO authenticated
  WITH CHECK (public.user_owns_brand(brand_id) OR public.is_admin((select auth.uid())));

CREATE POLICY "productions_update_policy"
  ON public.productions FOR UPDATE
  TO authenticated
  USING (public.user_owns_brand(brand_id) OR public.is_admin((select auth.uid())))
  WITH CHECK (public.user_owns_brand(brand_id) OR public.is_admin((select auth.uid())));

CREATE POLICY "productions_delete_policy"
  ON public.productions FOR DELETE
  TO authenticated
  USING (public.user_owns_brand(brand_id) OR public.is_admin((select auth.uid())));

REVOKE ALL ON public.productions FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.productions TO authenticated, service_role;


-- REVIEW ITEMS
ALTER TABLE public.review_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can select review items" ON public.review_items;
DROP POLICY IF EXISTS "Owners can insert review items" ON public.review_items;
DROP POLICY IF EXISTS "Owners can update review items" ON public.review_items;
DROP POLICY IF EXISTS "Owners can delete review items" ON public.review_items;

CREATE POLICY "review_items_select_policy"
  ON public.review_items FOR SELECT
  TO authenticated
  USING (public.user_owns_brand(brand_id) OR public.is_admin((select auth.uid())));

CREATE POLICY "review_items_insert_policy"
  ON public.review_items FOR INSERT
  TO authenticated
  WITH CHECK (public.user_owns_brand(brand_id) OR public.is_admin((select auth.uid())));

CREATE POLICY "review_items_update_policy"
  ON public.review_items FOR UPDATE
  TO authenticated
  USING (public.user_owns_brand(brand_id) OR public.is_admin((select auth.uid())))
  WITH CHECK (public.user_owns_brand(brand_id) OR public.is_admin((select auth.uid())));

CREATE POLICY "review_items_delete_policy"
  ON public.review_items FOR DELETE
  TO authenticated
  USING (public.user_owns_brand(brand_id) OR public.is_admin((select auth.uid())));

REVOKE ALL ON public.review_items FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_items TO authenticated, service_role;


-- PUBLISH JOBS
ALTER TABLE public.publish_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can select publish jobs" ON public.publish_jobs;
DROP POLICY IF EXISTS "Owners can insert publish jobs" ON public.publish_jobs;
DROP POLICY IF EXISTS "Owners can update publish jobs" ON public.publish_jobs;
DROP POLICY IF EXISTS "Owners can delete publish jobs" ON public.publish_jobs;

CREATE POLICY "publish_jobs_select_policy"
  ON public.publish_jobs FOR SELECT
  TO authenticated
  USING (public.user_owns_brand(brand_id) OR public.is_admin((select auth.uid())));

CREATE POLICY "publish_jobs_insert_policy"
  ON public.publish_jobs FOR INSERT
  TO authenticated
  WITH CHECK (public.user_owns_brand(brand_id) OR public.is_admin((select auth.uid())));

CREATE POLICY "publish_jobs_update_policy"
  ON public.publish_jobs FOR UPDATE
  TO authenticated
  USING (public.user_owns_brand(brand_id) OR public.is_admin((select auth.uid())))
  WITH CHECK (public.user_owns_brand(brand_id) OR public.is_admin((select auth.uid())));

CREATE POLICY "publish_jobs_delete_policy"
  ON public.publish_jobs FOR DELETE
  TO authenticated
  USING (public.user_owns_brand(brand_id) OR public.is_admin((select auth.uid())));

REVOKE ALL ON public.publish_jobs FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.publish_jobs TO authenticated, service_role;


-- ANALYTICS SNAPSHOTS
ALTER TABLE public.analytics_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can select analytics snapshots" ON public.analytics_snapshots;
DROP POLICY IF EXISTS "Owners can insert analytics snapshots" ON public.analytics_snapshots;
DROP POLICY IF EXISTS "Owners can update analytics snapshots" ON public.analytics_snapshots;
DROP POLICY IF EXISTS "Owners can delete analytics snapshots" ON public.analytics_snapshots;

CREATE POLICY "analytics_snapshots_select_policy"
  ON public.analytics_snapshots FOR SELECT
  TO authenticated
  USING (public.user_owns_brand(brand_id) OR public.is_admin((select auth.uid())));

CREATE POLICY "analytics_snapshots_insert_policy"
  ON public.analytics_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (public.user_owns_brand(brand_id) OR public.is_admin((select auth.uid())));

CREATE POLICY "analytics_snapshots_update_policy"
  ON public.analytics_snapshots FOR UPDATE
  TO authenticated
  USING (public.user_owns_brand(brand_id) OR public.is_admin((select auth.uid())))
  WITH CHECK (public.user_owns_brand(brand_id) OR public.is_admin((select auth.uid())));

CREATE POLICY "analytics_snapshots_delete_policy"
  ON public.analytics_snapshots FOR DELETE
  TO authenticated
  USING (public.user_owns_brand(brand_id) OR public.is_admin((select auth.uid())));

REVOKE ALL ON public.analytics_snapshots FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analytics_snapshots TO authenticated, service_role;


-- ACCOUNTS (Platform Connections / OAuth)
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can select brand accounts" ON public.accounts;
DROP POLICY IF EXISTS "Owners can insert brand accounts" ON public.accounts;
DROP POLICY IF EXISTS "Owners can update brand accounts" ON public.accounts;
DROP POLICY IF EXISTS "Owners can delete brand accounts" ON public.accounts;
DROP POLICY IF EXISTS "accounts_owner_policy" ON public.accounts;

CREATE POLICY "accounts_select_policy"
  ON public.accounts FOR SELECT
  TO authenticated
  USING (public.user_owns_brand(brand_id) OR public.is_admin((select auth.uid())));

CREATE POLICY "accounts_insert_policy"
  ON public.accounts FOR INSERT
  TO authenticated
  WITH CHECK (public.user_owns_brand(brand_id) OR public.is_admin((select auth.uid())));

CREATE POLICY "accounts_update_policy"
  ON public.accounts FOR UPDATE
  TO authenticated
  USING (public.user_owns_brand(brand_id) OR public.is_admin((select auth.uid())))
  WITH CHECK (public.user_owns_brand(brand_id) OR public.is_admin((select auth.uid())));

CREATE POLICY "accounts_delete_policy"
  ON public.accounts FOR DELETE
  TO authenticated
  USING (public.user_owns_brand(brand_id) OR public.is_admin((select auth.uid())));

REVOKE ALL ON public.accounts FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated, service_role;


-- MEDIA ASSETS
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "media_assets_owner_policy" ON public.media_assets;

CREATE POLICY "media_assets_select_policy"
  ON public.media_assets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id::text = public.media_assets.uploaded_by
        AND (b.owner_id = (select auth.uid()) OR public.is_admin((select auth.uid())))
    )
  );

CREATE POLICY "media_assets_insert_policy"
  ON public.media_assets FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id::text = public.media_assets.uploaded_by
        AND (b.owner_id = (select auth.uid()) OR public.is_admin((select auth.uid())))
    )
  );

CREATE POLICY "media_assets_update_policy"
  ON public.media_assets FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id::text = public.media_assets.uploaded_by
        AND (b.owner_id = (select auth.uid()) OR public.is_admin((select auth.uid())))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id::text = public.media_assets.uploaded_by
        AND (b.owner_id = (select auth.uid()) OR public.is_admin((select auth.uid())))
    )
  );

CREATE POLICY "media_assets_delete_policy"
  ON public.media_assets FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id::text = public.media_assets.uploaded_by
        AND (b.owner_id = (select auth.uid()) OR public.is_admin((select auth.uid())))
    )
  );

REVOKE ALL ON public.media_assets FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_assets TO authenticated, service_role;


-- COUPONS (Narrow SELECT for authenticated, Admin-only mutation)
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Coupons readable by authenticated users" ON public.coupons;
DROP POLICY IF EXISTS "Only admins can manage coupons" ON public.coupons;

CREATE POLICY "coupons_select_policy"
  ON public.coupons FOR SELECT
  TO authenticated
  USING (active = true OR public.is_admin((select auth.uid())));

CREATE POLICY "coupons_admin_manage_policy"
  ON public.coupons FOR ALL
  TO authenticated
  USING (public.is_admin((select auth.uid())))
  WITH CHECK (public.is_admin((select auth.uid())));

REVOKE ALL ON public.coupons FROM anon, public;
REVOKE INSERT, UPDATE, DELETE ON public.coupons FROM authenticated;
GRANT SELECT ON public.coupons TO authenticated;
GRANT ALL ON public.coupons TO service_role;


-- CREDIT LEDGER (Read-only for owner, Admin-only manual insert, Append-only)
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own credit ledger" ON public.credit_ledger;
DROP POLICY IF EXISTS "Only admins can insert credit ledger" ON public.credit_ledger;

CREATE POLICY "credit_ledger_select_policy"
  ON public.credit_ledger FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()) OR public.is_admin((select auth.uid())));

CREATE POLICY "credit_ledger_admin_insert_policy"
  ON public.credit_ledger FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin((select auth.uid())));

REVOKE ALL ON public.credit_ledger FROM anon, public;
REVOKE UPDATE, DELETE ON public.credit_ledger FROM authenticated;
GRANT SELECT ON public.credit_ledger TO authenticated;
GRANT ALL ON public.credit_ledger TO service_role;


-- CREDIT RESERVATIONS (Read-only for owner, Mutation via Financial RPCs only)
ALTER TABLE public.credit_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own credit reservations" ON public.credit_reservations;

CREATE POLICY "credit_reservations_select_policy"
  ON public.credit_reservations FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()) OR public.is_admin((select auth.uid())));

REVOKE ALL ON public.credit_reservations FROM anon, public;
REVOKE INSERT, UPDATE, DELETE ON public.credit_reservations FROM authenticated;
GRANT SELECT ON public.credit_reservations TO authenticated;
GRANT ALL ON public.credit_reservations TO service_role;


-- ADMIN AUDIT LOG
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only admins can view and insert audit logs" ON public.admin_audit_log;

CREATE POLICY "admin_audit_log_policy"
  ON public.admin_audit_log FOR ALL
  TO authenticated
  USING (public.is_admin((select auth.uid())))
  WITH CHECK (public.is_admin((select auth.uid())));

REVOKE ALL ON public.admin_audit_log FROM anon, public;
GRANT ALL ON public.admin_audit_log TO service_role;


-- NOTIFICATIONS & PREFERENCES
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can select own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;

CREATE POLICY "notifications_select_policy"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "notifications_update_policy"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

REVOKE ALL ON public.notifications FROM anon, public;
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can select own notification preferences" ON public.notification_preferences;
DROP POLICY IF EXISTS "Users can update own notification preferences" ON public.notification_preferences;

CREATE POLICY "notification_preferences_select_policy"
  ON public.notification_preferences FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "notification_preferences_update_policy"
  ON public.notification_preferences FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

REVOKE ALL ON public.notification_preferences FROM anon, public;
GRANT SELECT, UPDATE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;


-- AUDIT LOGS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own audit logs" ON public.audit_logs;

CREATE POLICY "audit_logs_select_policy"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (
    user_id = (select auth.uid()) OR
    (brand_id IS NOT NULL AND public.user_owns_brand(brand_id)) OR
    public.is_admin((select auth.uid()))
  );

REVOKE ALL ON public.audit_logs FROM anon, public;
REVOKE UPDATE, DELETE ON public.audit_logs FROM authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;


-- PRODUCTION EVENTS (Phase 17 Table - Append-Only & Owner Scoped)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'production_events') THEN
    ALTER TABLE public.production_events ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Users can read own production events" ON public.production_events;
    DROP POLICY IF EXISTS "Users can insert own production events" ON public.production_events;

    CREATE POLICY "production_events_select_policy"
      ON public.production_events FOR SELECT
      TO authenticated
      USING (user_id = (select auth.uid()) OR public.is_admin((select auth.uid())));

    CREATE POLICY "production_events_insert_policy"
      ON public.production_events FOR INSERT
      TO authenticated
      WITH CHECK (user_id = (select auth.uid()) OR public.is_admin((select auth.uid())));

    REVOKE ALL ON public.production_events FROM anon, public;
    REVOKE UPDATE, DELETE ON public.production_events FROM authenticated;
    GRANT SELECT, INSERT ON public.production_events TO authenticated, service_role;
  END IF;
END $$;


-- ----------------------------------------------------------------------------
-- 3. STORAGE BUCKET HARDENING (Private Uploads & Scoped Access)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  -- Mark Spark bucket private if it exists
  UPDATE storage.buckets SET public = false WHERE id = 'Spark';

  -- Storage objects RLS
  DROP POLICY IF EXISTS "spark_bucket_authenticated_policy" ON storage.objects;

  CREATE POLICY "spark_bucket_authenticated_owner_policy" ON storage.objects
    FOR ALL
    TO authenticated
    USING (
      bucket_id = 'Spark' AND (
        -- Path format: <brand_id>/<filename> or <brand_id>/...
        public.user_owns_brand(NULLIF(split_part(name, '/', 1), '')::uuid) OR
        public.is_admin((select auth.uid()))
      )
    )
    WITH CHECK (
      bucket_id = 'Spark' AND (
        public.user_owns_brand(NULLIF(split_part(name, '/', 1), '')::uuid) OR
        public.is_admin((select auth.uid()))
      )
    );
END $$;


-- ----------------------------------------------------------------------------
-- 4. RLS PERFORMANCE OPTIMIZATION INDEXES
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_brands_owner_id ON public.brands(owner_id);
CREATE INDEX IF NOT EXISTS idx_characters_brand_id ON public.characters(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_rules_brand_id ON public.brand_rules(brand_id);
CREATE INDEX IF NOT EXISTS idx_memory_items_brand_id ON public.memory_items(brand_id);
CREATE INDEX IF NOT EXISTS idx_research_sources_brand_id ON public.research_sources(brand_id);
CREATE INDEX IF NOT EXISTS idx_viral_sparks_brand_id ON public.viral_sparks(brand_id);
CREATE INDEX IF NOT EXISTS idx_productions_brand_id ON public.productions(brand_id);
CREATE INDEX IF NOT EXISTS idx_review_items_brand_id ON public.review_items(brand_id);
CREATE INDEX IF NOT EXISTS idx_publish_jobs_brand_id ON public.publish_jobs(brand_id);
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_brand_id ON public.analytics_snapshots(brand_id);
CREATE INDEX IF NOT EXISTS idx_accounts_brand_id ON public.accounts(brand_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON public.notification_preferences(user_id);
