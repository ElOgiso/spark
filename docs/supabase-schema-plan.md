# Supabase-Ready Schema Planning

This document outlines the PostgreSQL database schema planned for Spark, configured for integration with Supabase. It includes table definitions, relationships, Row Level Security (RLS) policies, and MVP readiness indicators.

## Database Overview
Spark is a multi-tenant AI-native Media Operating System. All user-authored content and brand configurations are scoped to a **User Account (profile)** and mapped to a **Brand**.

---

## Table Definitions

### 1. profiles
- **Purpose**: Extends Supabase auth.users for application-specific user metadata.
- **Key Fields**:
  - `id` (uuid, primary key, references auth.users.id)
  - `email` (text, unique, not null)
  - `full_name` (text)
  - `avatar_url` (text)
  - `created_at` (timestamp with time zone, default now())
  - `updated_at` (timestamp with time zone, default now())
- **Relationships**: One-to-one with `auth.users`.
- **Owner/User Relationship**: Owned by the auth user.
- **RLS Requirement**: `id = auth.uid()`. Users can read and update only their own profile.
- **MVP Status**: MVP now.

### 2. brands
- **Purpose**: Represents a media brand operated by one or more users.
- **Key Fields**:
  - `id` (uuid, primary key, default gen_random_uuid())
  - `owner_id` (uuid, references profiles.id, not null)
  - `name` (text, not null)
  - `niche` (text)
  - `archetype` (text)
  - `purpose` (text)
  - `content_pillars` (jsonb, default '[]'::jsonb) — stores list of `{label: text, active: boolean}`
  - `tone` (jsonb, default '[]'::jsonb) — stores list of `{label: text, active: boolean}`
  - `audience_primary` (text)
  - `audience_pain_points` (text[]) — array of pain points
  - `audience_desires` (text[]) — array of desires
  - `created_at` (timestamp with time zone, default now())
  - `updated_at` (timestamp with time zone, default now())
- **Relationships**: Belongs to a profile (`owner_id`).
- **Owner/User Relationship**: Scoped to owner profile.
- **RLS Requirement**: `owner_id = auth.uid()` for read/write.
- **MVP Status**: MVP now.

### 3. characters
- **Purpose**: Defines the virtual character/host hosting the brand's production.
- **Key Fields**:
  - `id` (uuid, primary key, default gen_random_uuid())
  - `brand_id` (uuid, references brands.id, not null, unique)
  - `name` (text, not null)
  - `role` (text)
  - `style` (text)
  - `traits` (text[])
  - `voice_name` (text)
  - `voice_language` (text)
  - `voice_tone` (text)
  - `voice_locked` (boolean, default true)
  - `created_at` (timestamp with time zone, default now())
- **Relationships**: One-to-one with `brands`.
- **Owner/User Relationship**: Indirectly owned by user through `brand_id -> owner_id`.
- **RLS Requirement**: Accessible if user owns the associated `brand_id`.
- **MVP Status**: MVP now.

### 4. niches
- **Purpose**: Standardized list of niche segments for brands to align content topics.
- **Key Fields**:
  - `id` (uuid, primary key, default gen_random_uuid())
  - `name` (text, unique, not null)
  - `description` (text)
  - `created_at` (timestamp with time zone, default now())
- **Relationships**: Many-to-many lookup for brands, or reference helper.
- **Owner/User Relationship**: Public read-only; write restricted to Admin role.
- **RLS Requirement**: Read allowed for all authenticated users.
- **MVP Status**: Later phase.

### 5. audio_identities
- **Purpose**: Holds configurations for synthetic audio and voices trained or assigned to characters.
- **Key Fields**:
  - `id` (uuid, primary key, default gen_random_uuid())
  - `character_id` (uuid, references characters.id, not null, unique)
  - `voice_model_provider` (text, default 'elevenlabs')
  - `voice_model_id` (text, not null)
  - `sample_url` (text)
  - `settings` (jsonb) — voice parameters (stability, clarity)
- **Relationships**: One-to-one with `characters`.
- **Owner/User Relationship**: Indirect ownership via character/brand.
- **RLS Requirement**: Accessible only if user owns the parent brand.
- **MVP Status**: Later phase.

