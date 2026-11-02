#!/usr/bin/env bash
# Applies migrations to a throwaway local Postgres and runs RLS tests.
# Requires Postgres binaries (initdb, pg_ctl, psql). Usage: npm run test:db
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-$(dirname "$(command -v initdb 2>/dev/null || ls /usr/lib/postgresql/*/bin/initdb | tail -1)")}"
DATA="$(mktemp -d)"
PORT="${PGPORT_TEST:-54329}"
cleanup() { "$PGBIN/pg_ctl" -D "$DATA" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$DATA"; }
trap cleanup EXIT
"$PGBIN/initdb" -D "$DATA" -U postgres -A trust >/dev/null
"$PGBIN/pg_ctl" -D "$DATA" -o "-p $PORT -k $DATA -c listen_addresses=''" -l "$DATA/log" start >/dev/null
PSQL=(psql -h "$DATA" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -c "create database framatic_test" postgres
"${PSQL[@]}" -f "$ROOT/supabase/tests/supabase_stub.sql" framatic_test
for f in "$ROOT"/supabase/migrations/*.sql; do "${PSQL[@]}" -f "$f" framatic_test; done
"${PSQL[@]}" -t -f "$ROOT/supabase/tests/rls_test.sql" framatic_test
"${PSQL[@]}" -t -f "$ROOT/supabase/tests/ledger_test.sql" framatic_test

# Concurrency: 8 sessions race for credits that only cover 3 operations.
"${PSQL[@]}" -c "select public.credit_balance('00000000-0000-0000-0000-0000000000d1', 'free', 30, '2026-11-01T00:00:00Z')" framatic_test >/dev/null
for i in $(seq 1 8); do
  ("${PSQL[@]}" -c "select public.credit_reserve('00000000-0000-0000-0000-0000000000d1', 'free', 30, '2026-11-01T00:00:00Z', 'analyze', 10, 'race-$i', null, false)" framatic_test >/dev/null 2>&1 || true) &
done
wait
WON=$("${PSQL[@]}" -t -A -c "select count(*) from public.credit_transactions where user_id = '00000000-0000-0000-0000-0000000000d1' and type = 'reservation'" framatic_test)
BAL=$("${PSQL[@]}" -t -A -c "select sum(amount) from public.credit_transactions where user_id = '00000000-0000-0000-0000-0000000000d1'" framatic_test)
if [ "$WON" != "3" ] || [ "$BAL" != "0" ]; then echo "CONCURRENCY TEST FAILED: $WON holds, balance $BAL"; exit 1; fi
echo " CONCURRENCY TEST PASSED (3 of 8 racing requests held credits, balance $BAL)"
