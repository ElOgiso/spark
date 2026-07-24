-- Migration: 20260727_executive_timeline.sql
-- Description: Executive Timeline Table for Creator Milestones

CREATE TABLE IF NOT EXISTS public.executive_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.executive_sessions(id) ON DELETE SET NULL,
  type text NOT NULL,
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exec_timeline_brand_id ON public.executive_timeline(brand_id);
ALTER TABLE public.executive_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access timeline for their brand"
  ON public.executive_timeline
  FOR ALL
  USING (user_owns_brand(brand_id))
  WITH CHECK (user_owns_brand(brand_id));