### 6. accounts
- **Purpose**: Social media channel integration links.
- **Key Fields**:
  - `id` (uuid, primary key, default gen_random_uuid())
  - `brand_id` (uuid, references brands.id, not null)
  - `platform` (text, not null) — 'YouTube', 'TikTok', 'Instagram', 'LinkedIn', 'Twitter/X'
  - `handle` (text, not null)
  - `status` (text, not null) — 'connected', 'disconnected'
  - `posts_count` (integer, default 0)
  - `access_token` (text) — encrypted token
  - `refresh_token` (text) — encrypted token
  - `expires_at` (timestamp with time zone)
- **Relationships**: Many-to-one with `brands`.
- **Owner/User Relationship**: Scoped to owned brands.
- **RLS Requirement**: Read/write accessible only to users who own the brand.
- **MVP Status**: MVP now (for connection status); tokens in Later phase.

### 7. production_modes
- **Purpose**: Production presets that control video duration, aspect ratios, and export outputs.
- **Key Fields**:
  - `id` (text, primary key) — e.g. 'express', 'standard', 'deep'
  - `label` (text, not null)
  - `description` (text)
  - `estimated_duration` (text)
- **Relationships**: Static lookup table.
- **Owner/User Relationship**: Public read-only.
- **RLS Requirement**: All authenticated users can read.
- **MVP Status**: MVP now (mocked statically, database read later).

### 8. automation_settings
- **Purpose**: Stores brand-specific parameters detailing how autonomous AI is in production and publishing.
- **Key Fields**:
  - `id` (uuid, primary key, default gen_random_uuid())
  - `brand_id` (uuid, references brands.id, not null, unique)
  - `automation_mode` (text, default 'balanced') — 'manual', 'balanced', 'autonomous'
  - `review_required` (boolean, default true)
  - `publish_requires_approval` (boolean, default true)
  - `autonomous_publishing_enabled` (boolean, default false)
  - `sensitive_content_rules` (text[])
  - `account_specific_rules` (jsonb)
  - `platform_specific_permissions` (jsonb)
- **Relationships**: One-to-one with `brands`.
- **Owner/User Relationship**: Scoped to owned brand.
- **RLS Requirement**: Read/write if user owns the associated brand.
- **MVP Status**: MVP now.

### 9. viral_sparks
- **Purpose**: Dynamic viral concept suggestions created by Spark's predictive trend engine.
- **Key Fields**:
  - `id` (uuid, primary key, default gen_random_uuid())
  - `brand_id` (uuid, references brands.id, not null)
  - `title` (text, not null)
  - `why_now` (text)
  - `platforms` (text, not null)
  - `hook` (text)
  - `views` (text)
  - `velocity` (text)
  - `platform_fit` (text)
  - `brand_fit_score` (integer)
  - `category` (text) — 'hot', 'rising', 'niche'
  - `time_window` (text)
  - `production_time` (text)
  - `angle` (text)
  - `created_at` (timestamp with time zone, default now())
- **Relationships**: Many-to-one with `brands`.
- **Owner/User Relationship**: Scoped to owned brand.
- **RLS Requirement**: Accessible only if user owns the parent brand.
- **MVP Status**: MVP now.

### 10. productions
- **Purpose**: Actual content production workflows stemming from viral sparks or custom ideas.
- **Key Fields**:
  - `id` (uuid, primary key, default gen_random_uuid())
  - `brand_id` (uuid, references brands.id, not null)
  - `spark_id` (uuid, references viral_sparks.id)
  - `title` (text, not null)
  - `status` (text, not null) — 'Drafting', 'Ready for Review', 'Approved', 'Needs Edit', 'Published', 'Failed'
  - `mode` (text, not null) — 'express', 'standard', 'deep'
  - `aspect_ratio` (text) — '16:9', '9:16', '1:1'
  - `formats` (text[])
  - `scenes` (jsonb, default '[]'::jsonb) — stores list of `{scene: integer, description: text, duration: text}`
  - `date_created` (date, default current_date)
  - `updated_at` (timestamp with time zone, default now())
