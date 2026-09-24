-- ============================================================================
-- SPARK PHASE 17 — DURABLE PRODUCTION OBSERVABILITY EVENTS MIGRATION
-- Migration: 20260924135502_production_observability_events.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.production_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  brand_id TEXT,
  production_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  task_id TEXT,
  scene_id TEXT,
  shot_id TEXT,
  execution_id TEXT,
  provider_job_id TEXT,
  provider_id TEXT,
  model_id TEXT,
  attempt INTEGER,
  asset_id TEXT,
  reservation_id UUID REFERENCES public.credit_reservations(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for high-performance correlation and trace reconstruction
CREATE INDEX IF NOT EXISTS idx_production_events_prod_id_occurred_at 
  ON public.production_events(production_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_production_events_task_id 
  ON public.production_events(task_id) WHERE task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_production_events_execution_id 
  ON public.production_events(execution_id) WHERE execution_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_production_events_user_id 
  ON public.production_events(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_production_events_event_type 
  ON public.production_events(event_type);
CREATE INDEX IF NOT EXISTS idx_production_events_reservation_id 
  ON public.production_events(reservation_id) WHERE reservation_id IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE public.production_events ENABLE ROW LEVEL SECURITY;

-- Read policy: Users read their own events or admin
DROP POLICY IF EXISTS "Users can read own production events" ON public.production_events;
CREATE POLICY "Users can read own production events"
  ON public.production_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- Insert policy: Users insert their own events or admin (NO anon insert permitted)
DROP POLICY IF EXISTS "Users can insert own production events" ON public.production_events;
CREATE POLICY "Users can insert own production events"
  ON public.production_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- Enforce append-only semantics by denying UPDATE and DELETE to authenticated and anon
REVOKE ALL ON public.production_events FROM anon, public;
REVOKE UPDATE, DELETE ON public.production_events FROM authenticated;
GRANT SELECT, INSERT ON public.production_events TO authenticated, service_role;
