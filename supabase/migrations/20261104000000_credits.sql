-- Framatic: monthly credits per plan.
-- Every metered action is a row in usage_events with the credits it cost;
-- refunds are rows with negative credits. Balance for the period =
-- plan allowance − sum(credits) since the period started.

alter table public.usage_events add column if not exists credits int not null default 0;
alter table public.usage_events add column if not exists ref text;
alter table public.usage_events drop constraint if exists usage_events_kind_check;
alter table public.usage_events add constraint usage_events_kind_check
  check (kind in ('analyze', 'generate', 'regenerate', 'render', 'refund', 'redeem'));
create index if not exists usage_events_user_created_idx on public.usage_events (user_id, created_at desc);
create index if not exists usage_events_ref_idx on public.usage_events (user_id, ref);

-- Plans: add Studio, and the fields Stripe will fill in later.
alter table public.user_plans drop constraint if exists user_plans_plan_check;
alter table public.user_plans add constraint user_plans_plan_check
  check (plan in ('free', 'starter', 'pro', 'studio', 'unlimited'));
alter table public.user_plans add column if not exists stripe_customer_id text;
alter table public.user_plans add column if not exists stripe_subscription_id text;
-- When set, credits reset on this day each month (the billing date) instead of the 1st.
alter table public.user_plans add column if not exists current_period_start timestamptz;
