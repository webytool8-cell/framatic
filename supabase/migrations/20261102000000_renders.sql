-- Framatic Phase 2: MP4 renders (Google Cloud Run Jobs → Supabase Storage)

create table if not exists public.renders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  concept_id uuid not null references public.creative_concepts (id) on delete cascade,
  scene_plan_version int not null,
  aspect_ratio text not null check (aspect_ratio in ('16:9', '9:16', '1:1', '4:5')),
  duration_sec numeric not null,
  file_name text not null default 'framatic-ad.mp4',
  status text not null default 'rendering' check (status in ('rendering', 'done', 'failed')),
  progress real not null default 0 check (progress between 0 and 1),
  execution text,
  out_key text,
  out_size_bytes bigint,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists renders_concept_idx on public.renders (concept_id, created_at desc);
create index if not exists renders_user_idx on public.renders (user_id, created_at desc);

drop trigger if exists renders_updated on public.renders;
create trigger renders_updated before update on public.renders for each row execute function public.set_updated_at();
drop trigger if exists renders_owner on public.renders;
create trigger renders_owner before insert or update on public.renders for each row execute function public.enforce_project_owner();

alter table public.renders enable row level security;
drop policy if exists "own renders" on public.renders;
create policy "own renders" on public.renders for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Allow rate limiting of renders
alter table public.usage_events drop constraint if exists usage_events_kind_check;
alter table public.usage_events add constraint usage_events_kind_check check (kind in ('analyze', 'generate', 'regenerate', 'render'));

-- Private bucket for finished videos: renders/<user_id>/<render_id>.mp4
-- Written by the render job (service role); users may read their own files.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('renders', 'renders', false, 524288000, array['video/mp4'])
on conflict (id) do nothing;

drop policy if exists "users read own renders" on storage.objects;
create policy "users read own renders" on storage.objects for select to authenticated
  using (bucket_id = 'renders' and (storage.foldername(name))[1] = auth.uid()::text);
