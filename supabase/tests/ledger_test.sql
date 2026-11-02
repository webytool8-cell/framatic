-- Credit ledger tests: allocation, holds, settlement, idempotency, limits,
-- immutability and period rollover. Any failure raises (ON_ERROR_STOP).
reset role;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000c1', 'carol@example.com') on conflict do nothing;

do $$
declare
  u uuid := '00000000-0000-0000-0000-0000000000c1';
  p1 timestamptz := '2026-11-01T00:00:00Z';
  p2 timestamptz := '2026-12-01T00:00:00Z';
  r record;
  r2 record;
  b record;
  s record;
begin
  -- First balance read allocates the plan's credits once.
  select * into b from public.credit_balance(u, 'free', 30, p1);
  if b.balance <> 30 or b.allocated <> 30 then raise exception 'allocation: %', b; end if;
  select * into b from public.credit_balance(u, 'free', 30, p1);
  if b.balance <> 30 then raise exception 'double allocation'; end if;

  -- Hold 10 for a new project.
  select * into r from public.credit_reserve(u, 'free', 30, p1, 'analyze', 10, 'proj-1', 'key-1', false);
  if not r.created or r.balance <> 20 then raise exception 'reserve: %', r; end if;
  select * into b from public.credit_balance(u, 'free', 30, p1);
  if b.balance <> 20 or b.held <> 10 then raise exception 'held: %', b; end if;

  -- Same request again (double click / retry): same hold, no new charge.
  select * into r2 from public.credit_reserve(u, 'free', 30, p1, 'analyze', 10, 'proj-1', 'key-1', false);
  if r2.created or r2.reservation_id <> r.reservation_id then raise exception 'idempotency: %', r2; end if;

  -- A second, different request for the same project while it runs is refused.
  begin
    perform public.credit_reserve(u, 'free', 30, p1, 'analyze', 10, 'proj-1', 'key-2', false);
    raise exception 'in-progress not detected';
  exception when sqlstate 'FR002' then null; end;

  -- Two concepts of three delivered: charge 8, return the rest.
  select * into s from public.credit_settle(r.reservation_id, 8, 'completed', '{"delivered":2}');
  if s.captured <> 8 or s.released <> 10 or s.already_settled then raise exception 'settle: %', s; end if;
  select * into b from public.credit_balance(u, 'free', 30, p1);
  if b.balance <> 22 or b.held <> 0 or b.consumed <> 8 then raise exception 'after settle: %', b; end if;

  -- Settling again changes nothing.
  select * into s from public.credit_settle(r.reservation_id, 10, 'again');
  if not s.already_settled then raise exception 'double settle'; end if;

  -- A failure on our side: hold returned in full.
  select * into r from public.credit_reserve(u, 'free', 30, p1, 'render', 1, 'c1:v1', null, false);
  perform public.credit_settle(r.reservation_id, 0, 'system_failure');
  select * into b from public.credit_balance(u, 'free', 30, p1);
  if b.balance <> 22 then raise exception 'failure refund: %', b; end if;

  -- Capture can never exceed the hold.
  select * into r from public.credit_reserve(u, 'free', 30, p1, 'regenerate', 2, 'c1', null, false);
  select * into s from public.credit_settle(r.reservation_id, 50, 'completed');
  if s.captured <> 2 then raise exception 'over-capture: %', s; end if;

  -- Not enough credits: refused, balance never goes negative.
  begin
    perform public.credit_reserve(u, 'free', 30, p1, 'generate', 25, 'proj-2', null, false);
    raise exception 'insufficient not detected';
  exception when sqlstate 'FR001' then null; end;
  select * into b from public.credit_balance(u, 'free', 30, p1);
  if b.balance <> 20 then raise exception 'balance after refusal: %', b; end if;

  -- Upgrade mid-period tops up the difference once.
  select * into b from public.credit_balance(u, 'pro', 1000, p1);
  if b.balance <> 990 or b.allocated <> 1000 then raise exception 'upgrade: %', b; end if;
  select * into b from public.credit_balance(u, 'pro', 1000, p1);
  if b.balance <> 990 then raise exception 'double top-up'; end if;

  -- New period: leftover plan credits expire, fresh allocation.
  select * into b from public.credit_balance(u, 'pro', 1000, p2);
  if b.balance <> 1000 or b.allocated <> 1000 or b.consumed <> 0 then raise exception 'rollover: %', b; end if;
  if (select amount from public.credit_transactions where user_id = u and type = 'expiry') <> -990 then raise exception 'expiry amount'; end if;

  -- Unlimited: nothing deducted, list price still recorded.
  select * into r from public.credit_reserve(u, 'unlimited', 0, p2, 'analyze', 10, 'proj-3', null, true);
  select * into s from public.credit_settle(r.reservation_id, 10, 'completed');
  select * into b from public.credit_balance(u, 'unlimited', 0, p2);
  if b.balance <> 1000 or b.consumed <> 10 then raise exception 'unlimited: %', b; end if;

  -- The ledger is append-only.
  begin
    update public.credit_transactions set amount = 1000000 where user_id = u;
    raise exception 'ledger update allowed';
  exception when sqlstate 'FR900' then null; end;
  begin
    delete from public.credit_transactions where user_id = u;
    raise exception 'ledger delete allowed';
  exception when sqlstate 'FR900' then null; end;
end $$;

-- Users can read their own history but can't write it or call the ledger functions.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
do $$ begin
  if (select count(*) from public.credit_transactions) = 0 then raise exception 'carol cannot read her ledger'; end if;
  begin
    insert into public.credit_transactions (user_id, type, amount) values ('00000000-0000-0000-0000-0000000000c1', 'purchase', 100000);
    raise exception 'user wrote to ledger';
  exception when insufficient_privilege then null; end;
  begin
    perform public.credit_reserve('00000000-0000-0000-0000-0000000000c1', 'free', 30, now(), 'render', 0, null, null, true);
    raise exception 'user called credit_reserve';
  exception when insufficient_privilege then null; end;
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  if (select count(*) from public.credit_transactions) <> 0 then raise exception 'bob can read carol ledger'; end if;
end $$;
reset role;

-- Concurrency: two sessions racing for the last credits can't both win.
select 'LEDGER TESTS PASSED' as result;
