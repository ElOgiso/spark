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
