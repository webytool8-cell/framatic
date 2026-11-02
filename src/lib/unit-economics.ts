import type { BillingConfig } from "@/lib/billing-config";
import { PLANS, PUBLIC_PLANS, type PlanId } from "@/lib/plans";

/**
 * Unit economics for the admin dashboard: what each operation really costs,
 * how that compares to the credits it earns, and the margin each plan makes.
 * Pure functions over raw rows so the numbers are testable.
 */
export type LedgerTx = {
  id: string;
  user_id: string;
  type: string;
  operation: string | null;
  amount: number;
  list_credits: number | null;
  reservation_id: string | null;
  reason: string | null;
  plan: string | null;
  created_at: string;
};
export type AICost = { operation_id: string | null; cost_usd: number | string | null; ok: boolean };
export type OtherCost = { operation_id: string | null; operation: string | null; category: string; cost_usd: number | string };

export const OPERATIONS = ["analyze", "analyze_only", "generate", "regenerate", "render"] as const;
export type Op = (typeof OPERATIONS)[number];
export const OP_LABEL: Record<Op, string> = {
  analyze: "New project (page + 3 concepts)",
  analyze_only: "Re-read product page",
  generate: "Three fresh concepts",
  regenerate: "AI edit",
  render: "MP4 export",
};

export type OpStatus = "completed" | "partial" | "failed" | "open";
export type OpRecord = { id: string; userId: string; operation: Op; plan: string | null; listed: number; captured: number; status: OpStatus; cost: number; createdAt: string };

export type OpStats = {
  operation: Op;
  count: number;
  completed: number;
  failed: number;
  open: number;
  failureRate: number;
  avgCost: number;
  avgCredits: number;
  costPerCredit: number | null;
  ceiling: number;
  overCeiling: number;
  wasted: number;
};

export type TierMargin = {
  plan: PlanId;
  credits: number;
  monthly: { price: number; net: number; revenuePerCredit: number; margin: number | null };
  yearly: { price: number; net: number; revenuePerCredit: number; margin: number | null };
};

export type Economics = {
  ops: OpRecord[];
  byOperation: OpStats[];
  totals: { ai: number; compute: number; render: number; storage: number; delivery: number; other: number; all: number; unattributed: number; wastedOnFailures: number };
  finishedVideos: number;
  costPerFinishedVideo: number | null;
  firstVideoCost: number | null;
  credits: { allocated: number; consumed: number; held: number; utilization: number | null };
  costPerCredit: number | null;
  costPerCreditIsEstimate: boolean;
  failureRate: number | null;
  tiers: TierMargin[];
  highUsage: { userId: string; credits: number; cost: number }[];
};

const num = (v: unknown) => (v === null || v === undefined || v === "" ? 0 : Number(v));

/** Settle each reservation into one operation record with its attributed cost. */
export function buildOps(ledger: LedgerTx[], ai: AICost[], other: OtherCost[]): OpRecord[] {
  const costBy = new Map<string, number>();
  for (const r of ai) if (r.operation_id) costBy.set(r.operation_id, (costBy.get(r.operation_id) ?? 0) + num(r.cost_usd));
  for (const r of other) if (r.operation_id) costBy.set(r.operation_id, (costBy.get(r.operation_id) ?? 0) + num(r.cost_usd));
  const captures = new Map<string, number>();
  const releases = new Map<string, string | null>();
  for (const t of ledger) {
    if (t.type === "capture" && t.reservation_id) captures.set(t.reservation_id, num(t.list_credits));
    if (t.type === "release" && t.reservation_id) releases.set(t.reservation_id, t.reason);
  }
  return ledger
    .filter((t) => t.type === "reservation" && t.operation)
    .map((t) => {
      const listed = num(t.list_credits);
      const captured = captures.get(t.id) ?? 0;
      const settled = releases.has(t.id);
      const status: OpStatus = !settled ? "open" : captured === 0 ? "failed" : captured < listed ? "partial" : "completed";
      return { id: t.id, userId: t.user_id, operation: t.operation as Op, plan: t.plan, listed, captured, status, cost: costBy.get(t.id) ?? 0, createdAt: t.created_at };
    });
}

/** Payment-processor fees for one charge. */
export function netOfFees(price: number, cfg: BillingConfig): number {
  if (price <= 0) return 0;
  return Math.max(0, price - (price * cfg.prices.stripePercent) / 100 - cfg.prices.stripeFixed);
}

/**
 * Fallback before there's measured data, from list prices: a new project
 * ≈ $0.15 (Haiku analysis + 3 Sonnet concepts) for 10 credits, an AI edit
 * ≈ $0.045 for 2, an export ≈ $0.006 for 1. A typical project (project, two
 * edits, two exports = 16 credits ≈ $0.25) works out at ~1.6¢ per credit.
 */
export const ESTIMATED_COST_PER_CREDIT = 0.016;

