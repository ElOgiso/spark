-- ============================================================================
-- SPARK D-08 — DURABLE PRODUCTION ECONOMICS MIGRATION
-- Migration: 20260923100000_durable_production_economics.sql
-- ============================================================================

-- 1. Ensure Table Structure & Constraints
CREATE TABLE IF NOT EXISTS public.credit_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  generation_id TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  status TEXT NOT NULL CHECK (status IN ('RESERVED', 'CONSUMED', 'RELEASED', 'REFUNDED', 'PENDING_UNKNOWN')),
  consumed_amount INTEGER NOT NULL DEFAULT 0 CHECK (consumed_amount >= 0),
  released_amount INTEGER NOT NULL DEFAULT 0 CHECK (released_amount >= 0),
  idempotency_key TEXT NOT NULL UNIQUE,
  pricing_policy_version TEXT NOT NULL DEFAULT 'spark-credit-v1.0',
  estimated_provider_cost_usd NUMERIC(10, 6) DEFAULT 0,
  actual_provider_cost_usd NUMERIC(10, 6),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_credit_reservations_user_id ON public.credit_reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_reservations_generation_id ON public.credit_reservations(generation_id);
CREATE INDEX IF NOT EXISTS idx_credit_reservations_status ON public.credit_reservations(status);
CREATE INDEX IF NOT EXISTS idx_credit_reservations_idempotency ON public.credit_reservations(idempotency_key);

-- 2. Extend credit_ledger with traceability columns
ALTER TABLE public.credit_ledger
  ADD COLUMN IF NOT EXISTS reservation_id UUID REFERENCES public.credit_reservations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS generation_id TEXT,
  ADD COLUMN IF NOT EXISTS transaction_type TEXT DEFAULT 'ADMIN_ADJUSTMENT',
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 3. RLS Policies for Credit Reservations
ALTER TABLE public.credit_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own credit reservations" ON public.credit_reservations;
CREATE POLICY "Users can read own credit reservations"
  ON public.credit_reservations FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- 4. RPC: spark_reserve_credits (Atomic, FOR UPDATE locked, Idempotent, search_path = public)
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
  IF caller_id IS NOT NULL AND caller_id != p_user_id AND NOT public.is_admin(caller_id) THEN
    RAISE EXCEPTION 'Unauthorized: cannot reserve credits for another user';
  END IF;

  IF p_amount < 0 THEN
    RAISE EXCEPTION 'Invalid reservation amount: %', p_amount;
  END IF;

  SELECT * INTO v_existing FROM public.credit_reservations WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
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

