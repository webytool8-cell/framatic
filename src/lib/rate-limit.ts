import type { SupabaseClient } from "@supabase/supabase-js";
import { CREDIT_COST, creditBalance, creditsEnabled, getPlan, outOfCreditsMessage, type ChargeKind } from "@/lib/plans";
import { log } from "@/lib/log";

export type UsageKind = ChargeKind | "redeem";

export const LIMITS: Record<UsageKind, { max: number; windowMinutes: number }> = {
  analyze: { max: Number(process.env.FRAMATIC_LIMIT_ANALYZE_PER_HOUR ?? 10), windowMinutes: 60 },
  generate: { max: Number(process.env.FRAMATIC_LIMIT_GENERATE_PER_HOUR ?? 10), windowMinutes: 60 },
  regenerate: { max: Number(process.env.FRAMATIC_LIMIT_REGENERATE_PER_HOUR ?? 40), windowMinutes: 60 },
  render: { max: Number(process.env.FRAMATIC_LIMIT_RENDER_PER_HOUR ?? 20), windowMinutes: 60 },
  redeem: { max: 5, windowMinutes: 60 },
};

const HOURLY_LABEL: Record<UsageKind, string> = {
  analyze: "new projects",
  generate: "concept generation",
  regenerate: "AI edits",
  render: "video exports",
  redeem: "access code attempts",
};

export class RateLimitError extends Error {
  constructor(public readonly kind: UsageKind, public readonly retryAfterMinutes: number) {
    super(`You've reached the hourly limit for ${HOURLY_LABEL[kind]}. Try again in about ${retryAfterMinutes} minutes.`);
    this.name = "RateLimitError";
  }
}

/** Not enough credits left this period. Handled like a rate limit (HTTP 429). */
export class OutOfCreditsError extends RateLimitError {
  constructor(kind: ChargeKind, message: string, retryAfterMinutes: number) {
    super(kind, retryAfterMinutes);
    this.name = "OutOfCreditsError";
    this.message = message;
  }
}

/** Sliding-window hourly limit (abuse protection, separate from credits). */
async function checkHourly(admin: SupabaseClient, userId: string, kind: UsageKind): Promise<void> {
  const { max, windowMinutes } = LIMITS[kind];
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString();
  const { data, count, error } = await admin
    .from("usage_events")
    .select("created_at", { count: "exact" })
    .eq("user_id", userId)
    .eq("kind", kind)
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) throw error;
  if ((count ?? 0) >= max) {
    const oldest = data?.[0]?.created_at ? new Date(data[0].created_at).getTime() : Date.now();
    const retry = Math.max(1, Math.ceil((oldest + windowMinutes * 60_000 - Date.now()) / 60_000));
    throw new RateLimitError(kind, retry);
  }
}

/**
 * Charge for an action: hourly limit, then credits. Records the usage row
 * (with the credits spent) and returns its id. `ref` (project, concept or
 * render id) lets a failed job refund exactly this charge.
 * Unlimited accounts skip both checks but are still recorded.
 */
export async function chargeCredits(admin: SupabaseClient, userId: string, kind: ChargeKind, ref?: string | null, now = new Date()): Promise<number | null> {
  const unlimited = (await getPlan(admin, userId)) === "unlimited";
  if (!unlimited) await checkHourly(admin, userId, kind);
  const cost = creditsEnabled() && !unlimited ? CREDIT_COST[kind] : 0;
  if (cost > 0) {
    const balance = await creditBalance(admin, userId, now);
    if (balance.left < cost) {
      throw new OutOfCreditsError(kind, outOfCreditsMessage(kind, balance), Math.ceil((balance.resetsAt.getTime() - now.getTime()) / 60_000));
    }
  }
  const { data, error } = await admin.from("usage_events").insert({ user_id: userId, kind, credits: cost, ref: ref ?? null }).select("id").single();
  if (error) throw error;
  return (data as { id?: number } | null)?.id ?? null;
}

/** Back-compat name used by routes: charge credits for `kind`. */
export async function consumeRateLimit(admin: SupabaseClient, userId: string, kind: ChargeKind, ref?: string | null): Promise<void> {
  await chargeCredits(admin, userId, kind, ref);
}

/** Hourly limit for non-credit actions (access codes). Records the attempt. */
export async function consumeAttempt(admin: SupabaseClient, userId: string, kind: "redeem"): Promise<void> {
  await checkHourly(admin, userId, kind);
  const { error } = await admin.from("usage_events").insert({ user_id: userId, kind, credits: 0 });
  if (error) throw error;
}

/**
 * Give back the most recent charge for `ref` if it hasn't been refunded yet.
 * Called when a job produces nothing usable. Never throws.
 */
export async function refundLatestCharge(admin: SupabaseClient, userId: string, ref: string, reason: string): Promise<number> {
  try {
    const { data: charges, error } = await admin
      .from("usage_events")
      .select("id, kind, credits, created_at")
      .eq("user_id", userId)
      .eq("ref", ref)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    const charge = (charges ?? []).find((c) => (c as { kind: string }).kind !== "refund" && Number((c as { credits: number }).credits) > 0) as { id: number; credits: number } | undefined;
    if (!charge) return 0;
    const refundRef = `refund:${charge.id}`;
    const { data: done } = await admin.from("usage_events").select("id").eq("user_id", userId).eq("ref", refundRef).limit(1);
    if (done?.length) return 0;
    const { error: insErr } = await admin.from("usage_events").insert({ user_id: userId, kind: "refund", credits: -Number(charge.credits), ref: refundRef });
    if (insErr) throw insErr;
    log.info("credits refunded", { userId, ref, credits: charge.credits, reason });
    return Number(charge.credits);
  } catch (e) {
    log.warn("refund failed", { ref, error: (e as Error).message });
    return 0;
  }
}

/** Attach a charge to the thing it paid for (once that thing has an id). */
export async function setChargeRef(admin: SupabaseClient, chargeId: number, ref: string): Promise<void> {
  const { error } = await admin.from("usage_events").update({ ref }).eq("id", chargeId);
  if (error) log.warn("couldn't tag charge", { chargeId, error: error.message });
}
