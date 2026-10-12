-- Applied as 20261010005334 on the production project.
-- Phase 21R: conversation_sessions was not on the live project (PostgREST 404).
-- The earlier migration created a UUID id and no RLS. Client session ids are text.
-- This migration creates the table if needed, aligns id to text, and locks it to the owner.

CREATE TABLE IF NOT EXISTS public.conversation_sessions (
  id TEXT PRIMARY KEY,
  workspace_id UUID,
  brand_id TEXT NOT NULL,
  user_id UUID,
  title TEXT NOT NULL DEFAULT 'New Executive Session',
  subtitle TEXT,
  category TEXT DEFAULT 'executive',
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'conversation_sessions'
      AND column_name = 'id'
      AND data_type = 'uuid'
  ) THEN
    ALTER TABLE public.conversation_sessions ALTER COLUMN id TYPE TEXT USING id::text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_conversation_sessions_brand_id ON public.conversation_sessions(brand_id);
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_user_id ON public.conversation_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_updated_at ON public.conversation_sessions(updated_at DESC);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'executive_conversation_messages'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'executive_conversation_messages'
      AND column_name = 'session_id'
  ) THEN
    ALTER TABLE public.executive_conversation_messages ADD COLUMN session_id TEXT;
  END IF;
END $$;

ALTER TABLE public.conversation_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversation_sessions_select_own" ON public.conversation_sessions;
CREATE POLICY "conversation_sessions_select_own"
  ON public.conversation_sessions
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id OR public.is_admin((select auth.uid())));

DROP POLICY IF EXISTS "conversation_sessions_insert_own" ON public.conversation_sessions;
CREATE POLICY "conversation_sessions_insert_own"
  ON public.conversation_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "conversation_sessions_update_own" ON public.conversation_sessions;
CREATE POLICY "conversation_sessions_update_own"
  ON public.conversation_sessions
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id OR public.is_admin((select auth.uid())))
  WITH CHECK ((select auth.uid()) = user_id OR public.is_admin((select auth.uid())));

DROP POLICY IF EXISTS "conversation_sessions_delete_own" ON public.conversation_sessions;
CREATE POLICY "conversation_sessions_delete_own"
  ON public.conversation_sessions
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id OR public.is_admin((select auth.uid())));

REVOKE ALL ON public.conversation_sessions FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_sessions TO authenticated;
GRANT ALL ON public.conversation_sessions TO service_role;

