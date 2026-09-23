-- ============================================================================
-- SPARK PROFILES UPDATE POLICY WITH CHECK CONSOLIDATION
-- ============================================================================
-- Keep the GRANT migration (20260923011759_protect_profile_privileges.sql).
-- Add a follow-up WITH CHECK so users cannot change role, is_super_admin,
-- credit_balance, access_status. One UPDATE policy on public.profiles.

-- 1. Drop any legacy/duplicate UPDATE policies on public.profiles
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own display fields only" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;

-- 2. Create the single, authoritative UPDATE policy
CREATE POLICY "profiles_update_policy"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = id OR is_admin(auth.uid())
  )
  WITH CHECK (
    -- Admins retain update access
    is_admin(auth.uid()) OR (
      -- Regular users can only update their own row and CANNOT modify privileged columns
      auth.uid() = id AND
      role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()) AND
      is_super_admin = (SELECT p.is_super_admin FROM public.profiles p WHERE p.id = auth.uid()) AND
      credit_balance = (SELECT p.credit_balance FROM public.profiles p WHERE p.id = auth.uid()) AND
      access_status = (SELECT p.access_status FROM public.profiles p WHERE p.id = auth.uid())
    )
  );
