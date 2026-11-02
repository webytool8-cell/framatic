import type { SupabaseClient } from "@supabase/supabase-js";
import { getBillingConfig } from "@/lib/billing-config";
import { PLANS, creditPeriod, creditsEnabled, getPlanRow, outOfCreditsMessage, type ChargeKind, type CreditBalance, type CreditCosts } from "@/lib/plans";
import { OperationInProgressError, OutOfCreditsError, checkHourly, recordAttempt } from "@/lib/rate-limit";
import { log } from "@/lib/log";

/**
 * Credit operations on the append-only ledger (credit_transactions):
 * reserve credits before work starts, then settle with what was delivered.
 * Every change runs in a Postgres function under a per-user lock, so balances
 * can't go negative and duplicate or concurrent requests can't double-charge.
 */
export type Operation = ChargeKind | "analyze_only";

/** Hourly abuse limits are per kind of action. */
const HOURLY_KIND: Record<Operation, ChargeKind> = { analyze: "analyze", analyze_only: "analyze", generate: "generate", regenerate: "regenerate", render: "render" };

export function operationCost(costs: CreditCosts, op: Operation): number {
  if (op === "analyze_only") return Math.max(1, costs.analyze - costs.generate);
  return costs[op];
}

export type Outcome =
  | { kind: "failed" } // our side failed: nothing charged
  | { kind: "done" } // full delivery
  | { kind: "concepts"; delivered: number; analysis?: boolean }; // partial concept delivery

/**
 * What to charge for an operation given what it produced.
 * New project = page analysis + 3 concepts; each missing concept is not charged,
 * and a project that produced no concepts at all is refunded in full.
 */
export function captureFor(costs: CreditCosts, op: Operation, outcome: Outcome): number {
  if (outcome.kind === "failed") return 0;
  const full = operationCost(costs, op);
  if (outcome.kind === "done") return full;
  const d = Math.max(0, Math.min(3, outcome.delivered));
  if (op === "generate") return Math.round((costs.generate * d) / 3);
  if (op === "analyze") {
    if (d === 0) return 0;
    return Math.max(0, costs.analyze - costs.generate) + Math.round((costs.generate * d) / 3);
  }
  return d > 0 ? full : 0;
}

async function planContext(admin: SupabaseClient, userId: string, now: Date) {
  const { plan, currentPeriodStart } = await getPlanRow(admin, userId);
  const { start, end } = creditPeriod(now, currentPeriodStart);
  const credits = PLANS[plan].credits;
  const unlimited = !Number.isFinite(credits) || !creditsEnabled();
  return { plan, start, end, unlimited, allowance: Number.isFinite(credits) ? credits : 0 };
}

export async function getBalance(admin: SupabaseClient, userId: string, now = new Date()): Promise<CreditBalance> {
  const c = await planContext(admin, userId, now);
  const { data, error } = await admin.rpc("credit_balance", { p_user: userId, p_plan: c.plan, p_allowance: c.allowance, p_period_start: c.start.toISOString() });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as { balance: number; held: number; allocated: number; consumed: number } | undefined;
  const balance = Number(row?.balance ?? 0);
  return {
    plan: c.plan,
    allowance: c.unlimited ? Infinity : Number(row?.allocated ?? c.allowance),
    used: Number(row?.consumed ?? 0),
    held: Number(row?.held ?? 0),
    left: c.unlimited ? Infinity : Math.max(0, balance),
    unlimited: c.unlimited,
    periodStart: c.start,
    resetsAt: c.end,
  };
}

export type Reservation = { reservationId: string; created: boolean; cost: number };

/**
 * Hold credits for an operation. Throws RateLimitError (hourly limit),
 * OutOfCreditsError (not enough) or OperationInProgressError (already running).
 * With the same idempotency key, a repeated request returns the first hold
 * (`created: false`) and the caller must not start the work again.
 */
export async function reserveCredits(
  admin: SupabaseClient,
  userId: string,
  op: Operation,
  opts: { ref: string; idempotencyKey?: string | null; now?: Date },
): Promise<Reservation> {
  const now = opts.now ?? new Date();
  const c = await planContext(admin, userId, now);
  const costs = (await getBillingConfig(admin)).creditCosts;
  const cost = operationCost(costs, op);
  if (!c.unlimited) await checkHourly(admin, userId, HOURLY_KIND[op]);
  // Stale means 20 minutes old in real time, regardless of the period being charged.
  await sweepStaleReservations(admin, userId).catch((e) => log.warn("sweep failed", { error: (e as Error).message }));

  const key = opts.idempotencyKey ? `${op}:${opts.idempotencyKey}`.slice(0, 200) : null;
  const { data, error } = await admin.rpc("credit_reserve", {
    p_user: userId,
    p_plan: c.plan,
    p_allowance: c.allowance,
    p_period_start: c.start.toISOString(),
    p_operation: op,
    p_amount: cost,
    p_ref: opts.ref,
    p_idempotency_key: key,
    p_unlimited: c.unlimited,
  });
  if (error) {
    if (error.code === "FR001") {
      const left = Number(error.details ?? 0) || 0;
      throw new OutOfCreditsError(HOURLY_KIND[op], outOfCreditsMessage(HOURLY_KIND[op], { left, plan: c.plan, resetsAt: c.end }, cost), Math.ceil((c.end.getTime() - now.getTime()) / 60_000));
    }
    if (error.code === "FR002") throw new OperationInProgressError(op);
    throw error;
  }
  const row = (Array.isArray(data) ? data[0] : data) as { reservation_id: string; created: boolean };
  if (row.created) await recordAttempt(admin, userId, HOURLY_KIND[op]);
  return { reservationId: row.reservation_id, created: row.created, cost };
}

