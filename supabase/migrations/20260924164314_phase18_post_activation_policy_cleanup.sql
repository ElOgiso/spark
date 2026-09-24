-- =============================================================================
-- Phase 18 Post-Activation Policy Cleanup
-- =============================================================================
-- Applied to live Supabase (jaqzjhabmtvqtvinoafq) as 20260924154504
-- after post-migration advisor verification exposed legacy policy names
-- the original Phase 18 migration did not remove.
--
-- This migration is idempotent: DROP IF EXISTS on already-removed policies
-- and CREATE OR REPLACE / IF NOT EXISTS on already-created policies.
-- =============================================================================

-- ─── 1. Drop 11 legacy policies the Phase 18 migration missed ───────────────

DROP POLICY IF EXISTS "admin_manage_coupons" ON public.coupons;
DROP POLICY IF EXISTS "Admin insert coupons" ON public.coupons;
DROP POLICY IF EXISTS "Admin update coupons" ON public.coupons;
DROP POLICY IF EXISTS "coupons_admin_insert" ON public.coupons;
DROP POLICY IF EXISTS "coupons_admin_update" ON public.coupons;
DROP POLICY IF EXISTS "Users read active coupons" ON public.coupons;
DROP POLICY IF EXISTS "coupons_authenticated_select" ON public.coupons;
DROP POLICY IF EXISTS "Admin read credit_ledger" ON public.credit_ledger;
DROP POLICY IF EXISTS "credit_ledger_own_select" ON public.credit_ledger;
DROP POLICY IF EXISTS "Admin manage admin_audit_log" ON public.admin_audit_log;
DROP POLICY IF EXISTS "admin_audit_log_admin_all" ON public.admin_audit_log;

-- ─── 2. Create 3 coupon admin policies that Phase 18 defined ────────────────
--        (use IF NOT EXISTS so re-running is safe)

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'coupons' AND policyname = 'coupons_admin_insert_v2'
  ) THEN
    CREATE POLICY "coupons_admin_insert_v2" ON public.coupons
      FOR INSERT TO authenticated
      WITH CHECK (public.is_admin(auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'coupons' AND policyname = 'coupons_admin_update_v2'
  ) THEN
    CREATE POLICY "coupons_admin_update_v2" ON public.coupons
      FOR UPDATE TO authenticated
      USING (public.is_admin(auth.uid()))
      WITH CHECK (public.is_admin(auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'coupons' AND policyname = 'coupons_admin_delete_v2'
  ) THEN
    CREATE POLICY "coupons_admin_delete_v2" ON public.coupons
      FOR DELETE TO authenticated
      USING (public.is_admin(auth.uid()));
  END IF;
END $$;

-- ─── 3. Harden set_updated_at trigger function search_path ──────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