- **Relationships**: Belongs to `brand`, optionally references `viral_sparks`.
- **Owner/User Relationship**: Scoped to owned brand.
- **RLS Requirement**: Accessible if user owns the parent brand.
- **MVP Status**: MVP now.

### 11. review_items
- **Purpose**: Holds production deliverables prepared for final approval or editing iterations.
- **Key Fields**:
  - `id` (uuid, primary key, default gen_random_uuid())
  - `production_id` (uuid, references productions.id, not null, unique)
  - `title` (text, not null)
  - `account` (text, not null)
  - `series` (text)
  - `status` (text, not null) — 'Pending Review', 'Approved', 'Needs Edit'
  - `script_snippet` (text)
  - `concept_text` (text)
  - `opening_moment` (text)
  - `created_at` (timestamp with time zone, default now())
- **Relationships**: One-to-one with `productions`.
- **Owner/User Relationship**: Scoped to owned brand.
- **RLS Requirement**: Accessible if user owns the parent brand.
- **MVP Status**: MVP now.

### 12. publish_jobs
- **Purpose**: Scheduled or ready-to-publish social postings linked to approved content.
- **Key Fields**:
  - `id` (uuid, primary key, default gen_random_uuid())
  - `production_id` (uuid, references productions.id, not null)
  - `title` (text, not null)
  - `platform` (text, not null)
  - `scheduled_time` (text, not null)
  - `status` (text, not null) — 'Scheduled', 'Export Ready', 'Published', 'Failed', 'Needs Review'
  - `published_at` (timestamp with time zone)
- **Relationships**: Belongs to `productions`.
- **Owner/User Relationship**: Scoped to owned brand.
- **RLS Requirement**: Accessible if user owns the parent brand.
- **MVP Status**: MVP now.

### 13. export_packages
- **Purpose**: Bundled media assets generated and optimized for user download.
- **Key Fields**:
  - `id` (uuid, primary key, default gen_random_uuid())
  - `production_id` (uuid, references productions.id, not null)
  - `title` (text, not null)
  - `size` (text, not null)
  - `formats` (text[])
  - `ready_at` (text, not null)
  - `download_url` (text)
- **Relationships**: Belongs to `productions`.
- **Owner/User Relationship**: Scoped to owned brand.
- **RLS Requirement**: Accessible if user owns the parent brand.
- **MVP Status**: MVP now.

### 14. analytics_insights
- **Purpose**: Algorithmic performance metrics, insights, and recommendations tracked for the brand.
- **Key Fields**:
  - `id` (uuid, primary key, default gen_random_uuid())
  - `brand_id` (uuid, references brands.id, not null)
  - `title` (text, not null)
  - `description` (text)
  - `metric` (text)
  - `change` (text)
  - `type` (text, not null) — 'worked', 'failed', 'learning'
  - `best_hook` (text)
  - `best_format` (text)
  - `best_platform_fit` (text)
  - `created_at` (timestamp with time zone, default now())
- **Relationships**: Belongs to `brands`.
- **Owner/User Relationship**: Scoped to owned brand.
- **RLS Requirement**: Accessible if user owns the parent brand.
- **MVP Status**: MVP now.

### 15. memory_items
- **Purpose**: High-retention rules and learned guidelines feed back into future script generations.
- **Key Fields**:
  - `id` (uuid, primary key, default gen_random_uuid())
  - `brand_id` (uuid, references brands.id, not null)
  - `type` (text, not null) — 'learned', 'rule'
  - `text` (text, not null)
  - `date_added` (date, default current_date)
- **Relationships**: Belongs to `brands`.
- **Owner/User Relationship**: Scoped to owned brand.
- **RLS Requirement**: Accessible if user owns the parent brand.
- **MVP Status**: MVP now.

### 16. assets
- **Purpose**: Media repository files (voice samples, PDFs, logos, video b-roll) uploaded for brand use.
- **Key Fields**:
  - `id` (uuid, primary key, default gen_random_uuid())
  - `brand_id` (uuid, references brands.id, not null)
  - `name` (text, not null)
  - `type` (text, not null) — 'video', 'audio', 'image', 'document'
  - `size` (text, not null)
  - `url` (text, not null)
  - `uploaded_at` (timestamp with time zone, default now())
