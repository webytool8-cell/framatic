-- Framatic: real cost tracking + per-user plans for monthly quotas.

-- ---------- AI usage: one row per model call ----------
create table if not exists public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  concept_id uuid references public.creative_concepts (id) on delete set null,
  step text not null,
  model text not null,
  attempt int not null default 0,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cache_read_tokens int not null default 0,
  cache_write_tokens int not null default 0,
  cost_usd numeric(12, 6),
  duration_ms int,
  ok boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_user_idx on public.ai_usage (user_id, created_at desc);
create index if not exists ai_usage_created_idx on public.ai_usage (created_at desc);

-- Written and read only by the server (service role). No user policies.
alter table public.ai_usage enable row level security;

-- ---------- Plans ----------
-- No row = free. Only the server (or you, in the SQL editor) can change a plan.
create table if not exists public.user_plans (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'starter', 'pro', 'unlimited')),
  note text,
  updated_at timestamptz not null default now()
);
drop trigger if exists user_plans_updated on public.user_plans;
create trigger user_plans_updated before update on public.user_plans for each row execute function public.set_updated_at();

alter table public.user_plans enable row level security;
drop policy if exists "read own plan" on public.user_plans;
create policy "read own plan" on public.user_plans for select using (user_id = auth.uid());

-- ---------- Monthly cost per user (for the admin usage page) ----------
-- Render cost uses instance lifetime (created → finished), minimum 60s,
-- at 4 vCPU × $0.000018 + 8 GiB × $0.000002 per second.
create or replace view public.usage_cost_monthly
with (security_invoker = true) as
with ai as (
  select user_id, date_trunc('month', created_at) as month,
         count(*) as ai_calls,
         count(distinct project_id) as ai_projects,
         sum(input_tokens + cache_read_tokens + cache_write_tokens) as input_tokens,
         sum(output_tokens) as output_tokens,
         coalesce(sum(cost_usd), 0) as ai_cost_usd
  from public.ai_usage group by 1, 2
), rn as (
  select user_id, date_trunc('month', created_at) as month,
         count(*) filter (where status = 'done') as renders,
         coalesce(sum(greatest(60, extract(epoch from (updated_at - created_at)))) filter (where status <> 'rendering'), 0) as render_seconds
  from public.renders group by 1, 2
)
select coalesce(ai.user_id, rn.user_id) as user_id,
       coalesce(ai.month, rn.month) as month,
       coalesce(ai.ai_calls, 0) as ai_calls,
       coalesce(ai.ai_projects, 0) as ai_projects,
       coalesce(ai.input_tokens, 0) as input_tokens,
       coalesce(ai.output_tokens, 0) as output_tokens,
       coalesce(ai.ai_cost_usd, 0) as ai_cost_usd,
       coalesce(rn.renders, 0) as renders,
       coalesce(rn.render_seconds, 0) as render_seconds,
       round(coalesce(rn.render_seconds, 0) * (4 * 0.000018 + 8 * 0.000002), 6) as render_cost_usd
from ai full outer join rn on ai.user_id = rn.user_id and ai.month = rn.month;

revoke all on public.usage_cost_monthly from anon, authenticated;
