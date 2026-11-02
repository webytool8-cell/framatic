import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Plans and credits. One place for every number the pricing page, Settings
 * and the server-side checks use. Prices are placeholders until Stripe.
 *
 * What a credit is worth: a new project (page analysis + 3 concepts) costs us
 * roughly 15–30¢ in AI, an edit ~5¢, an MP4 export under 1¢. Credit costs are
 * set so 1 credit ≈ 2–3¢ of spend at worst, so every paid plan stays above
 * ~20% margin even if a user spends every credit, and far above it typically.
 */
export type PlanId = "free" | "starter" | "pro" | "studio" | "unlimited";
export type ChargeKind = "analyze" | "generate" | "regenerate" | "render";
export type CreditCosts = Record<ChargeKind, number>;

export type Plan = {
  id: PlanId;
  label: string;
  /** USD per month; null = not for sale. */
  priceMonthly: number | null;
  /** USD per month when billed yearly. */
  priceYearlyPerMonth: number | null;
  credits: number;
  tagline: string;
  features: string[];
  highlight?: boolean;
};

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    label: "Free",
    priceMonthly: 0,
    priceYearlyPerMonth: 0,
    credits: 30,
    tagline: "Try it on your own products.",
    features: ["30 credits every month", "All ad formats: 9:16, 1:1, 4:5, 16:9", "Full music and sound library", "1080p MP4 export"],
  },
  starter: {
    id: "starter",
    label: "Starter",
    priceMonthly: 19,
    priceYearlyPerMonth: 15,
    credits: 300,
    tagline: "For a store testing ads every week.",
    features: ["300 credits every month", "Everything in Free", "Brand profiles saved for every product", "Email support"],
  },
  pro: {
    id: "pro",
    label: "Pro",
    priceMonthly: 49,
    priceYearlyPerMonth: 39,
    credits: 1000,
    tagline: "For brands running ads on every channel.",
    features: ["1,000 credits every month", "Everything in Starter", "Priority rendering queue", "Early access to new ad styles"],
    highlight: true,
  },
  studio: {
    id: "studio",
    label: "Studio",
    priceMonthly: 149,
    priceYearlyPerMonth: 119,
    credits: 2500,
    tagline: "For agencies and multi-brand teams.",
    features: ["2,500 credits every month", "Everything in Pro", "Made for many brands and clients", "Priority support"],
  },
  unlimited: {
    id: "unlimited",
    label: "Unlimited",
    priceMonthly: null,
    priceYearlyPerMonth: null,
    credits: Infinity,
    tagline: "Internal access.",
    features: [],
  },
};

/** Plans shown on the pricing page, in order. */
export const PUBLIC_PLANS: PlanId[] = ["free", "starter", "pro", "studio"];

/**
 * Default credits per action. The live values come from billing_config
 * (editable on /admin/usage) via getCreditCosts(); these are the fallback.
 */
export const CREDIT_COST: CreditCosts = {
  analyze: 10, // new project: read the product page, then write 3 concepts
  generate: 6, // "try three new ones"
  regenerate: 2, // one AI edit or regenerated concept
  render: 1, // one MP4 export
};

export const CREDIT_ACTIONS: { kind: ChargeKind; label: string; detail: string }[] = [
  { kind: "analyze", label: "New ad project", detail: "Reads your product page and writes 3 complete ad concepts" },
  { kind: "generate", label: "Three fresh concepts", detail: "A new set of 3 for an existing project" },
  { kind: "regenerate", label: "AI rework", detail: "Have the AI rewrite a concept from a plain-words request" },
  { kind: "render", label: "MP4 export", detail: "One finished 1080p video, any format" },
];

export const KIND_LABEL: Record<string, string> = {
  analyze: "New project",
  generate: "Three fresh concepts",
  regenerate: "AI rework",
  analyze_only: "Re-read product page",
  render: "MP4 export",
  refund: "Refund",
  redeem: "Access code",
  allocation: "Monthly credits",
  expiry: "Unused credits expired",
  purchase: "Credit pack",
  adjustment: "Adjustment",
};

/** Credits a typical project uses: the project, two AI edits and two exports. */
export function typicalProjectCredits(costs: CreditCosts = CREDIT_COST): number {
  return costs.analyze + 2 * costs.regenerate + 2 * costs.render;
}

/** Roughly how many projects a plan's credits cover with a few edits and exports each. */
export function projectsPerMonth(credits: number, costs: CreditCosts = CREDIT_COST): number {
  return Math.floor(credits / typicalProjectCredits(costs));
}

export function creditsEnabled(): boolean {
  return process.env.FRAMATIC_QUOTAS !== "off" && process.env.FRAMATIC_CREDITS !== "off";
}

export function isPlanId(v: unknown): v is PlanId {
  return typeof v === "string" && v in PLANS;
}

export type PlanRow = { plan: PlanId; currentPeriodStart: Date | null };

export async function getPlanRow(db: SupabaseClient, userId: string): Promise<PlanRow> {
  const { data } = await db.from("user_plans").select("plan, current_period_start").eq("user_id", userId).maybeSingle();
  return {
    plan: isPlanId(data?.plan) ? data.plan : "free",
    currentPeriodStart: data?.current_period_start ? new Date(data.current_period_start) : null,
  };
}

export async function getPlan(db: SupabaseClient, userId: string): Promise<PlanId> {
  return (await getPlanRow(db, userId)).plan;
}

function addMonthsUTC(d: Date, n: number): Date {
  const r = new Date(d);
  const day = r.getUTCDate();
  r.setUTCDate(1);
  r.setUTCMonth(r.getUTCMonth() + n);
  const last = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)).getUTCDate();
  r.setUTCDate(Math.min(day, last));
  return r;
}

/**
 * The current credit period: from the billing anchor (Stripe, later) or the
 * 1st of the month (UTC) until one month later.
 */
export function creditPeriod(now = new Date(), anchor: Date | null = null): { start: Date; end: Date } {
  if (!anchor) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    return { start, end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)) };
  }
  const n = monthsBetween(anchor, now);
  let start = addMonthsUTC(anchor, n);
  if (start > now) start = addMonthsUTC(anchor, n - 1);
  return { start, end: addMonthsUTC(start, 1) };
}

function monthsBetween(a: Date, b: Date): number {
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
}

export type CreditBalance = {
  plan: PlanId;
  /** Credits allocated this period (plan allowance, plus any upgrade top-up). */
  allowance: number;
  /** Credits charged this period, at list price. */
  used: number;
  /** Credits on hold for operations still running. */
  held: number;
  left: number;
  unlimited: boolean;
  periodStart: Date;
  resetsAt: Date;
};

export function formatResetDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
}

export function outOfCreditsMessage(kind: ChargeKind, b: Pick<CreditBalance, "left" | "plan" | "resetsAt">, need: number): string {
  const what = KIND_LABEL[kind].toLowerCase();
  return `A ${what} uses ${need} credit${need === 1 ? "" : "s"} and you have ${b.left} left on the ${PLANS[b.plan].label} plan. Credits refill on ${formatResetDate(b.resetsAt)}, or see Pricing for a bigger plan.`;
}
