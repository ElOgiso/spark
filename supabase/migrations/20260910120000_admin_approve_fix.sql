-- ============================================================================
-- SPARK ADMIN APPROVAL RPC FIX
-- Migration: 20260910120000_admin_approve_fix.sql
-- ============================================================================

-- 1. Upgrade admin_set_access_status RPC with diagnostic row count & auto-creation
CREATE OR REPLACE FUNCTION public.admin_set_access_status(target_user_id uuid, new_status text)
RETURNS boolean AS $$
DECLARE
  caller_id uuid := auth.uid();
  rows_updated integer := 0;
BEGIN
  -- Security check: only verified admins can set access status
  IF NOT public.is_admin(caller_id) THEN
    RAISE EXCEPTION 'Unauthorized: only admins can set access status';
  END IF;

  IF new_status NOT IN ('pending_approval', 'active', 'banned', 'rejected') THEN
    RAISE EXCEPTION 'Invalid access status: %', new_status;
  END IF;

  -- 1) Attempt direct update on profiles
  UPDATE public.profiles
  SET access_status = new_status,
      access_reviewed_at = timezone('utc'::text, now()),
      access_reviewed_by = caller_id,
      updated_at = timezone('utc'::text, now())
  WHERE id = target_user_id;

  GET DIAGNOSTICS rows_updated = ROW_COUNT;

  -- 2) If 0 rows updated, verify if target exists in auth.users and create profile stub
  IF rows_updated = 0 THEN
    IF EXISTS (SELECT 1 FROM auth.users WHERE id = target_user_id) THEN
      INSERT INTO public.profiles (
        id,
        email,
        display_name,
        role,
        access_status,
        access_reviewed_at,
        access_reviewed_by,
        credit_balance,
        created_at,
        updated_at
      )
      SELECT 
        u.id,
        u.email,
        COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1), 'Creator'),
        'executive',
        new_status,
        timezone('utc'::text, now()),
        caller_id,
        CASE WHEN new_status = 'active' THEN 50 ELSE 0 END,
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
      FROM auth.users u
      WHERE u.id = target_user_id
      ON CONFLICT (id) DO UPDATE
      SET access_status = EXCLUDED.access_status,
          access_reviewed_at = EXCLUDED.access_reviewed_at,
          access_reviewed_by = EXCLUDED.access_reviewed_by,
          updated_at = EXCLUDED.updated_at;

      GET DIAGNOSTICS rows_updated = ROW_COUNT;
    END IF;
  END IF;

  -- 3) If still 0 rows updated, raise error so caller receives profile not found
  IF rows_updated = 0 THEN
    RAISE EXCEPTION 'profile not found';
  END IF;

  -- 4) Log to audit log upon confirmed row update
  INSERT INTO public.admin_audit_log (actor_id, action, target_user_id, meta)
  VALUES (caller_id, 'SET_ACCESS_STATUS', target_user_id, jsonb_build_object('status', new_status, 'rows_updated', rows_updated));

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