-- Restore the existing runtime contracts without replacing canonical media_assets.
CREATE TABLE IF NOT EXISTS public.executive_sessions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), brand_id UUID NOT NULL UNIQUE REFERENCES public.brands(id) ON DELETE CASCADE,
 active_production_id TEXT, active_scene INTEGER, active_department TEXT,
 last_screen TEXT NOT NULL DEFAULT 'home', last_summary TEXT, last_activity TEXT,
 conversation_checkpoint TEXT, working_memory_snapshot JSONB, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.executive_director_summaries (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), brand_id UUID NOT NULL UNIQUE REFERENCES public.brands(id) ON DELETE CASCADE,
 brand_summary TEXT, mission TEXT, goals JSONB NOT NULL DEFAULT '[]', audience TEXT, voice_archetype TEXT,
 character_name TEXT, publishing_platforms JSONB NOT NULL DEFAULT '[]', automation_mode TEXT,
 current_objectives JSONB NOT NULL DEFAULT '[]', pending_tasks JSONB NOT NULL DEFAULT '[]', updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.executive_timeline (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
 session_id TEXT, type TEXT NOT NULL, description TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS executive_timeline_brand_created_idx ON public.executive_timeline(brand_id,created_at DESC);
-- Migration: Create Unified Production Assets Table & Storage Buckets for SPARK Media OS
-- Target: production_assets

CREATE TABLE IF NOT EXISTS production_assets (
  id TEXT PRIMARY KEY,
  brand_id TEXT,
  production_id TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('image', 'frame', 'storyboard', 'video', 'audio', 'thumbnail')),
  provider TEXT,
  storage_bucket TEXT DEFAULT 'Spark',
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

ALTER TABLE public.executive_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.executive_sessions FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.executive_sessions TO authenticated;
GRANT ALL ON public.executive_sessions TO service_role;
CREATE POLICY executive_sessions_owner ON public.executive_sessions FOR ALL TO authenticated USING (public.user_owns_brand(brand_id) OR public.is_admin((select auth.uid()))) WITH CHECK (public.user_owns_brand(brand_id) OR public.is_admin((select auth.uid())));

ALTER TABLE public.executive_director_summaries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.executive_director_summaries FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.executive_director_summaries TO authenticated;
GRANT ALL ON public.executive_director_summaries TO service_role;
CREATE POLICY executive_director_summaries_owner ON public.executive_director_summaries FOR ALL TO authenticated USING (public.user_owns_brand(brand_id) OR public.is_admin((select auth.uid()))) WITH CHECK (public.user_owns_brand(brand_id) OR public.is_admin((select auth.uid())));

ALTER TABLE public.executive_timeline ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.executive_timeline FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.executive_timeline TO authenticated;
GRANT ALL ON public.executive_timeline TO service_role;
CREATE POLICY executive_timeline_owner ON public.executive_timeline FOR ALL TO authenticated USING (public.user_owns_brand(brand_id) OR public.is_admin((select auth.uid()))) WITH CHECK (public.user_owns_brand(brand_id) OR public.is_admin((select auth.uid())));

ALTER TABLE public.production_assets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.production_assets FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_assets TO authenticated;
GRANT ALL ON public.production_assets TO service_role;
CREATE POLICY production_assets_owner ON public.production_assets FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.brands b WHERE b.id::text = production_assets.brand_id::text AND b.owner_id = (select auth.uid())) OR public.is_admin((select auth.uid()))) WITH CHECK (EXISTS (SELECT 1 FROM public.brands b WHERE b.id::text = production_assets.brand_id::text AND b.owner_id = (select auth.uid())) OR public.is_admin((select auth.uid())));

