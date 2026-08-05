-- Migration for Super Spark Conversation Sessions (Phase 19C)
CREATE TABLE IF NOT EXISTS conversation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID,
  brand_id TEXT NOT NULL,
  user_id UUID,
  title TEXT NOT NULL DEFAULT 'New Executive Session',
  subtitle TEXT,
  category TEXT DEFAULT 'executive',
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast session lookup by brand
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_brand_id ON conversation_sessions(brand_id);
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_updated_at ON conversation_sessions(updated_at DESC);

-- Ensure session_id exists on executive_conversation_messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'executive_conversation_messages' AND column_name = 'session_id'
  ) THEN
    ALTER TABLE executive_conversation_messages ADD COLUMN session_id TEXT;
  END IF;
END $$;
