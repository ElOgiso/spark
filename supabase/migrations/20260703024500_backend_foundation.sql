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

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.brands (
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

create table public.characters (
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

create table public.brand_rules (
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

create table public.memory_items (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  category text not null check (
    category in (
      'character',
      'voice',
      'brand',
      'niche',
      'audio',
      'winning_hooks',
      'winning_thumbnails',
      'audience_preferences',
      'failures',
      'publishing_behavior'
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

create table public.accounts (
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

create table public.viral_sparks (
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

create table public.productions (
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

create table public.review_items (
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

create table public.publish_jobs (
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

create table public.analytics_snapshots (
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

create table public.notifications (
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

create table public.notification_preferences (
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

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  brand_id uuid references public.brands(id),
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index brands_owner_id_idx on public.brands(owner_id);
create index characters_brand_id_idx on public.characters(brand_id);
create index brand_rules_brand_id_idx on public.brand_rules(brand_id);
create index memory_items_brand_id_idx on public.memory_items(brand_id);
create index accounts_brand_id_idx on public.accounts(brand_id);
create index viral_sparks_brand_id_idx on public.viral_sparks(brand_id);
create index productions_brand_id_idx on public.productions(brand_id);
create index productions_viral_spark_id_idx on public.productions(viral_spark_id);
create index review_items_brand_id_idx on public.review_items(brand_id);
create index review_items_production_id_idx on public.review_items(production_id);
create index publish_jobs_brand_id_idx on public.publish_jobs(brand_id);
create index publish_jobs_production_id_idx on public.publish_jobs(production_id);
create index analytics_snapshots_brand_id_idx on public.analytics_snapshots(brand_id);
create index notifications_user_id_idx on public.notifications(user_id);
create index notifications_brand_id_idx on public.notifications(brand_id);
create index audit_logs_user_id_idx on public.audit_logs(user_id);
create index audit_logs_brand_id_idx on public.audit_logs(brand_id);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger brands_set_updated_at
  before update on public.brands
  for each row execute function public.set_updated_at();
create trigger characters_set_updated_at
  before update on public.characters
  for each row execute function public.set_updated_at();
create trigger brand_rules_set_updated_at
  before update on public.brand_rules
  for each row execute function public.set_updated_at();
create trigger memory_items_set_updated_at
  before update on public.memory_items
  for each row execute function public.set_updated_at();
create trigger accounts_set_updated_at
  before update on public.accounts
  for each row execute function public.set_updated_at();
create trigger viral_sparks_set_updated_at
  before update on public.viral_sparks
  for each row execute function public.set_updated_at();
create trigger productions_set_updated_at
  before update on public.productions
  for each row execute function public.set_updated_at();
create trigger review_items_set_updated_at
  before update on public.review_items
  for each row execute function public.set_updated_at();
create trigger publish_jobs_set_updated_at
  before update on public.publish_jobs
  for each row execute function public.set_updated_at();
create trigger notification_preferences_set_updated_at
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
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

create policy "Users can select own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Owners can select own brands"
  on public.brands for select
  using (owner_id = auth.uid());

create policy "Owners can insert own brands"
  on public.brands for insert
  with check (owner_id = auth.uid());

create policy "Owners can update own brands"
  on public.brands for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Owners can delete own brands"
  on public.brands for delete
  using (owner_id = auth.uid());

create policy "Owners can select brand characters"
  on public.characters for select
  using (public.user_owns_brand(brand_id));

create policy "Owners can insert brand characters"
  on public.characters for insert
  with check (public.user_owns_brand(brand_id));

create policy "Owners can update brand characters"
  on public.characters for update
  using (public.user_owns_brand(brand_id))
  with check (public.user_owns_brand(brand_id));

create policy "Owners can delete brand characters"
  on public.characters for delete
  using (public.user_owns_brand(brand_id));

create policy "Owners can select brand rules"
  on public.brand_rules for select
  using (public.user_owns_brand(brand_id));

create policy "Owners can insert brand rules"
  on public.brand_rules for insert
  with check (public.user_owns_brand(brand_id));

create policy "Owners can update brand rules"
  on public.brand_rules for update
  using (public.user_owns_brand(brand_id))
  with check (public.user_owns_brand(brand_id));

create policy "Owners can delete brand rules"
  on public.brand_rules for delete
  using (public.user_owns_brand(brand_id));

create policy "Owners can select brand memory"
  on public.memory_items for select
  using (public.user_owns_brand(brand_id));

create policy "Owners can insert brand memory"
  on public.memory_items for insert
  with check (public.user_owns_brand(brand_id));

create policy "Owners can update brand memory"
  on public.memory_items for update
  using (public.user_owns_brand(brand_id))
  with check (public.user_owns_brand(brand_id));

create policy "Owners can delete brand memory"
  on public.memory_items for delete
  using (public.user_owns_brand(brand_id));

create policy "Owners can select brand accounts"
  on public.accounts for select
  using (public.user_owns_brand(brand_id));

create policy "Owners can insert brand accounts"
  on public.accounts for insert
  with check (public.user_owns_brand(brand_id));

create policy "Owners can update brand accounts"
  on public.accounts for update
  using (public.user_owns_brand(brand_id))
  with check (public.user_owns_brand(brand_id));

create policy "Owners can delete brand accounts"
  on public.accounts for delete
  using (public.user_owns_brand(brand_id));

create policy "Owners can select viral sparks"
  on public.viral_sparks for select
  using (public.user_owns_brand(brand_id));

create policy "Owners can insert viral sparks"
  on public.viral_sparks for insert
  with check (public.user_owns_brand(brand_id));

create policy "Owners can update viral sparks"
  on public.viral_sparks for update
  using (public.user_owns_brand(brand_id))
  with check (public.user_owns_brand(brand_id));

create policy "Owners can delete viral sparks"
  on public.viral_sparks for delete
  using (public.user_owns_brand(brand_id));

create policy "Owners can select productions"
  on public.productions for select
  using (public.user_owns_brand(brand_id));

create policy "Owners can insert productions"
  on public.productions for insert
  with check (public.user_owns_brand(brand_id));

create policy "Owners can update productions"
  on public.productions for update
  using (public.user_owns_brand(brand_id))
  with check (public.user_owns_brand(brand_id));

create policy "Owners can delete productions"
  on public.productions for delete
  using (public.user_owns_brand(brand_id));

create policy "Owners can select review items"
  on public.review_items for select
  using (public.user_owns_brand(brand_id));

create policy "Owners can insert review items"
  on public.review_items for insert
  with check (public.user_owns_brand(brand_id));

create policy "Owners can update review items"
  on public.review_items for update
  using (public.user_owns_brand(brand_id))
  with check (public.user_owns_brand(brand_id));

create policy "Owners can delete review items"
  on public.review_items for delete
  using (public.user_owns_brand(brand_id));

create policy "Owners can select publish jobs"
  on public.publish_jobs for select
  using (public.user_owns_brand(brand_id));

create policy "Owners can insert publish jobs"
  on public.publish_jobs for insert
  with check (public.user_owns_brand(brand_id));

create policy "Owners can update publish jobs"
  on public.publish_jobs for update
  using (public.user_owns_brand(brand_id))
  with check (public.user_owns_brand(brand_id));

create policy "Owners can delete publish jobs"
  on public.publish_jobs for delete
  using (public.user_owns_brand(brand_id));

create policy "Owners can select analytics snapshots"
  on public.analytics_snapshots for select
  using (public.user_owns_brand(brand_id));

create policy "Owners can insert analytics snapshots"
  on public.analytics_snapshots for insert
  with check (public.user_owns_brand(brand_id));

create policy "Owners can update analytics snapshots"
  on public.analytics_snapshots for update
  using (public.user_owns_brand(brand_id))
  with check (public.user_owns_brand(brand_id));

create policy "Owners can delete analytics snapshots"
  on public.analytics_snapshots for delete
  using (public.user_owns_brand(brand_id));

create policy "Users can select own notifications"
  on public.notifications for select
  using (user_id = auth.uid());

create policy "Users can update own notifications"
  on public.notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can select own notification preferences"
  on public.notification_preferences for select
  using (user_id = auth.uid());

create policy "Users can update own notification preferences"
  on public.notification_preferences for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can read own audit logs"
  on public.audit_logs for select
  using (
    user_id = auth.uid()
    or (brand_id is not null and public.user_owns_brand(brand_id))
  );
