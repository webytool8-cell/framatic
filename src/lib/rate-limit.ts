import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChargeKind } from "@/lib/plans";

/**
 * Hourly abuse limits (separate from credits, which live in the ledger:
 * see src/lib/credits.ts). Attempts are recorded in usage_events.
 */
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
  regenerate: "AI reworks",
  render: "video exports",
  redeem: "access code attempts",
};

export class RateLimitError extends Error {
  constructor(public readonly kind: UsageKind, public readonly retryAfterMinutes: number) {
    super(`You've reached the hourly limit for ${HOURLY_LABEL[kind]}. Try again in about ${retryAfterMinutes} minutes.`);
    this.name = "RateLimitError";
  }
}

/** Not enough credits left this period. Answered with HTTP 429. */
export class OutOfCreditsError extends RateLimitError {
  constructor(kind: ChargeKind, message: string, retryAfterMinutes: number) {
    super(kind, retryAfterMinutes);
    this.name = "OutOfCreditsError";
    this.message = message;
  }
}

const IN_PROGRESS: Record<string, string> = {
  analyze: "This project is already being worked on.",
  analyze_only: "This page is already being read.",
  generate: "Concepts are already being written for this project.",
  regenerate: "This concept is already being reworked.",
  render: "This version is already exporting.",
};

/** The same operation is already running on the same thing. Answered with HTTP 409. */
export class OperationInProgressError extends Error {
  constructor(public readonly operation: string) {
    super(IN_PROGRESS[operation] ?? "That's already in progress.");
    this.name = "OperationInProgressError";
  }
}

/** Sliding-window hourly limit. */
export async function checkHourly(admin: SupabaseClient, userId: string, kind: UsageKind): Promise<void> {
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

export async function recordAttempt(admin: SupabaseClient, userId: string, kind: UsageKind): Promise<void> {
  const { error } = await admin.from("usage_events").insert({ user_id: userId, kind, credits: 0 });
  if (error) throw error;
}

/** Hourly limit for non-credit actions (access codes). Records the attempt. */
export async function consumeAttempt(admin: SupabaseClient, userId: string, kind: "redeem"): Promise<void> {
  await checkHourly(admin, userId, kind);
  await recordAttempt(admin, userId, kind);
}
