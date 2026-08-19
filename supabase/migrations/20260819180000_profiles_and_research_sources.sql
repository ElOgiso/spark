-- Migration: Add missing profiles columns & create research_sources table & RLS policies
-- Target: profiles, research_sources, brands, storage bucket Spark

-- 1) Upgrade profiles table with onboarding_complete and active_brand_id
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_complete boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS active_brand_id uuid NULL;

-- Add foreign key constraint if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_active_brand_id_fkey'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_active_brand_id_fkey
      FOREIGN KEY (active_brand_id) REFERENCES public.brands(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2) Create research_sources table if missing
CREATE TABLE IF NOT EXISTS public.research_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  platform text,
  url text,
  handle text,
  status text DEFAULT 'active',
  display_name text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for research_sources
CREATE INDEX IF NOT EXISTS idx_research_sources_brand_id ON public.research_sources(brand_id);
CREATE INDEX IF NOT EXISTS idx_research_sources_url ON public.research_sources(url);

-- Trigger for research_sources updated_at
DROP TRIGGER IF EXISTS tr_research_sources_updated_at ON public.research_sources;
CREATE TRIGGER tr_research_sources_updated_at
  BEFORE UPDATE ON public.research_sources
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 3) Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_sources ENABLE ROW LEVEL SECURITY;

-- 4) RLS Policies

-- Profiles Policies
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
CREATE POLICY "profiles_select_policy" ON public.profiles
  FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
CREATE POLICY "profiles_update_policy" ON public.profiles
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
CREATE POLICY "profiles_insert_policy" ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- Brands Policies (owner_id = auth.uid())
DROP POLICY IF EXISTS "brands_owner_policy" ON public.brands;
CREATE POLICY "brands_owner_policy" ON public.brands
  FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- Characters Policies (via user_owns_brand)
DROP POLICY IF EXISTS "characters_owner_policy" ON public.characters;
CREATE POLICY "characters_owner_policy" ON public.characters
  FOR ALL USING (public.user_owns_brand(brand_id)) WITH CHECK (public.user_owns_brand(brand_id));

-- Accounts Policies (via user_owns_brand)
DROP POLICY IF EXISTS "accounts_owner_policy" ON public.accounts;
CREATE POLICY "accounts_owner_policy" ON public.accounts
  FOR ALL USING (public.user_owns_brand(brand_id)) WITH CHECK (public.user_owns_brand(brand_id));

-- Productions Policies (via user_owns_brand)
DROP POLICY IF EXISTS "productions_owner_policy" ON public.productions;
CREATE POLICY "productions_owner_policy" ON public.productions
  FOR ALL USING (public.user_owns_brand(brand_id)) WITH CHECK (public.user_owns_brand(brand_id));

-- Research Sources Policies (via user_owns_brand)
DROP POLICY IF EXISTS "research_sources_owner_policy" ON public.research_sources;
CREATE POLICY "research_sources_owner_policy" ON public.research_sources
  FOR ALL USING (public.user_owns_brand(brand_id)) WITH CHECK (public.user_owns_brand(brand_id));

-- Storage Policies for bucket "Spark"
INSERT INTO storage.buckets (id, name, public)
VALUES ('Spark', 'Spark', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "spark_bucket_authenticated_policy" ON storage.objects;
CREATE POLICY "spark_bucket_authenticated_policy" ON storage.objects
  FOR ALL USING (bucket_id = 'Spark' AND auth.role() = 'authenticated')
  WITH CHECK (bucket_id = 'Spark' AND auth.role() = 'authenticated');