- **Relationships**: Belongs to `brands`.
- **Owner/User Relationship**: Scoped to owned brand.
- **RLS Requirement**: Accessible if user owns the parent brand.
- **MVP Status**: MVP now.

### 17. quality_checks
- **Purpose**: Validation and safety flags for production scripts before approval gates.
- **Key Fields**:
  - `id` (uuid, primary key, default gen_random_uuid())
  - `review_item_id` (uuid, references review_items.id, not null, unique)
  - `brand_safety` (text, default 'Passed') — 'Passed', 'Warning', 'Failed'
  - `policy_check` (text, default 'Passed') — 'Passed', 'Warning', 'Failed'
  - `technical_check` (text, default 'Passed') — 'Passed', 'Warning', 'Failed'
  - `details` (jsonb) — specific flags or issues flagged
- **Relationships**: One-to-one with `review_items`.
- **Owner/User Relationship**: Scoped to owned brand.
- **RLS Requirement**: Accessible if user owns parent brand.
- **MVP Status**: MVP now.

### 18. legal_pages
- **Purpose**: Dynamic legal compliance terms & privacy page settings managed by the admin or system.
- **Key Fields**:
  - `slug` (text, primary key) — e.g. 'terms', 'privacy'
  - `title` (text, not null)
  - `content` (text, not null)
  - `last_updated` (timestamp with time zone, default now())
- **Relationships**: Independent system tables.
- **Owner/User Relationship**: Public read-only.
- **RLS Requirement**: Read accessible to anyone.
- **MVP Status**: Later phase.

### 19. seo_settings
- **Purpose**: Global application index settings, private router exclusion headers, and metadata triggers.
- **Key Fields**:
  - `route` (text, primary key) — e.g. '/', '/my-spark', '/terms'
  - `title` (text, not null)
  - `description` (text)
  - `noindex` (boolean, default false)
  - `og_image_url` (text)
- **Relationships**: Independent lookup tables.
- **Owner/User Relationship**: Public read-only.
- **RLS Requirement**: Read accessible to anyone.
- **MVP Status**: Later phase.

### 20. audit_logs
- **Purpose**: Holds tamper-evident log registers tracking all high-stakes publishing actions, token requests, and settings edits.
- **Key Fields**:
  - `id` (uuid, primary key, default gen_random_uuid())
  - `user_id` (uuid, references profiles.id)
  - `brand_id` (uuid, references brands.id)
  - `action` (text, not null) — e.g. 'publish_content', 'update_automation_settings'
  - `details` (jsonb)
  - `ip_address` (text)
  - `created_at` (timestamp with time zone, default now())
- **Relationships**: Many-to-one with `profiles` and `brands`.
- **Owner/User Relationship**: Scoped to owned brand.
- **RLS Requirement**: Read accessible to owner.
- **MVP Status**: MVP now (for accountability logging).

---

## Row Level Security (RLS) Policy Blueprint (PostgreSQL DDL)

To enforce strict user scoping in Supabase, the following structure will be applied:

```sql
-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE viral_sparks ENABLE ROW LEVEL SECURITY;
ALTER TABLE productions ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE publish_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Users can view own profile." ON profiles 
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile." ON profiles 
  FOR UPDATE USING (auth.uid() = id);

-- Brands Policies (Core scoping)
CREATE POLICY "Users can view owned brands." ON brands 
  FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can update owned brands." ON brands 
  FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Users can insert own brands." ON brands 
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- Scoped access helper function
CREATE OR REPLACE FUNCTION user_owns_brand(brand_uuid uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM brands 
    WHERE id = brand_uuid AND owner_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Productions Scoped Policies
CREATE POLICY "Users can view brand productions." ON productions 
  FOR SELECT USING (user_owns_brand(brand_id));
CREATE POLICY "Users can manage brand productions." ON productions 
  FOR ALL USING (user_owns_brand(brand_id));

-- Memory Items Scoped Policies
CREATE POLICY "Users can view brand memories." ON memory_items 
  FOR SELECT USING (user_owns_brand(brand_id));
CREATE POLICY "Users can manage brand memories." ON memory_items 
  FOR ALL USING (user_owns_brand(brand_id));
```
