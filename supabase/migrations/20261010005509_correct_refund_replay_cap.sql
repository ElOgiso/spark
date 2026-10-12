-- Applied as 20261010005509 on the production project.
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

  -- Idempotent replay: if reservation is already REFUNDED, return without double crediting
  IF v_res.status = 'REFUNDED' THEN
    IF (v_res.metadata->>'refund_amount')::integer IS DISTINCT FROM p_amount OR v_res.metadata->>'refund_idempotency_key' IS DISTINCT FROM p_idempotency_key THEN
      RAISE EXCEPTION 'Refund replay parameters differ';
    END IF;
    RETURN jsonb_build_object(
      'id', v_res.id,
      'status', 'REFUNDED',
      'refund_amount', (v_res.metadata->>'refund_amount')::integer,
      'idempotent_replay', true
    );
  END IF;

  IF p_amount > (CASE WHEN v_res.status IN ('CONSUMED','REFUNDED') THEN COALESCE(v_res.consumed_amount,0) ELSE v_res.amount-COALESCE(v_res.released_amount,0) END) THEN
    RAISE EXCEPTION 'Refund exceeds held or consumed credits';
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
