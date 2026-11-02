-- Framatic: credit ledger, reservations and cost metering.
--
-- credit_transactions is an append-only ledger. Every row changes a user's
-- available balance by `amount` (+ adds, − removes):
--   allocation  +N   monthly plan credits (and top-ups after an upgrade)
--   expiry      −N   unused plan credits at the end of a period
--   reservation −N   credits held before an operation starts
--   release     +N   the hold returned when the operation settles
--   capture     −N   what the operation actually cost (≤ the hold)
--   refund / adjustment / purchase   manual or future (credit packs)
-- Available balance = sum(amount). Holds make it impossible to overspend while
-- several operations run, and a per-user advisory lock serializes every change.

create table if not exists public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  -- No FK on purpose: the financial history outlives a deleted account (it holds no personal data).
  user_id uuid not null,
  type text not null check (type in ('allocation', 'expiry', 'reservation', 'release', 'capture', 'refund', 'adjustment', 'purchase')),
  amount int not null,
  bucket text not null default 'plan' check (bucket in ('plan', 'pack')),
  operation text check (operation in ('analyze', 'analyze_only', 'generate', 'regenerate', 'render')),
  ref text,
  reservation_id uuid references public.credit_transactions (id),
  idempotency_key text,
  period_start timestamptz,
  plan text,
  -- Credits at list price. Equals −amount for normal users; for Unlimited accounts
  -- amount is 0 but list_credits still records what the work would have cost.
  list_credits int,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists credit_tx_user_idx on public.credit_transactions (user_id, created_at desc);
create index if not exists credit_tx_type_idx on public.credit_transactions (type, created_at desc);
create unique index if not exists credit_tx_idem_idx on public.credit_transactions (user_id, idempotency_key) where idempotency_key is not null;
-- Each reservation settles exactly once.
create unique index if not exists credit_tx_settle_idx on public.credit_transactions (reservation_id, type) where type in ('release', 'capture');
create index if not exists credit_tx_open_idx on public.credit_transactions (user_id, operation, ref) where type = 'reservation';

-- Append-only: no updates or deletes, ever.
create or replace function public.credit_tx_immutable() returns trigger language plpgsql as $$
begin
  raise exception 'credit_transactions is append-only' using errcode = 'FR900';
end $$;
drop trigger if exists credit_tx_no_update on public.credit_transactions;
create trigger credit_tx_no_update before update or delete on public.credit_transactions
  for each row execute function public.credit_tx_immutable();

alter table public.credit_transactions enable row level security;
drop policy if exists "read own credit history" on public.credit_transactions;
create policy "read own credit history" on public.credit_transactions for select using (user_id = auth.uid());
revoke insert, update, delete on public.credit_transactions from anon, authenticated;

-- ---------- Ledger functions (server only) ----------

create or replace function public.credit_lock(p_user uuid) returns void
language sql as $$ select pg_advisory_xact_lock(hashtextextended('framatic-credits:' || p_user::text, 0)) $$;

-- Start a new period if needed: expire unused plan credits, allocate the plan's
-- credits, and top up the difference if the plan grew mid-period.
create or replace function public.credit_sync_period(p_user uuid, p_plan text, p_allowance int, p_period_start timestamptz)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_allocated int;
  v_left int;
begin
  perform public.credit_lock(p_user);
  select coalesce(sum(amount), 0) into v_allocated
    from credit_transactions where user_id = p_user and type = 'allocation' and period_start = p_period_start;
  if not exists (select 1 from credit_transactions where user_id = p_user and type = 'allocation' and period_start = p_period_start) then
    select coalesce(sum(amount), 0) into v_left from credit_transactions where user_id = p_user and bucket = 'plan';
    if v_left > 0 then
      insert into credit_transactions (user_id, type, amount, period_start, plan, reason)
      values (p_user, 'expiry', -v_left, p_period_start, p_plan, 'unused plan credits expired');
    end if;
    insert into credit_transactions (user_id, type, amount, period_start, plan, reason)
    values (p_user, 'allocation', greatest(p_allowance, 0), p_period_start, p_plan, 'monthly plan credits');
  elsif p_allowance > v_allocated then
    insert into credit_transactions (user_id, type, amount, period_start, plan, reason)
    values (p_user, 'allocation', p_allowance - v_allocated, p_period_start, p_plan, 'plan upgrade top-up');
  end if;
end $$;

create or replace function public.credit_balance(p_user uuid, p_plan text, p_allowance int, p_period_start timestamptz)
returns table (balance int, held int, allocated int, consumed int)
language plpgsql security definer set search_path = public as $$
begin
  perform public.credit_sync_period(p_user, p_plan, p_allowance, p_period_start);
  return query
  select
    coalesce(sum(t.amount), 0)::int,
    coalesce(sum(-t.amount) filter (where t.type = 'reservation' and not exists (
      select 1 from credit_transactions r where r.reservation_id = t.id and r.type = 'release')), 0)::int,
    coalesce(sum(t.amount) filter (where t.type = 'allocation' and t.period_start = p_period_start), 0)::int,
    coalesce(sum(t.list_credits) filter (where t.type = 'capture' and t.period_start = p_period_start), 0)::int
  from credit_transactions t where t.user_id = p_user;
end $$;

-- Hold credits before an operation. Raises FR001 when there aren't enough,
-- FR002 when the same operation is already running on the same thing.
-- Repeating a request with the same idempotency key returns the first hold.
create or replace function public.credit_reserve(
  p_user uuid, p_plan text, p_allowance int, p_period_start timestamptz,
  p_operation text, p_amount int, p_ref text, p_idempotency_key text, p_unlimited boolean
) returns table (reservation_id uuid, created boolean, balance int)
language plpgsql security definer set search_path = public as $$
declare
  v_existing uuid;
  v_balance int;
  v_id uuid;
