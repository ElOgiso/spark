-- Migration: 20260726_memory_taxonomy.sql
-- Description: Standardized Memory Taxonomy and Confirmation Fields

ALTER TABLE public.memory_items
  ADD COLUMN IF NOT EXISTS importance text DEFAULT 'MEDIUM' CHECK (importance IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  ADD COLUMN IF NOT EXISTS confirmed boolean DEFAULT false;

-- Create index on brand_id and category
CREATE INDEX IF NOT EXISTS idx_memory_items_category ON public.memory_items(brand_id, category);