export function tierMargins(costPerCredit: number | null, cfg: BillingConfig): TierMargin[] {
  const cpc = costPerCredit ?? ESTIMATED_COST_PER_CREDIT;
  return PUBLIC_PLANS.filter((p) => (PLANS[p].priceMonthly ?? 0) > 0).map((p) => {
    const plan = PLANS[p];
    const m = plan.priceMonthly ?? 0;
    const y = plan.priceYearlyPerMonth ?? m;
    const mNet = netOfFees(m, cfg);
    // Yearly is one charge a year, so the fixed fee spreads over 12 months.
    const yNet = netOfFees(y * 12, cfg) / 12;
    const rpcM = mNet / plan.credits;
    const rpcY = yNet / plan.credits;
    return {
      plan: p,
      credits: plan.credits,
      monthly: { price: m, net: mNet, revenuePerCredit: rpcM, margin: rpcM > 0 ? 1 - cpc / rpcM : null },
      yearly: { price: y, net: yNet, revenuePerCredit: rpcY, margin: rpcY > 0 ? 1 - cpc / rpcY : null },
    };
  });
}

export function buildEconomics(input: {
  ledger: LedgerTx[];
  ai: AICost[];
  other: OtherCost[];
  doneRenders: number;
  cfg: BillingConfig;
  now?: Date;
}): Economics {
  const { ledger, ai, other, cfg } = input;
  const ops = buildOps(ledger, ai, other);
  const opIds = new Set(ops.map((o) => o.id));

  const byOperation: OpStats[] = OPERATIONS.map((operation) => {
    const list = ops.filter((o) => o.operation === operation);
    const done = list.filter((o) => o.status === "completed" || o.status === "partial");
    const failed = list.filter((o) => o.status === "failed");
    const settled = done.length + failed.length;
    const credits = done.reduce((a, o) => a + o.captured, 0);
    const doneCost = done.reduce((a, o) => a + o.cost, 0);
    const ceiling = cfg.costCeilings[operation];
    return {
      operation,
      count: list.length,
      completed: done.length,
      failed: failed.length,
      open: list.filter((o) => o.status === "open").length,
      failureRate: settled ? failed.length / settled : 0,
      avgCost: done.length ? doneCost / done.length : 0,
      avgCredits: done.length ? credits / done.length : 0,
      costPerCredit: credits ? doneCost / credits : null,
      ceiling,
      overCeiling: done.filter((o) => o.cost > ceiling).length,
      wasted: failed.reduce((a, o) => a + o.cost, 0),
    };
  });

  const cat = (c: string) => other.filter((r) => r.category === c).reduce((a, r) => a + num(r.cost_usd), 0);
  const aiTotal = ai.reduce((a, r) => a + num(r.cost_usd), 0);
  const totals = {
    ai: aiTotal,
    compute: cat("compute"),
    render: cat("render"),
    storage: cat("storage"),
    delivery: cat("delivery"),
    other: cat("other"),
    all: 0,
    unattributed:
      ai.filter((r) => !r.operation_id || !opIds.has(r.operation_id)).reduce((a, r) => a + num(r.cost_usd), 0) +
      other.filter((r) => !r.operation_id || !opIds.has(r.operation_id)).reduce((a, r) => a + num(r.cost_usd), 0),
    wastedOnFailures: byOperation.reduce((a, s) => a + s.wasted, 0),
  };
  totals.all = totals.ai + totals.compute + totals.render + totals.storage + totals.delivery + totals.other;

  const allocated = ledger.filter((t) => t.type === "allocation").reduce((a, t) => a + num(t.amount), 0);
  const consumed = ledger.filter((t) => t.type === "capture").reduce((a, t) => a + num(t.list_credits), 0);
  const held = ops.filter((o) => o.status === "open").reduce((a, o) => a + o.listed, 0);

  // Cost per credit from everything we spent (including failures and unattributed
  // calls) over the credits actually charged: the honest number for margins.
  const costPerCredit = consumed > 0 ? totals.all / consumed : null;

  const project = byOperation.find((s) => s.operation === "analyze")!;
  const render = byOperation.find((s) => s.operation === "render")!;
  const settled = ops.filter((o) => o.status !== "open");

  const perUser = new Map<string, { credits: number; cost: number }>();
  for (const o of ops) {
    const u = perUser.get(o.userId) ?? { credits: 0, cost: 0 };
    u.credits += o.captured;
    u.cost += o.cost;
    perUser.set(o.userId, u);
  }
  const avgCredits = perUser.size ? [...perUser.values()].reduce((a, u) => a + u.credits, 0) / perUser.size : 0;
  const highUsage = [...perUser.entries()]
    .map(([userId, u]) => ({ userId, ...u }))
    .filter((u) => perUser.size >= 3 && u.credits > Math.max(50, avgCredits * 3))
    .sort((a, b) => b.credits - a.credits)
    .slice(0, 10);

  return {
    ops,
    byOperation,
    totals,
    finishedVideos: input.doneRenders,
    costPerFinishedVideo: input.doneRenders ? totals.all / input.doneRenders : null,
    firstVideoCost: project.completed && render.completed ? project.avgCost + render.avgCost : null,
    credits: { allocated, consumed, held, utilization: allocated ? consumed / allocated : null },
    costPerCredit,
    costPerCreditIsEstimate: costPerCredit === null,
    failureRate: settled.length ? settled.filter((o) => o.status === "failed").length / settled.length : null,
    tiers: tierMargins(costPerCredit, cfg),
    highUsage,
  };
}