export type Settlement = { captured: number; alreadySettled: boolean };

/** Settle a hold with what was delivered. Safe to call twice; never throws. */
export async function settleCredits(admin: SupabaseClient, reservationId: string | null | undefined, capture: number, reason: string, metadata: Record<string, unknown> = {}): Promise<Settlement> {
  if (!reservationId) return { captured: 0, alreadySettled: true };
  try {
    const { data, error } = await admin.rpc("credit_settle", { p_reservation: reservationId, p_capture: Math.max(0, Math.round(capture)), p_reason: reason, p_metadata: metadata });
    if (error) throw error;
    const row = (Array.isArray(data) ? data[0] : data) as { captured: number; already_settled: boolean } | undefined;
    return { captured: Number(row?.captured ?? 0), alreadySettled: !!row?.already_settled };
  } catch (e) {
    log.error("credit settle failed", { reservationId, error: (e as Error).message });
    return { captured: 0, alreadySettled: true };
  }
}

/** Settle an operation by outcome, using the live credit costs. */
export async function settleOperation(admin: SupabaseClient, reservationId: string | null | undefined, op: Operation, outcome: Outcome, metadata: Record<string, unknown> = {}): Promise<Settlement> {
  if (!reservationId) return { captured: 0, alreadySettled: true };
  const costs = (await getBillingConfig(admin)).creditCosts;
  const reason = outcome.kind === "failed" ? "system_failure" : "completed";
  return settleCredits(admin, reservationId, captureFor(costs, op, outcome), reason, { ...metadata, outcome });
}

const STALE_MS = 20 * 60_000;

type OpenReservation = { id: string; operation: Operation; ref: string | null; created_at: string; list_credits: number };

/**
 * Safety net for holds whose job died before settling (timeouts, crashes):
 * after 20 minutes, settle from what the database shows was delivered.
 */
export async function sweepStaleReservations(admin: SupabaseClient, userId: string, now = new Date()): Promise<number> {
  const before = new Date(now.getTime() - STALE_MS).toISOString();
  const { data: holds, error } = await admin
    .from("credit_transactions")
    .select("id, operation, ref, created_at, list_credits")
    .eq("user_id", userId)
    .eq("type", "reservation")
    .lt("created_at", before)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  if (!holds?.length) return 0;
  const { data: settled } = await admin.from("credit_transactions").select("reservation_id").eq("user_id", userId).eq("type", "release").in("reservation_id", holds.map((h) => h.id));
  const done = new Set((settled ?? []).map((r) => r.reservation_id as string));
  let n = 0;
  for (const h of holds as OpenReservation[]) {
    if (done.has(h.id)) continue;
    const outcome = await inferOutcome(admin, userId, h);
    await settleOperation(admin, h.id, h.operation, outcome, { settledBy: "sweep" });
    n++;
  }
  return n;
}

async function inferOutcome(admin: SupabaseClient, userId: string, h: OpenReservation): Promise<Outcome> {
  if (!h.ref) return { kind: "failed" };
  if (h.operation === "render") {
    const { data } = await admin.from("renders").select("status").eq("operation_id", h.id).maybeSingle();
    return data?.status === "done" ? { kind: "done" } : { kind: "failed" };
  }
  if (h.operation === "regenerate") {
    const { data } = await admin.from("creative_concepts").select("updated_at, status").eq("id", h.ref).eq("user_id", userId).maybeSingle();
    return data && data.status !== "regenerating" && data.updated_at >= h.created_at ? { kind: "done" } : { kind: "failed" };
  }
  const { data: project } = await admin.from("projects").select("status, brand_profile_id").eq("id", h.ref).eq("user_id", userId).maybeSingle();
  if (h.operation === "analyze_only") return project?.brand_profile_id && project.status !== "analysis_failed" ? { kind: "done" } : { kind: "failed" };
  const { count } = await admin
    .from("creative_concepts")
    .select("id", { count: "exact", head: true })
    .eq("project_id", h.ref)
    .eq("user_id", userId)
    .gte("updated_at", h.created_at);
  return { kind: "concepts", delivered: count ?? 0 };
}