begin
  if p_amount < 0 then raise exception 'amount must be positive'; end if;
  perform public.credit_sync_period(p_user, p_plan, p_allowance, p_period_start);

  if p_idempotency_key is not null then
    select id into v_existing from credit_transactions where user_id = p_user and idempotency_key = p_idempotency_key;
    if v_existing is not null then
      select coalesce(sum(amount), 0) into v_balance from credit_transactions where user_id = p_user;
      return query select v_existing, false, v_balance;
      return;
    end if;
  end if;

  if p_ref is not null and exists (
    select 1 from credit_transactions t
    where t.user_id = p_user and t.type = 'reservation' and t.operation = p_operation and t.ref = p_ref
      and not exists (select 1 from credit_transactions r where r.reservation_id = t.id and r.type = 'release')
  ) then
    raise exception 'operation already in progress' using errcode = 'FR002';
  end if;

  select coalesce(sum(amount), 0) into v_balance from credit_transactions where user_id = p_user;
  if not p_unlimited and v_balance < p_amount then
    raise exception 'insufficient credits' using errcode = 'FR001', detail = v_balance::text;
  end if;

  insert into credit_transactions (user_id, type, amount, operation, ref, idempotency_key, period_start, plan, list_credits, reason)
  values (p_user, 'reservation', case when p_unlimited then 0 else -p_amount end, p_operation, p_ref, p_idempotency_key, p_period_start, p_plan, p_amount, 'credits held')
  returning id into v_id;
  return query select v_id, true, v_balance - case when p_unlimited then 0 else p_amount end;
end $$;

-- Settle a hold: return it in full, then charge what was actually delivered
-- (0 for a failure on our side). Settling twice is a no-op.
create or replace function public.credit_settle(p_reservation uuid, p_capture int, p_reason text, p_metadata jsonb default '{}'::jsonb)
returns table (captured int, released int, already_settled boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_res credit_transactions%rowtype;
  v_capture int;
  v_unlimited boolean;
begin
  select * into v_res from credit_transactions where id = p_reservation and type = 'reservation';
  if not found then raise exception 'reservation not found' using errcode = 'FR404'; end if;
  perform public.credit_lock(v_res.user_id);
  if exists (select 1 from credit_transactions where reservation_id = p_reservation and type = 'release') then
    return query select 0, 0, true;
    return;
  end if;
  v_capture := least(greatest(coalesce(p_capture, 0), 0), coalesce(v_res.list_credits, 0));
  v_unlimited := v_res.amount = 0 and coalesce(v_res.list_credits, 0) > 0;

  insert into credit_transactions (user_id, type, amount, operation, ref, reservation_id, period_start, plan, list_credits, reason, metadata)
  values (v_res.user_id, 'release', -v_res.amount, v_res.operation, v_res.ref, p_reservation, v_res.period_start, v_res.plan, v_res.list_credits, p_reason, coalesce(p_metadata, '{}'::jsonb));
  if v_capture > 0 then
    insert into credit_transactions (user_id, type, amount, operation, ref, reservation_id, period_start, plan, list_credits, reason, metadata)
    values (v_res.user_id, 'capture', case when v_unlimited then 0 else -v_capture end, v_res.operation, v_res.ref, p_reservation, v_res.period_start, v_res.plan, v_capture, p_reason, coalesce(p_metadata, '{}'::jsonb));
  end if;
  return query select v_capture, -v_res.amount, false;
end $$;

revoke all on function public.credit_lock(uuid) from public;
revoke all on function public.credit_sync_period(uuid, text, int, timestamptz) from public;
revoke all on function public.credit_balance(uuid, text, int, timestamptz) from public;
revoke all on function public.credit_reserve(uuid, text, int, timestamptz, text, int, text, text, boolean) from public;
revoke all on function public.credit_settle(uuid, int, text, jsonb) from public;
grant execute on function public.credit_balance(uuid, text, int, timestamptz) to service_role;
grant execute on function public.credit_reserve(uuid, text, int, timestamptz, text, int, text, text, boolean) to service_role;
grant execute on function public.credit_settle(uuid, int, text, jsonb) to service_role;

-- ---------- Cost metering ----------

-- Links every AI call and render to the credit operation that paid for it.
alter table public.ai_usage add column if not exists operation_id uuid;
create index if not exists ai_usage_operation_idx on public.ai_usage (operation_id);
alter table public.renders add column if not exists operation_id uuid;

-- Non-AI costs: compute time, rendering, storage, delivery (estimates from list prices).
create table if not exists public.cost_events (
  id bigint generated always as identity primary key,
  user_id uuid,
  operation_id uuid,
  operation text,
  category text not null check (category in ('compute', 'render', 'storage', 'delivery', 'other')),
  quantity numeric,
  unit text,
  cost_usd numeric(12, 6) not null default 0,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists cost_events_created_idx on public.cost_events (created_at desc);
create index if not exists cost_events_operation_idx on public.cost_events (operation_id);
alter table public.cost_events enable row level security;

-- ---------- Billing configuration (editable on /admin/usage) ----------
create table if not exists public.billing_config (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_by text,
  updated_at timestamptz not null default now()
);
insert into public.billing_config (id, data) values (1, '{}'::jsonb) on conflict (id) do nothing;
alter table public.billing_config enable row level security;
-- Credit costs are public (shown on the pricing page); only the server writes.
drop policy if exists "anyone reads billing config" on public.billing_config;
create policy "anyone reads billing config" on public.billing_config for select using (true);
revoke insert, update, delete on public.billing_config from anon, authenticated;
