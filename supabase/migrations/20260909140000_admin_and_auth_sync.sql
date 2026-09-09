-- ============================================================================
-- SPARK UNIFIED ADMIN CONTROLS, AUTH SYNC & CREDIT DISTRIBUTION MIGRATION
-- Migration: 20260909140000_admin_and_auth_sync.sql
-- ============================================================================

-- 1. Extend public.profiles Table with Admin & Credit Columns
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'executive' CHECK (role IN ('executive', 'admin')),
  ADD COLUMN IF NOT EXISTS access_status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (access_status IN ('pending_approval', 'active', 'banned', 'rejected')),
  ADD COLUMN IF NOT EXISTS access_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS access_reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS credit_balance INTEGER NOT NULL DEFAULT 50 CHECK (credit_balance >= 0),
  ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Ensure existing legacy profiles remain active with starting credit balance
UPDATE public.profiles 
SET access_status = 'active' 
WHERE access_status IS NULL OR access_status = '';

UPDATE public.profiles
SET credit_balance = 50
WHERE credit_balance IS NULL;

-- 2. Create Credit Ledger Table
CREATE TABLE IF NOT EXISTS public.credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_credit_ledger_user_id ON public.credit_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_created_at ON public.credit_ledger(created_at DESC);

-- 3. Create Coupons Table
CREATE TABLE IF NOT EXISTS public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  max_redemptions INTEGER NOT NULL DEFAULT 1 CHECK (max_redemptions > 0),
  redeemed_count INTEGER NOT NULL DEFAULT 0 CHECK (redeemed_count >= 0),
  expires_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_coupons_code ON public.coupons(code);

-- 4. Create Admin Audit Log Table
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON public.admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target ON public.admin_audit_log(target_user_id);

-- 5. Helper Function: is_admin(user_id) (SECURITY DEFINER)
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

-- 6. Automatic Auth.Users -> Public.Profiles Sync Trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    display_name,
    email,
    role,
    access_status,
    credit_balance,
    is_super_admin,
    created_at,
    updated_at
  ) VALUES (
    new.id,
    COALESCE(
      new.raw_user_meta_data->>'display_name',
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1),
      'Spark Director'
    ),
    new.email,
    'executive',
    'pending_approval',
    50,
    FALSE,
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = timezone('utc'::text, now());
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. Backfill Stranded Users from auth.users into public.profiles
INSERT INTO public.profiles (
  id, display_name, email, role, access_status, credit_balance, is_super_admin, created_at, updated_at
)
SELECT 
  u.id,
  COALESCE(
    u.raw_user_meta_data->>'display_name',
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    split_part(u.email, '@', 1),
    'Spark Director'
  ),
  u.email,
  'executive',
  'pending_approval',
  50,
  FALSE,
  COALESCE(u.created_at, timezone('utc'::text, now())),
  timezone('utc'::text, now())
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 8. Row Level Security (RLS) Configuration
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile or admins read all" ON public.profiles;
CREATE POLICY "Users can read own profile or admins read all"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own display fields only" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own display fields or admins update all" ON public.profiles;
CREATE POLICY "Users can update own display fields or admins update all"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id OR public.is_admin(auth.uid()))
  WITH CHECK (
    public.is_admin(auth.uid()) OR
    auth.uid() = id
  );

DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile or admins insert" ON public.profiles;
CREATE POLICY "Users can insert own profile or admins insert"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id OR public.is_admin(auth.uid()));

-- Credit Ledger Policies
DROP POLICY IF EXISTS "Users can read own credit ledger" ON public.credit_ledger;
CREATE POLICY "Users can read own credit ledger"
  ON public.credit_ledger FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Only admins can insert credit ledger" ON public.credit_ledger;
CREATE POLICY "Only admins can insert credit ledger"
  ON public.credit_ledger FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

-- Coupons Policies
DROP POLICY IF EXISTS "Coupons readable by authenticated users" ON public.coupons;
CREATE POLICY "Coupons readable by authenticated users"
  ON public.coupons FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Only admins can manage coupons" ON public.coupons;
CREATE POLICY "Only admins can manage coupons"
  ON public.coupons FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Admin Audit Log Policies
DROP POLICY IF EXISTS "Only admins can view and insert audit logs" ON public.admin_audit_log;
CREATE POLICY "Only admins can view and insert audit logs"
  ON public.admin_audit_log FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 9. Server RPCs for Admin Controls (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.admin_set_access_status(target_user_id uuid, new_status text)
RETURNS boolean AS $$
DECLARE
  caller_id uuid := auth.uid();
BEGIN
  IF NOT public.is_admin(caller_id) THEN
    RAISE EXCEPTION 'Unauthorized: only admins can set access status';
  END IF;

  IF new_status NOT IN ('pending_approval', 'active', 'banned', 'rejected') THEN
    RAISE EXCEPTION 'Invalid access status: %', new_status;
  END IF;

  UPDATE public.profiles
  SET access_status = new_status,
      access_reviewed_at = timezone('utc'::text, now()),
      access_reviewed_by = caller_id,
      updated_at = timezone('utc'::text, now())
  WHERE id = target_user_id;

  INSERT INTO public.admin_audit_log (actor_id, action, target_user_id, meta)
  VALUES (caller_id, 'SET_ACCESS_STATUS', target_user_id, jsonb_build_object('status', new_status));

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.admin_adjust_credits(target_user_id uuid, delta integer, reason text)
RETURNS integer AS $$
DECLARE
  caller_id uuid := auth.uid();
  current_bal integer;
  new_bal integer;
BEGIN
  IF NOT public.is_admin(caller_id) THEN
    RAISE EXCEPTION 'Unauthorized: only admins can adjust credits';
  END IF;

  SELECT credit_balance INTO current_bal FROM public.profiles WHERE id = target_user_id;
  IF current_bal IS NULL THEN
    current_bal := 0;
  END IF;

  new_bal := GREATEST(0, current_bal + delta);

  UPDATE public.profiles
  SET credit_balance = new_bal,
      updated_at = timezone('utc'::text, now())
  WHERE id = target_user_id;

  INSERT INTO public.credit_ledger (user_id, admin_id, delta, reason)
  VALUES (target_user_id, caller_id, delta, reason);

  INSERT INTO public.admin_audit_log (actor_id, action, target_user_id, meta)
  VALUES (caller_id, 'ADJUST_CREDITS', target_user_id, jsonb_build_object(
    'previous_balance', current_bal,
    'delta', delta,
    'new_balance', new_bal,
    'reason', reason
  ));

  RETURN new_bal;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execution to authenticated users (functions verify is_admin internally)
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_access_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_credits(uuid, integer, text) TO authenticated;
