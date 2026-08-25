-- ============================================================================
-- SPARK ADMIN CONTROLS & VIDEO CREDITS SCHEMA MIGRATION
-- ============================================================================

-- 1. Profiles Table Extension
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'executive' CHECK (role IN ('executive', 'admin')),
  ADD COLUMN IF NOT EXISTS access_status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (access_status IN ('pending_approval', 'active', 'banned', 'rejected')),
  ADD COLUMN IF NOT EXISTS credit_balance INTEGER NOT NULL DEFAULT 0 CHECK (credit_balance >= 0),
  ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Ensure existing legacy profiles remain active
UPDATE profiles 
SET access_status = 'active' 
WHERE access_status IS NULL OR access_status = '';

-- 2. Credit Ledger Table
CREATE TABLE IF NOT EXISTS credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  admin_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_credit_ledger_user_id ON credit_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_created_at ON credit_ledger(created_at DESC);

-- 3. Coupons Table
CREATE TABLE IF NOT EXISTS coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  max_redemptions INTEGER NOT NULL DEFAULT 1 CHECK (max_redemptions > 0),
  redeemed_count INTEGER NOT NULL DEFAULT 0 CHECK (redeemed_count >= 0),
  expires_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);

-- 4. Admin Audit Log Table
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target ON admin_audit_log(target_user_id);

-- 5. Row Level Security (RLS)
ALTER TABLE credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Helper function to check admin status in RLS
CREATE OR REPLACE FUNCTION is_admin(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_id 
      AND (role = 'admin' OR is_super_admin = TRUE)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policies for Credit Ledger
DROP POLICY IF EXISTS "Users can read own credit ledger" ON credit_ledger;
CREATE POLICY "Users can read own credit ledger"
  ON credit_ledger FOR SELECT
  USING (auth.uid() = user_id OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "Only admins can insert credit ledger" ON credit_ledger;
CREATE POLICY "Only admins can insert credit ledger"
  ON credit_ledger FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

-- Policies for Coupons
DROP POLICY IF EXISTS "Coupons readable by authenticated users" ON coupons;
CREATE POLICY "Coupons readable by authenticated users"
  ON coupons FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Only admins can manage coupons" ON coupons;
CREATE POLICY "Only admins can manage coupons"
  ON coupons FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Policies for Admin Audit Log
DROP POLICY IF EXISTS "Only admins can view and insert audit logs" ON admin_audit_log;
CREATE POLICY "Only admins can view and insert audit logs"
  ON admin_audit_log FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- ============================================================================
-- SEED / PROMOTION INSTRUCTION
-- Promote creator account to admin:
-- UPDATE profiles SET role = 'admin', is_super_admin = TRUE, access_status = 'active' WHERE email = '<YOUR_EMAIL>';
-- ============================================================================