-- 5. RPC: spark_settle_credits (Atomic, Safe Overage Check, search_path = public)
CREATE OR REPLACE FUNCTION public.spark_settle_credits(
  p_user_id UUID,
  p_reservation_id UUID,
  p_actual_amount INTEGER,
  p_idempotency_key TEXT,
  p_actual_provider_cost_usd NUMERIC DEFAULT 0,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB AS $$
DECLARE
  caller_id UUID := auth.uid();
  v_res public.credit_reservations%ROWTYPE;
  v_current_bal INTEGER;
  v_unused INTEGER;
  v_consumed INTEGER;
  v_overage INTEGER;
BEGIN
  IF caller_id IS NOT NULL AND caller_id != p_user_id AND NOT public.is_admin(caller_id) THEN
    RAISE EXCEPTION 'Unauthorized: cannot settle credits for another user';
  END IF;

  SELECT * INTO v_res FROM public.credit_reservations WHERE id = p_reservation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation not found: %', p_reservation_id;
  END IF;

  IF v_res.user_id != p_user_id THEN
    RAISE EXCEPTION 'Reservation user mismatch';
  END IF;

  IF v_res.status = 'CONSUMED' THEN
    RETURN jsonb_build_object(
      'id', v_res.id,
      'user_id', v_res.user_id,
      'generation_id', v_res.generation_id,
      'amount', v_res.amount,
      'status', v_res.status,
      'consumed_amount', v_res.consumed_amount,
      'released_amount', v_res.released_amount,
      'idempotent_replay', true
    );
  END IF;

  IF v_res.status != 'RESERVED' AND v_res.status != 'PENDING_UNKNOWN' THEN
    RAISE EXCEPTION 'Cannot settle reservation in status: %', v_res.status;
  END IF;

  IF p_actual_amount < 0 THEN
    RAISE EXCEPTION 'Invalid actual amount: %', p_actual_amount;
  END IF;

  v_consumed := p_actual_amount;
  IF p_actual_amount < v_res.amount THEN
    v_unused := v_res.amount - p_actual_amount;
    UPDATE public.profiles
    SET credit_balance = credit_balance + v_unused,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_user_id;

    INSERT INTO public.credit_ledger (
      user_id, delta, reason, reservation_id, generation_id, transaction_type, metadata
    )
    VALUES (
      p_user_id,
      v_unused,
      'SETTLEMENT_RELEASE_UNUSED: ' || v_res.generation_id || ' (' || v_unused || ' credits released)',
      v_res.id,
      v_res.generation_id,
      'RELEASE',
      p_metadata
    );
  ELSIF p_actual_amount > v_res.amount THEN
    v_unused := 0;
    v_overage := p_actual_amount - v_res.amount;

    SELECT credit_balance INTO v_current_bal
    FROM public.profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF v_current_bal < v_overage THEN
      RAISE EXCEPTION 'Insufficient credits for settlement overage: required %, available %', v_overage, v_current_bal;
    END IF;

    UPDATE public.profiles
    SET credit_balance = credit_balance - v_overage,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_user_id;

    INSERT INTO public.credit_ledger (
      user_id, delta, reason, reservation_id, generation_id, transaction_type, metadata
    )
    VALUES (
      p_user_id,
      -v_overage,
      'SETTLEMENT_OVERAGE: ' || v_res.generation_id || ' (' || v_overage || ' additional credits consumed)',
      v_res.id,
      v_res.generation_id,
      'CONSUMPTION',
      p_metadata
    );
  ELSE
    v_unused := 0;
  END IF;

  INSERT INTO public.credit_ledger (
    user_id, delta, reason, reservation_id, generation_id, transaction_type, metadata
  )
  VALUES (
    p_user_id,
    0,
    'SETTLEMENT_CONSUMED: ' || v_res.generation_id || ' (' || v_consumed || ' credits consumed, actual cost $' || COALESCE(p_actual_provider_cost_usd, 0) || ')',
    v_res.id,
    v_res.generation_id,
    'CONSUMPTION',
    p_metadata
  );

  UPDATE public.credit_reservations
  SET status = 'CONSUMED',
      consumed_amount = v_consumed,
      released_amount = v_unused,
      actual_provider_cost_usd = p_actual_provider_cost_usd,
      updated_at = timezone('utc'::text, now()),
      metadata = v_res.metadata || p_metadata
  WHERE id = v_res.id;

  RETURN jsonb_build_object(
    'id', v_res.id,
    'user_id', p_user_id,
    'generation_id', v_res.generation_id,
    'amount', v_res.amount,
    'status', 'CONSUMED',
    'consumed_amount', v_consumed,
    'released_amount', v_unused,
    'idempotent_replay', false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. RPC: spark_release_credits (Atomic, search_path = public)
CREATE OR REPLACE FUNCTION public.spark_release_credits(
  p_user_id UUID,
  p_reservation_id UUID,
  p_idempotency_key TEXT,
  p_reason TEXT DEFAULT 'cancelled_or_pre_acceptance_failure'
)
RETURNS JSONB AS $$
DECLARE
  caller_id UUID := auth.uid();
  v_res public.credit_reservations%ROWTYPE;
BEGIN
  IF caller_id IS NOT NULL AND caller_id != p_user_id AND NOT public.is_admin(caller_id) THEN
    RAISE EXCEPTION 'Unauthorized: cannot release credits for another user';
  END IF;

  SELECT * INTO v_res FROM public.credit_reservations WHERE id = p_reservation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation not found: %', p_reservation_id;
  END IF;

  IF v_res.user_id != p_user_id THEN
    RAISE EXCEPTION 'Reservation user mismatch';
  END IF;

  IF v_res.status = 'RELEASED' THEN
    RETURN jsonb_build_object(
      'id', v_res.id,
      'status', 'RELEASED',
      'released_amount', v_res.released_amount,
      'idempotent_replay', true
    );
  END IF;

  IF v_res.status != 'RESERVED' AND v_res.status != 'PENDING_UNKNOWN' THEN
    RAISE EXCEPTION 'Cannot release reservation in status: %', v_res.status;
  END IF;

  IF v_res.amount > 0 THEN
    UPDATE public.profiles
    SET credit_balance = credit_balance + v_res.amount,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_user_id;

    INSERT INTO public.credit_ledger (
      user_id, delta, reason, reservation_id, generation_id, transaction_type, metadata
    )
    VALUES (
      p_user_id,
      v_res.amount,
      'RELEASE: ' || v_res.generation_id || ' (' || p_reason || ')',
      v_res.id,
      v_res.generation_id,
      'RELEASE',
      jsonb_build_object('reason', p_reason, 'idempotency_key', p_idempotency_key)
    );
  END IF;

  UPDATE public.credit_reservations
  SET status = 'RELEASED',
      released_amount = v_res.amount,
      updated_at = timezone('utc'::text, now())
  WHERE id = v_res.id;

  RETURN jsonb_build_object(
    'id', v_res.id,
    'user_id', p_user_id,
    'generation_id', v_res.generation_id,
    'amount', v_res.amount,
    'status', 'RELEASED',
    'consumed_amount', 0,
    'released_amount', v_res.amount,
    'idempotent_replay', false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 7. RPC: spark_mark_pending_unknown (Atomic, search_path = public)
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
  IF caller_id IS NOT NULL AND caller_id != p_user_id AND NOT public.is_admin(caller_id) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_res FROM public.credit_reservations WHERE id = p_reservation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation not found: %', p_reservation_id;
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

-- 8. RPC: spark_refund_credits (Atomic, Idempotent, search_path = public)
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
  IF caller_id IS NOT NULL AND caller_id != p_user_id AND NOT public.is_admin(caller_id) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Refund amount must be positive: %', p_amount;
  END IF;

  SELECT * INTO v_res FROM public.credit_reservations WHERE id = p_reservation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation not found: %', p_reservation_id;
  END IF;

  -- Idempotent replay: if reservation is already REFUNDED, return without double crediting
  IF v_res.status = 'REFUNDED' THEN
    RETURN jsonb_build_object(
      'id', v_res.id,
      'status', 'REFUNDED',
      'refund_amount', p_amount,
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

-- 9. Grants on Financial Functions
GRANT EXECUTE ON FUNCTION public.spark_reserve_credits(UUID, TEXT, INTEGER, TEXT, TEXT, NUMERIC, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.spark_settle_credits(UUID, UUID, INTEGER, TEXT, NUMERIC, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.spark_release_credits(UUID, UUID, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.spark_mark_pending_unknown(UUID, UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.spark_refund_credits(UUID, UUID, INTEGER, TEXT, TEXT) TO authenticated, service_role;
