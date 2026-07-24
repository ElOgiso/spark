-- Migration: 20260725_executive_conversation_schema.sql
-- Description: Extend executive_conversation_messages with metadata & provider fields

ALTER TABLE public.executive_conversation_messages
  ADD COLUMN IF NOT EXISTS provider text DEFAULT 'spark-native',
  ADD COLUMN IF NOT EXISTS model text DEFAULT 'executive-v1',
  ADD COLUMN IF NOT EXISTS token_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS api_version text DEFAULT '2026-07',
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'assistant' CHECK (role IN ('assistant','user','system')),
  ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'conversation',
  ADD COLUMN IF NOT EXISTS department text DEFAULT 'Executive Director',
  ADD COLUMN IF NOT EXISTS importance text DEFAULT 'MEDIUM' CHECK (importance IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb;

-- Index for session-based message fetching
CREATE INDEX IF NOT EXISTS idx_exec_conv_session_id ON public.executive_conversation_messages(session_id);
