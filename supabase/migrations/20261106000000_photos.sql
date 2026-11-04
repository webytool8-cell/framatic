-- Framatic: photos for videos (imported from the product page or AI-generated).

alter table public.assets drop constraint if exists assets_kind_check;
alter table public.assets add constraint assets_kind_check
  check (kind in ('logo', 'image', 'og_image', 'favicon', 'uploaded_logo', 'photo', 'ai_photo'));
-- Where an imported photo came from, and what a generated one was asked to show.
alter table public.assets add column if not exists source_url text;
alter table public.assets add column if not exists prompt text;
create index if not exists assets_photos_idx on public.assets (project_id, kind) where kind in ('photo', 'ai_photo');

alter table public.cost_events drop constraint if exists cost_events_category_check;
alter table public.cost_events add constraint cost_events_category_check
  check (category in ('compute', 'render', 'storage', 'delivery', 'image', 'other'));
