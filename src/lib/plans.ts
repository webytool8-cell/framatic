import type { SupabaseClient } from "@supabase/supabase-js";
import type { UsageKind } from "@/lib/rate-limit";

/**
 * Monthly allowances per plan. "projects" counts product links analyzed
 * (including re-reads), "edits" counts AI rewrites (new concept sets,
 * regenerations and plain-language edits), "exports" counts MP4 renders.
 * Months are calendar months in UTC.
 */
export type PlanId = "free" | "starter" | "pro" | "unlimited";
export type Meter = "projects" | "edits" | "exports";

export const PLANS: Record<PlanId, { label: string; limits: Record<Meter, number> }> = {
  free: { label: "Free", limits: { projects: 3, edits: 30, exports: 3 } },
  starter: { label: "Starter", limits: { projects: 20, edits: 300, exports: 40 } },
  pro: { label: "Pro", limits: { projects: 100, edits: 1500, exports: 200 } },
  unlimited: { label: "Unlimited", limits: { projects: Infinity, edits: Infinity, exports: Infinity } },
};

export const METER_FOR: Record<UsageKind, Meter> = { analyze: "projects", generate: "edits", regenerate: "edits", render: "exports" };
export const KINDS_FOR: Record<Meter, UsageKind[]> = { projects: ["analyze"], edits: ["generate", "regenerate"], exports: ["render"] };

export const METER_LABEL: Record<Meter, { one: string; many: string }> = {
  projects: { one: "product link", many: "product links" },
  edits: { one: "AI edit", many: "AI edits" },
  exports: { one: "MP4 export", many: "MP4 exports" },
};

export function quotasEnabled(): boolean {
  return process.env.FRAMATIC_QUOTAS !== "off";
}

export function monthStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function nextMonthStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

export function isPlanId(v: unknown): v is PlanId {
  return typeof v === "string" && v in PLANS;
}

export async function getPlan(db: SupabaseClient, userId: string): Promise<PlanId> {
  const { data } = await db.from("user_plans").select("plan").eq("user_id", userId).maybeSingle();
  return isPlanId(data?.plan) ? data.plan : "free";
}

export type MeterUsage = { meter: Meter; used: number; limit: number };

/** This month's usage for every meter. */
export async function monthlyUsage(db: SupabaseClient, userId: string, now = new Date()): Promise<{ plan: PlanId; meters: MeterUsage[]; resetsAt: Date }> {
  const plan = await getPlan(db, userId);
  const since = monthStart(now).toISOString();
  const meters = await Promise.all(
    (Object.keys(KINDS_FOR) as Meter[]).map(async (meter) => {
      const { count, error } = await db
        .from("usage_events")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .in("kind", KINDS_FOR[meter])
        .gte("created_at", since);
      if (error) throw error;
      return { meter, used: count ?? 0, limit: PLANS[plan].limits[meter] };
    }),
  );
  return { plan, meters, resetsAt: nextMonthStart(now) };
}

export function quotaMessage(meter: Meter, plan: PlanId, limit: number, resetsAt: Date): string {
  const when = resetsAt.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
  return `You've used all ${limit} ${limit === 1 ? METER_LABEL[meter].one : METER_LABEL[meter].many} on the ${PLANS[plan].label} plan this month. They reset on ${when}. See Settings → Plan & usage.`;
}