-- Text comparisons support canonical brands/<uuid>/... and older brand/production prefixes.
-- Invoker semantics retain RLS on brands, productions and media_assets.
CREATE OR REPLACE FUNCTION public.spark_can_access_storage_path(object_path TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
 SELECT public.is_admin((select auth.uid())) OR EXISTS (
   SELECT 1 FROM public.brands b WHERE b.owner_id = (select auth.uid()) AND
    (b.id::text = CASE WHEN split_part(object_path,'/',1)='brands' THEN split_part(object_path,'/',2) ELSE split_part(object_path,'/',1) END
     OR EXISTS (SELECT 1 FROM public.productions p WHERE p.brand_id=b.id AND p.id::text=split_part(object_path,'/',1))
     OR EXISTS (SELECT 1 FROM public.media_assets m WHERE m.uploaded_by=b.id::text AND m.storage_bucket='Spark' AND m.storage_path=object_path))
 );
$$;
REVOKE ALL ON FUNCTION public.spark_can_access_storage_path(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spark_can_access_storage_path(TEXT) TO authenticated, service_role;
DROP POLICY IF EXISTS spark_bucket_all_policy ON storage.objects;
DROP POLICY IF EXISTS spark_bucket_authenticated_owner_policy ON storage.objects;
CREATE POLICY spark_bucket_authenticated_owner_policy ON storage.objects FOR ALL TO authenticated
 USING (bucket_id='Spark' AND public.spark_can_access_storage_path(name))
 WITH CHECK (bucket_id='Spark' AND public.spark_can_access_storage_path(name));

CREATE OR REPLACE FUNCTION public.spark_reserve_credits(
  p_user_id UUID,
  p_generation_id TEXT,
  p_amount INTEGER,
  p_idempotency_key TEXT,
  p_pricing_policy_version TEXT DEFAULT 'spark-credit-v1.0',
  p_estimated_provider_cost_usd NUMERIC DEFAULT 0,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB AS $$
DECLARE
  caller_id UUID := auth.uid();
  v_current_bal INTEGER;
  v_existing public.credit_reservations%ROWTYPE;
  v_reservation_id UUID;
BEGIN
  IF caller_id IS NULL AND (auth.jwt()->>'role') IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF caller_id IS NOT NULL AND caller_id != p_user_id AND NOT public.is_admin(caller_id) THEN
    RAISE EXCEPTION 'Unauthorized: cannot reserve credits for another user';
  END IF;

  IF p_amount < 0 THEN
    RAISE EXCEPTION 'Invalid reservation amount: %', p_amount;
  END IF;

  SELECT * INTO v_existing FROM public.credit_reservations WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_existing.user_id IS DISTINCT FROM p_user_id THEN
      RAISE EXCEPTION 'Idempotency key belongs to another user';
    END IF;
    IF v_existing.generation_id IS DISTINCT FROM p_generation_id OR v_existing.amount IS DISTINCT FROM p_amount THEN
      RAISE EXCEPTION 'Idempotency key parameters differ';
    END IF;
    RETURN jsonb_build_object(
      'id', v_existing.id,
      'user_id', v_existing.user_id,
      'generation_id', v_existing.generation_id,
      'amount', v_existing.amount,
      'status', v_existing.status,
      'consumed_amount', v_existing.consumed_amount,
      'released_amount', v_existing.released_amount,
      'idempotent_replay', true
    );
  END IF;

  SELECT credit_balance INTO v_current_bal
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_current_bal IS NULL THEN
    RAISE EXCEPTION 'User profile not found: %', p_user_id;
  END IF;

  IF v_current_bal < p_amount THEN
    RAISE EXCEPTION 'Insufficient credits: requested %, available %', p_amount, v_current_bal;
  END IF;

  UPDATE public.profiles
  SET credit_balance = credit_balance - p_amount,
      updated_at = timezone('utc'::text, now())
  WHERE id = p_user_id;

  INSERT INTO public.credit_reservations (
    user_id, generation_id, amount, status, idempotency_key,
    pricing_policy_version, estimated_provider_cost_usd, metadata
  )
  VALUES (
    p_user_id, p_generation_id, p_amount, 'RESERVED', p_idempotency_key,
    p_pricing_policy_version, p_estimated_provider_cost_usd, p_metadata
  )
  RETURNING id INTO v_reservation_id;

  INSERT INTO public.credit_ledger (
    user_id, delta, reason, reservation_id, generation_id, transaction_type, metadata
  )
  VALUES (
    p_user_id,
    -p_amount,
    'RESERVATION: ' || p_generation_id || ' (' || p_amount || ' credits reserved)',
    v_reservation_id,
    p_generation_id,
    'RESERVATION',
    p_metadata
  );

  RETURN jsonb_build_object(
    'id', v_reservation_id,
    'user_id', p_user_id,
    'generation_id', p_generation_id,
    'amount', p_amount,
    'status', 'RESERVED',
    'consumed_amount', 0,
    'released_amount', 0,
    'idempotent_replay', false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.spark_mark_pending_unknown(
  p_user_id UUID,
  p_reservation_id UUID,
  p_reason TEXT DEFAULT 'unknown_provider_outcome'
)
RETURNS JSONB AS $$
DECLARE
  caller_id UUID := auth.uid();
  v_res public.credit_reservations%ROWTYPE;
BEGIN
  IF caller_id IS NULL AND (auth.jwt()->>'role') IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF caller_id IS NOT NULL AND caller_id != p_user_id AND NOT public.is_admin(caller_id) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_res FROM public.credit_reservations WHERE id = p_reservation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation not found: %', p_reservation_id;
  END IF;
  IF v_res.user_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Reservation owner mismatch';
  END IF;

  IF v_res.status = 'PENDING_UNKNOWN' THEN
    RETURN jsonb_build_object('id', v_res.id, 'status', 'PENDING_UNKNOWN', 'idempotent_replay', true);
  END IF;

  IF v_res.status != 'RESERVED' THEN
    RAISE EXCEPTION 'Cannot mark % as PENDING_UNKNOWN', v_res.status;
  END IF;

  UPDATE public.credit_reservations
  SET status = 'PENDING_UNKNOWN',
      updated_at = timezone('utc'::text, now()),
      metadata = v_res.metadata || jsonb_build_object('pending_reason', p_reason)
  WHERE id = v_res.id;

  INSERT INTO public.credit_ledger (
    user_id, delta, reason, reservation_id, generation_id, transaction_type, metadata
  )
  VALUES (
    p_user_id,
    0,
    'HOLD_PROTECTED: ' || v_res.generation_id || ' (PENDING_UNKNOWN: ' || p_reason || ')',
    v_res.id,
    v_res.generation_id,
    'PENDING_UNKNOWN',
    jsonb_build_object('reason', p_reason)
  );

  RETURN jsonb_build_object('id', v_res.id, 'status', 'PENDING_UNKNOWN', 'idempotent_replay', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.spark_refund_credits(
  p_user_id UUID,
  p_reservation_id UUID,
  p_amount INTEGER,
  p_idempotency_key TEXT,
  p_reason TEXT DEFAULT 'reconciliation_refund'
)
RETURNS JSONB AS $$
DECLARE
  caller_id UUID := auth.uid();
  v_res public.credit_reservations%ROWTYPE;
BEGIN
  IF caller_id IS NULL AND (auth.jwt()->>'role') IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF caller_id IS NOT NULL AND caller_id != p_user_id AND NOT public.is_admin(caller_id) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF caller_id IS NOT NULL AND NOT public.is_admin(caller_id) THEN
    RAISE EXCEPTION 'Refund requires administrator reconciliation';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Refund amount must be positive: %', p_amount;
  END IF;

  SELECT * INTO v_res FROM public.credit_reservations WHERE id = p_reservation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation not found: %', p_reservation_id;
  END IF;
  IF v_res.user_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Reservation owner mismatch';
  END IF;

  IF p_amount > (CASE WHEN v_res.status IN ('CONSUMED','REFUNDED') THEN COALESCE(v_res.consumed_amount,0) ELSE v_res.amount-COALESCE(v_res.released_amount,0) END) THEN
    RAISE EXCEPTION 'Refund exceeds held or consumed credits';
  END IF;
  -- Idempotent replay: if reservation is already REFUNDED, return without double crediting
  IF v_res.status = 'REFUNDED' THEN
    RETURN jsonb_build_object(
      'id', v_res.id,
      'status', 'REFUNDED',
      'refund_amount', (v_res.metadata->>'refund_amount')::integer,
      'idempotent_replay', true
    );
  END IF;

  IF v_res.status != 'CONSUMED' AND v_res.status != 'PENDING_UNKNOWN' THEN
    RAISE EXCEPTION 'Cannot refund reservation in status: %', v_res.status;
  END IF;

  UPDATE public.profiles
  SET credit_balance = credit_balance + p_amount,
      updated_at = timezone('utc'::text, now())
  WHERE id = p_user_id;

  INSERT INTO public.credit_ledger (
    user_id, delta, reason, reservation_id, generation_id, transaction_type, metadata
  )
  VALUES (
    p_user_id,
    p_amount,
    'REFUND: ' || v_res.generation_id || ' (' || p_reason || ')',
    v_res.id,
    v_res.generation_id,
    'REFUND',
    jsonb_build_object('reason', p_reason, 'idempotency_key', p_idempotency_key)
  );

  UPDATE public.credit_reservations
  SET status = 'REFUNDED',
      updated_at = timezone('utc'::text, now()),
      metadata = v_res.metadata || jsonb_build_object('refund_amount', p_amount, 'refund_reason', p_reason, 'refund_idempotency_key', p_idempotency_key)
  WHERE id = v_res.id;

  RETURN jsonb_build_object(
    'id', v_res.id,
    'status', 'REFUNDED',
    'refund_amount', p_amount,
    'idempotent_replay', false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

NOTIFY pgrst, 'reload schema';
