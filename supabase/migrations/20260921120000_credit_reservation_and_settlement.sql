-- ============================================================================
-- SPARK CREDIT RESERVATION & SETTLEMENT MIGRATION
-- ============================================================================

-- 1. Create Credit Reservations Table
CREATE TABLE IF NOT EXISTS credit_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_credit_reservations_user_id ON credit_reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_reservations_generation_id ON credit_reservations(generation_id);
CREATE INDEX IF NOT EXISTS idx_credit_reservations_status ON credit_reservations(status);
CREATE INDEX IF NOT EXISTS idx_credit_reservations_idempotency ON credit_reservations(idempotency_key);

-- 2. Extend Credit Ledger with Traceability Columns
ALTER TABLE credit_ledger
  ADD COLUMN IF NOT EXISTS reservation_id UUID REFERENCES credit_reservations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS generation_id TEXT,
  ADD COLUMN IF NOT EXISTS transaction_type TEXT DEFAULT 'ADMIN_ADJUSTMENT',
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 3. Row Level Security for Credit Reservations
ALTER TABLE credit_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own credit reservations" ON credit_reservations;
CREATE POLICY "Users can read own credit reservations"
  ON credit_reservations FOR SELECT
  USING (auth.uid() = user_id OR is_admin(auth.uid()));

-- Direct insert/update/delete blocked from client queries; must use SECURITY DEFINER RPCs

