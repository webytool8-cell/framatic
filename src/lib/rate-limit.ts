import type { SupabaseClient } from "@supabase/supabase-js";

export type UsageKind = "analyze" | "generate" | "regenerate" | "render";

export const LIMITS: Record<UsageKind, { max: number; windowMinutes: number }> = {
  analyze: { max: Number(process.env.FRAMATIC_LIMIT_ANALYZE_PER_HOUR ?? 10), windowMinutes: 60 },
  generate: { max: Number(process.env.FRAMATIC_LIMIT_GENERATE_PER_HOUR ?? 10), windowMinutes: 60 },
  regenerate: { max: Number(process.env.FRAMATIC_LIMIT_REGENERATE_PER_HOUR ?? 40), windowMinutes: 60 },
  render: { max: Number(process.env.FRAMATIC_LIMIT_RENDER_PER_HOUR ?? 20), windowMinutes: 60 },
};

export class RateLimitError extends Error {
  constructor(public readonly kind: UsageKind, public readonly retryAfterMinutes: number) {
    super(`You've reached the hourly limit for ${kind === "analyze" ? "link analyses" : kind === "render" ? "video exports" : "concept generation"}. Try again in about ${retryAfterMinutes} minutes.`);
    this.name = "RateLimitError";
  }
}

/**
 * Sliding-window limit backed by the usage_events table (works across
 * serverless instances). Uses the service-role client; usage rows are
 * not writable by users.
 */
export async function consumeRateLimit(admin: SupabaseClient, userId: string, kind: UsageKind): Promise<void> {
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
  const { error: insErr } = await admin.from("usage_events").insert({ user_id: userId, kind });
  if (insErr) throw insErr;
}
