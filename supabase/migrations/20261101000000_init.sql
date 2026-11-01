-- Framatic Phase 1 schema
-- Users (auth.users, managed by Supabase Auth) → profiles, preferences
-- Projects → brand profiles, analyzed pages, assets, creative concepts → scene plans (versioned)

create extension if not exists pgcrypto;

-- ---------- helpers ----------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- profiles ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  default_aspect_ratio text not null default '16:9' check (default_aspect_ratio in ('16:9', '9:16', '1:1', '4:5')),
  default_duration_sec int not null default 30 check (default_duration_sec between 6 and 60),
  default_pacing text check (default_pacing in ('calm', 'steady', 'punchy', 'rapid')),
  brand_voice_notes text not null default '' check (char_length(brand_voice_notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- New auth user → profile + preferences rows
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict do nothing;
  insert into public.user_preferences (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- brand profiles ----------
create table public.brand_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'Untitled brand' check (char_length(name) <= 120),
  source_url text,
  schema_version int not null default 1,
  profile jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index brand_profiles_user_idx on public.brand_profiles (user_id, updated_at desc);

-- ---------- projects ----------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  website_url text check (char_length(website_url) <= 2048),
  status text not null default 'draft'
    check (status in ('draft', 'analyzing', 'analyzed', 'analysis_failed', 'generating', 'concepts_ready', 'generation_failed')),
  status_message text,
  status_updated_at timestamptz not null default now(),
  brand_profile_id uuid references public.brand_profiles (id) on delete set null,
  creative_preferences jsonb not null default '{}'::jsonb,
  analysis_warnings jsonb not null default '[]'::jsonb,
  analyzed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_user_idx on public.projects (user_id, updated_at desc);
create index projects_status_idx on public.projects (status) where status in ('analyzing', 'generating');

-- ---------- analyzed pages & assets ----------
create table public.analyzed_pages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  url text not null,
  page_type text not null,
  title text,
  description text,
  headings jsonb not null default '[]'::jsonb,
  text_excerpt text,
  ctas jsonb not null default '[]'::jsonb,
  og jsonb not null default '{}'::jsonb,
  fetched_via text not null default 'http' check (fetched_via in ('http', 'browser')),
  http_status int,
  created_at timestamptz not null default now()
);
create index analyzed_pages_project_idx on public.analyzed_pages (project_id);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('logo', 'image', 'og_image', 'favicon', 'uploaded_logo')),
  url text,
  storage_path text,
  alt text,
  source_page_url text,
  created_at timestamptz not null default now(),
  check (url is not null or storage_path is not null)
);
create index assets_project_idx on public.assets (project_id, kind);

-- ---------- creative concepts & versioned scene plans ----------
create table public.creative_concepts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('problem_solution', 'product_in_motion', 'brand_manifesto')),
  slot text not null check (slot in ('A', 'B', 'C')),
  content jsonb not null,
  preferences jsonb not null default '{}'::jsonb,
  edited_fields text[] not null default '{}',
  is_preferred boolean not null default false,
  current_version int not null default 1,
  status text not null default 'ready' check (status in ('ready', 'regenerating', 'failed')),
  status_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, kind)
);
create index creative_concepts_project_idx on public.creative_concepts (project_id);
-- At most one preferred concept per project
create unique index creative_concepts_one_preferred on public.creative_concepts (project_id) where is_preferred;

create table public.scene_plans (
  id uuid primary key default gen_random_uuid(),
  concept_id uuid not null references public.creative_concepts (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  version int not null check (version >= 1),
  schema_version int not null default 1,
  source text not null check (source in ('ai', 'ai_partial', 'user')),
  plan jsonb not null,
  created_at timestamptz not null default now(),
  unique (concept_id, version)
);
create index scene_plans_concept_idx on public.scene_plans (concept_id, version desc);

-- ---------- usage events (rate limiting for expensive operations) ----------
create table public.usage_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('analyze', 'generate', 'regenerate')),
  created_at timestamptz not null default now()
);
create index usage_events_user_kind_idx on public.usage_events (user_id, kind, created_at desc);

-- ---------- updated_at triggers ----------
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger prefs_updated before update on public.user_preferences for each row execute function public.set_updated_at();
create trigger brand_profiles_updated before update on public.brand_profiles for each row execute function public.set_updated_at();
create trigger projects_updated before update on public.projects for each row execute function public.set_updated_at();
create trigger concepts_updated before update on public.creative_concepts for each row execute function public.set_updated_at();

-- ---------- child rows must belong to the same user as their project ----------
create or replace function public.enforce_project_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.projects p where p.id = new.project_id and p.user_id = new.user_id) then
    raise exception 'project % does not belong to user %', new.project_id, new.user_id using errcode = '42501';
  end if;
  return new;
end $$;

create trigger analyzed_pages_owner before insert or update on public.analyzed_pages for each row execute function public.enforce_project_owner();
create trigger assets_owner before insert or update on public.assets for each row execute function public.enforce_project_owner();
create trigger concepts_owner before insert or update on public.creative_concepts for each row execute function public.enforce_project_owner();
create trigger scene_plans_owner before insert or update on public.scene_plans for each row execute function public.enforce_project_owner();

create or replace function public.enforce_brand_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.brand_profile_id is not null and not exists (
    select 1 from public.brand_profiles b where b.id = new.brand_profile_id and b.user_id = new.user_id
  ) then
    raise exception 'brand profile does not belong to user' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger projects_brand_owner before insert or update of brand_profile_id on public.projects for each row execute function public.enforce_brand_owner();

-- ---------- Row Level Security ----------
alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.brand_profiles enable row level security;
alter table public.projects enable row level security;
alter table public.analyzed_pages enable row level security;
alter table public.assets enable row level security;
alter table public.creative_concepts enable row level security;
alter table public.scene_plans enable row level security;
alter table public.usage_events enable row level security;

create policy "own profile" on public.profiles for all
  using (id = auth.uid()) with check (id = auth.uid());
create policy "own preferences" on public.user_preferences for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own brand profiles" on public.brand_profiles for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own projects" on public.projects for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own pages" on public.analyzed_pages for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own assets" on public.assets for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own concepts" on public.creative_concepts for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own scene plans" on public.scene_plans for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
-- usage events: users may read their own; writes happen server-side with the service role
create policy "read own usage" on public.usage_events for select using (user_id = auth.uid());

-- ---------- Storage: user-uploaded brand assets ----------
-- Files live at brand-assets/<user_id>/<...>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brand-assets', 'brand-assets', true, 5242880, array['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'])
on conflict (id) do nothing;

create policy "users upload own brand assets" on storage.objects for insert to authenticated
  with check (bucket_id = 'brand-assets' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users update own brand assets" on storage.objects for update to authenticated
  using (bucket_id = 'brand-assets' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users delete own brand assets" on storage.objects for delete to authenticated
  using (bucket_id = 'brand-assets' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "public read brand assets" on storage.objects for select
  using (bucket_id = 'brand-assets');