-- 4. RPC: Atomic Credit Reservation
CREATE OR REPLACE FUNCTION spark_reserve_credits(
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
  v_existing credit_reservations%ROWTYPE;
  v_reservation_id UUID;
BEGIN
  IF caller_id IS NOT NULL AND caller_id != p_user_id AND NOT is_admin(caller_id) THEN
    RAISE EXCEPTION 'Unauthorized: cannot reserve credits for another user';
  END IF;

  IF p_amount < 0 THEN
    RAISE EXCEPTION 'Invalid reservation amount: %', p_amount;
  END IF;

  SELECT * INTO v_existing FROM credit_reservations WHERE idempotency_key = p_idempotency_key;
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
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_current_bal IS NULL THEN
    RAISE EXCEPTION 'User profile not found: %', p_user_id;
  END IF;

  IF v_current_bal < p_amount THEN
    RAISE EXCEPTION 'Insufficient credits: requested %, available %', p_amount, v_current_bal;
  END IF;

  UPDATE profiles
  SET credit_balance = credit_balance - p_amount,
      updated_at = timezone('utc'::text, now())
  WHERE id = p_user_id;

  INSERT INTO credit_reservations (
    user_id, generation_id, amount, status, idempotency_key,
    pricing_policy_version, estimated_provider_cost_usd, metadata
  )
  VALUES (
    p_user_id, p_generation_id, p_amount, 'RESERVED', p_idempotency_key,
    p_pricing_policy_version, p_estimated_provider_cost_usd, p_metadata
  )
  RETURNING id INTO v_reservation_id;

  INSERT INTO credit_ledger (
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RPC: Atomic Credit Settlement
CREATE OR REPLACE FUNCTION spark_settle_credits(
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
  v_res credit_reservations%ROWTYPE;
  v_unused INTEGER;
  v_consumed INTEGER;
BEGIN
  IF caller_id IS NOT NULL AND caller_id != p_user_id AND NOT is_admin(caller_id) THEN
    RAISE EXCEPTION 'Unauthorized: cannot settle credits for another user';
  END IF;

  SELECT * INTO v_res FROM credit_reservations WHERE id = p_reservation_id FOR UPDATE;
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
    UPDATE profiles
    SET credit_balance = credit_balance + v_unused,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_user_id;

    INSERT INTO credit_ledger (
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
    UPDATE profiles
    SET credit_balance = GREATEST(0, credit_balance - (p_actual_amount - v_res.amount)),
        updated_at = timezone('utc'::text, now())
    WHERE id = p_user_id;

    INSERT INTO credit_ledger (
      user_id, delta, reason, reservation_id, generation_id, transaction_type, metadata
    )
    VALUES (
      p_user_id,
      -(p_actual_amount - v_res.amount),
      'SETTLEMENT_OVERAGE: ' || v_res.generation_id || ' (' || (p_actual_amount - v_res.amount) || ' additional credits consumed)',
      v_res.id,
      v_res.generation_id,
      'CONSUMPTION',
      p_metadata
    );
  ELSE
    v_unused := 0;
  END IF;

  INSERT INTO credit_ledger (
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

  UPDATE credit_reservations
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. RPC: Atomic Credit Release
CREATE OR REPLACE FUNCTION spark_release_credits(
  p_user_id UUID,
  p_reservation_id UUID,
  p_idempotency_key TEXT,
  p_reason TEXT DEFAULT 'cancelled_or_pre_acceptance_failure'
)
RETURNS JSONB AS $$
DECLARE
  caller_id UUID := auth.uid();
  v_res credit_reservations%ROWTYPE;
BEGIN
  IF caller_id IS NOT NULL AND caller_id != p_user_id AND NOT is_admin(caller_id) THEN
    RAISE EXCEPTION 'Unauthorized: cannot release credits for another user';
  END IF;

  SELECT * INTO v_res FROM credit_reservations WHERE id = p_reservation_id FOR UPDATE;
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
    UPDATE profiles
    SET credit_balance = credit_balance + v_res.amount,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_user_id;

    INSERT INTO credit_ledger (
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

  UPDATE credit_reservations
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. RPC: Mark Pending Unknown
CREATE OR REPLACE FUNCTION spark_mark_pending_unknown(
  p_user_id UUID,
  p_reservation_id UUID,
  p_reason TEXT DEFAULT 'unknown_provider_outcome'
)
RETURNS JSONB AS $$
DECLARE
  caller_id UUID := auth.uid();
  v_res credit_reservations%ROWTYPE;
BEGIN
  IF caller_id IS NOT NULL AND caller_id != p_user_id AND NOT is_admin(caller_id) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_res FROM credit_reservations WHERE id = p_reservation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation not found: %', p_reservation_id;
  END IF;

  IF v_res.status = 'PENDING_UNKNOWN' THEN
    RETURN jsonb_build_object('id', v_res.id, 'status', 'PENDING_UNKNOWN', 'idempotent_replay', true);
  END IF;

  IF v_res.status != 'RESERVED' THEN
    RAISE EXCEPTION 'Cannot mark % as PENDING_UNKNOWN', v_res.status;
  END IF;

  UPDATE credit_reservations
  SET status = 'PENDING_UNKNOWN',
      updated_at = timezone('utc'::text, now()),
      metadata = v_res.metadata || jsonb_build_object('pending_reason', p_reason)
  WHERE id = v_res.id;

  INSERT INTO credit_ledger (
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. RPC: Atomic Refund
CREATE OR REPLACE FUNCTION spark_refund_credits(
  p_user_id UUID,
  p_reservation_id UUID,
  p_amount INTEGER,
  p_idempotency_key TEXT,
  p_reason TEXT DEFAULT 'reconciliation_refund'
)
RETURNS JSONB AS $$
DECLARE
  caller_id UUID := auth.uid();
  v_res credit_reservations%ROWTYPE;
BEGIN
  IF caller_id IS NOT NULL AND caller_id != p_user_id AND NOT is_admin(caller_id) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Refund amount must be positive: %', p_amount;
  END IF;

  SELECT * INTO v_res FROM credit_reservations WHERE id = p_reservation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation not found: %', p_reservation_id;
  END IF;

  IF v_res.status != 'CONSUMED' AND v_res.status != 'PENDING_UNKNOWN' THEN
    RAISE EXCEPTION 'Cannot refund reservation in status: %', v_res.status;
  END IF;

  UPDATE profiles
  SET credit_balance = credit_balance + p_amount,
      updated_at = timezone('utc'::text, now())
  WHERE id = p_user_id;

  INSERT INTO credit_ledger (
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

  UPDATE credit_reservations
  SET status = 'REFUNDED',
      updated_at = timezone('utc'::text, now()),
      metadata = v_res.metadata || jsonb_build_object('refund_amount', p_amount, 'refund_reason', p_reason)
  WHERE id = v_res.id;

  RETURN jsonb_build_object(
    'id', v_res.id,
    'status', 'REFUNDED',
    'refund_amount', p_amount,
    'idempotent_replay', false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
