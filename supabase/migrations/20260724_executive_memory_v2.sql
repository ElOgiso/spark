-- Migration: Executive Director Persistent Memory Layer (Version 2)
-- Renamed conversation table and added fields to memory_items. No executive_tasks or executive_notifications.

-- ============================================================
-- 1. Rename conversation table to executive_conversation_messages
-- ============================================================
-- If the old table exists (from previous phase), rename it; otherwise create new.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'conversation_messages') THEN
    ALTER TABLE public.conversation_messages RENAME TO executive_conversation_messages;
  ELSE
    CREATE TABLE IF NOT EXISTS public.executive_conversation_messages (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      brand_id      uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
      sender        text NOT NULL CHECK (sender IN ('user', 'spark')),
      text          text NOT NULL,
      metadata      jsonb DEFAULT '{}'::jsonb,
      created_at    timestamptz DEFAULT now()
    );
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_exec_conv_messages_brand
  ON public.executive_conversation_messages(brand_id, created_at ASC);

ALTER TABLE public.executive_conversation_messages ENABLE ROW LEVEL security;

CREATE POLICY "Users manage own executive conversation"
  ON public.executive_conversation_messages FOR ALL
  USING (brand_id IN (SELECT id FROM public.brands WHERE owner_id = auth.uid()));

-- ============================================================
-- 2. executive_sessions (unchanged)
-- ============================================================
-- Table already created in previous migration, no changes needed.

-- ============================================================
-- 3. executive_director_summaries – extended schema
-- ============================================================
ALTER TABLE public.executive_director_summaries
  ADD COLUMN IF NOT EXISTS current_obstacles jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS confidence double precision DEFAULT 1.0;

-- ============================================================
-- 4. memory_items – add categorisation columns
-- ============================================================
ALTER TABLE public.memory_items
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS importance integer,
  ADD COLUMN IF NOT EXISTS confidence integer,
  ADD COLUMN IF NOT EXISTS source text;

-- Ensure RLS (existing) remains.

-- Note: executive_tasks and executive_notifications are omitted per current phase.
