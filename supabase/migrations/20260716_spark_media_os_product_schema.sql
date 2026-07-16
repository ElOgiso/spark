-- SPARK Media OS product schema (safe apply on existing SPARK project)
-- Coexists with earlier publisher-core tables; does not drop them.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- profiles already exists; extend only
alter table public.profiles add column if not exists avatar_url text;

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  niche text,
  archetype text,
  purpose text,
  audience jsonb not null default '{}'::jsonb,
  tone jsonb not null default '[]'::jsonb,
  content_pillars jsonb not null default '[]'::jsonb,
  automation_mode text not null default 'balanced' check (automation_mode in ('manual', 'balanced', 'autonomous')),
  review_required boolean not null default true,
  publish_requires_approval boolean not null default true,
  autonomous_publishing_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.user_owns_brand(brand_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.brands
    where id = brand_uuid
      and owner_id = auth.uid()
  );
$$;

create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null,
  role text,
  appearance jsonb not null default '{}'::jsonb,
  personality jsonb not null default '{}'::jsonb,
  voice jsonb not null default '{}'::jsonb,
  consistency_rules jsonb not null default '[]'::jsonb,
  generation_rules jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.brand_rules (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  category text,
  rule text not null,
  reason text,
  confidence text,
  source text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memory_items (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  category text not null check (
    category in (
      'character','voice','brand','niche','audio','winning_hooks','winning_thumbnails',
      'audience_preferences','failures','publishing_behavior'
    )
  ),
  title text not null,
  description text,
  source text,
  confidence text,
  evidence jsonb not null default '{}'::jsonb,
  affected_systems jsonb not null default '[]'::jsonb,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  platform text not null,
  handle text,
  display_name text,
  status text,
  permissions jsonb not null default '{}'::jsonb,
  connected_at timestamptz,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.viral_sparks (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  title text not null,
  opportunity text,
  why_now text,
  audience_fit text,
  brand_fit text,
  hook_potential text,
  confidence text,
  risk text,
  expected_outcome text,
  evidence jsonb not null default '{}'::jsonb,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.productions (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  viral_spark_id uuid references public.viral_sparks(id),
  title text not null,
  production_mode text not null check (production_mode in ('narrator', 'hybrid', 'cinematic')),
  status text,
  brief jsonb not null default '{}'::jsonb,
  assets jsonb not null default '[]'::jsonb,
  reasoning jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.review_items (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  production_id uuid not null references public.productions(id) on delete cascade,
  status text,
  decision text,
  quality_score numeric,
  confidence text,
  risk text,
  notes text,
  reasoning jsonb not null default '{}'::jsonb,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.publish_jobs (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  production_id uuid not null references public.productions(id) on delete cascade,
  account_id uuid references public.accounts(id),
  platform text,
  scheduled_for timestamptz,
  status text,
  caption text,
  metadata jsonb not null default '{}'::jsonb,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.analytics_snapshots (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  production_id uuid references public.productions(id),
  platform text,
  metrics jsonb not null default '{}'::jsonb,
  insight text,
  recommendation text,
  learned_memory_id uuid references public.memory_items(id),
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text,
  title text not null,
  description text,
  priority text,
  read boolean not null default false,
  related_route text,
  action_label text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  review_reminders boolean not null default true,
  production_updates boolean not null default true,
  publishing_alerts boolean not null default true,
  viral_opportunities boolean not null default true,
  analytics_insights boolean not null default true,
  memory_updates boolean not null default true,
  system_updates boolean not null default true,
  marketing_updates boolean not null default false,
  quiet_hours jsonb not null default '{}'::jsonb,
  push_enabled boolean not null default false,
  email_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  brand_id uuid references public.brands(id),
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists brands_owner_id_idx on public.brands(owner_id);
create index if not exists characters_brand_id_idx on public.characters(brand_id);
create index if not exists brand_rules_brand_id_idx on public.brand_rules(brand_id);
create index if not exists memory_items_brand_id_idx on public.memory_items(brand_id);
create index if not exists accounts_brand_id_idx on public.accounts(brand_id);
create index if not exists viral_sparks_brand_id_idx on public.viral_sparks(brand_id);
create index if not exists productions_brand_id_idx on public.productions(brand_id);
create index if not exists review_items_brand_id_idx on public.review_items(brand_id);
create index if not exists publish_jobs_brand_id_idx on public.publish_jobs(brand_id);
create index if not exists analytics_snapshots_brand_id_idx on public.analytics_snapshots(brand_id);
create index if not exists notifications_user_id_idx on public.notifications(user_id);
create index if not exists audit_logs_user_id_idx on public.audit_logs(user_id);

-- RLS for SPARK product tables
alter table public.brands enable row level security;
alter table public.characters enable row level security;
alter table public.brand_rules enable row level security;
alter table public.memory_items enable row level security;
alter table public.accounts enable row level security;
alter table public.viral_sparks enable row level security;
alter table public.productions enable row level security;
alter table public.review_items enable row level security;
alter table public.publish_jobs enable row level security;
alter table public.analytics_snapshots enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.audit_logs enable row level security;

-- Lock previously open publisher-core tables (deny-by-default with RLS on)
alter table public.brand_identities enable row level security;
alter table public.platform_accounts enable row level security;
alter table public.platform_connections enable row level security;
alter table public.automation_rules enable row level security;
alter table public.media_assets enable row level security;
alter table public.content_items enable row level security;
alter table public.content_item_media enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'Owners can select own brands' and tablename = 'brands') then
    create policy "Owners can select own brands" on public.brands for select using (owner_id = auth.uid());
    create policy "Owners can insert own brands" on public.brands for insert with check (owner_id = auth.uid());
    create policy "Owners can update own brands" on public.brands for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
    create policy "Owners can delete own brands" on public.brands for delete using (owner_id = auth.uid());
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'Owners can select brand characters' and tablename = 'characters') then
    create policy "Owners can select brand characters" on public.characters for select using (public.user_owns_brand(brand_id));
    create policy "Owners can insert brand characters" on public.characters for insert with check (public.user_owns_brand(brand_id));
    create policy "Owners can update brand characters" on public.characters for update using (public.user_owns_brand(brand_id)) with check (public.user_owns_brand(brand_id));
    create policy "Owners can delete brand characters" on public.characters for delete using (public.user_owns_brand(brand_id));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'Owners can manage brand rules' and tablename = 'brand_rules') then
    create policy "Owners can manage brand rules" on public.brand_rules for all using (public.user_owns_brand(brand_id)) with check (public.user_owns_brand(brand_id));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'Owners can manage brand memory' and tablename = 'memory_items') then
    create policy "Owners can manage brand memory" on public.memory_items for all using (public.user_owns_brand(brand_id)) with check (public.user_owns_brand(brand_id));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'Owners can manage brand accounts' and tablename = 'accounts') then
    create policy "Owners can manage brand accounts" on public.accounts for all using (public.user_owns_brand(brand_id)) with check (public.user_owns_brand(brand_id));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'Owners can manage viral sparks' and tablename = 'viral_sparks') then
    create policy "Owners can manage viral sparks" on public.viral_sparks for all using (public.user_owns_brand(brand_id)) with check (public.user_owns_brand(brand_id));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'Owners can manage productions' and tablename = 'productions') then
    create policy "Owners can manage productions" on public.productions for all using (public.user_owns_brand(brand_id)) with check (public.user_owns_brand(brand_id));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'Owners can manage review items' and tablename = 'review_items') then
    create policy "Owners can manage review items" on public.review_items for all using (public.user_owns_brand(brand_id)) with check (public.user_owns_brand(brand_id));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'Owners can manage publish jobs' and tablename = 'publish_jobs') then
    create policy "Owners can manage publish jobs" on public.publish_jobs for all using (public.user_owns_brand(brand_id)) with check (public.user_owns_brand(brand_id));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'Owners can manage analytics snapshots' and tablename = 'analytics_snapshots') then
    create policy "Owners can manage analytics snapshots" on public.analytics_snapshots for all using (public.user_owns_brand(brand_id)) with check (public.user_owns_brand(brand_id));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'Users can select own notifications' and tablename = 'notifications') then
    create policy "Users can select own notifications" on public.notifications for select using (user_id = auth.uid());
    create policy "Users can update own notifications" on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'Users can manage own notification preferences' and tablename = 'notification_preferences') then
    create policy "Users can manage own notification preferences" on public.notification_preferences for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'Users can read own audit logs' and tablename = 'audit_logs') then
    create policy "Users can read own audit logs" on public.audit_logs for select using (
      user_id = auth.uid() or (brand_id is not null and public.user_owns_brand(brand_id))
    );
  end if;
end $$;
