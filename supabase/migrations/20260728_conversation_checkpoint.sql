-- Migration: 20260728_conversation_checkpoint.sql
-- Description: Working memory snapshot & checkpoint extensions on executive_sessions

ALTER TABLE public.executive_sessions
  ADD COLUMN IF NOT EXISTS working_memory_snapshot jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS current_mission text,
  ADD COLUMN IF NOT EXISTS current_focus text,
  ADD COLUMN IF NOT EXISTS last_department text,
  ADD COLUMN IF NOT EXISTS last_ai_intent text,
  ADD COLUMN IF NOT EXISTS creative_context jsonb DEFAULT '{}'::jsonb;
