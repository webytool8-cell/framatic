import type { SupabaseClient } from "@supabase/supabase-js";
import { log } from "@/lib/log";

/** One model call, as measured from the provider's own usage report. */
export type UsageRecord = {
  model: string;
  tool: string;
  attempt: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number | null;
  durationMs: number;
  ok: boolean;
};

export type UsageMeter = (rec: UsageRecord) => Promise<void> | void;

/**
 * List prices in USD per million tokens. Matched by model-id prefix so dated
 * snapshots (claude-sonnet-5-5-2026…) resolve too. Override with
 * FRAMATIC_PRICE_<MODEL>="in,out", e.g. FRAMATIC_PRICE_CLAUDE_SONNET_5_5="2,10".
 */
export const MODEL_PRICES: Record<string, { input: number; output: number }> = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-fable-5-1": { input: 10, output: 50 },
};

export function priceFor(model: string): { input: number; output: number } | null {
  const key = Object.keys(MODEL_PRICES)
    .sort((a, b) => b.length - a.length)
    .find((k) => model.startsWith(k));
  if (!key) return null;
  const env = process.env[`FRAMATIC_PRICE_${key.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`];
  if (env) {
    const [i, o] = env.split(",").map(Number);
    if (Number.isFinite(i) && Number.isFinite(o)) return { input: i, output: o };
  }
  return MODEL_PRICES[key];
}

type ProviderUsage = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
} | null | undefined;

/** Cost of one call. Cache writes bill at 1.25× input, cache reads at 0.1×. */
export function costForUsage(model: string, usage: ProviderUsage): number | null {
  const p = priceFor(model);
  if (!p || !usage) return null;
  const input = (usage.input_tokens ?? 0) + 1.25 * (usage.cache_creation_input_tokens ?? 0) + 0.1 * (usage.cache_read_input_tokens ?? 0);
  return (input * p.input + (usage.output_tokens ?? 0) * p.output) / 1_000_000;
}

export type UsageContext = {
  db: SupabaseClient;
  userId: string;
  projectId?: string | null;
  conceptId?: string | null;
  /** What the call was for: analysis, concept:problem_solution, regenerate, edit… */
  step: string;
};

/** A meter that writes every model call to ai_usage. Never fails the job. */
export function dbMeter(ctx: UsageContext): UsageMeter {
  return async (r) => {
    const { error } = await ctx.db.from("ai_usage").insert({
      user_id: ctx.userId,
      project_id: ctx.projectId ?? null,
      concept_id: ctx.conceptId ?? null,
      step: ctx.step,
      model: r.model,
      attempt: r.attempt,
      input_tokens: r.inputTokens,
      output_tokens: r.outputTokens,
      cache_read_tokens: r.cacheReadTokens,
      cache_write_tokens: r.cacheWriteTokens,
      cost_usd: r.costUsd,
      duration_ms: r.durationMs,
      ok: r.ok,
    });
    if (error) log.warn("couldn't record AI usage", { step: ctx.step, error: error.message });
  };
}

/* ---------- Render (Cloud Run job) cost ---------- */

/**
 * Cloud Run jobs bill for the whole instance lifetime, minimum one minute,
 * at the instance-based rate. Defaults match the deployed job (4 vCPU, 8 GiB)
 * and Tier 1 list prices; override with env if you change either.
 */
export function renderCostUsd(seconds: number): number {
  const vcpu = Number(process.env.FRAMATIC_RENDER_VCPU ?? 4);
  const gib = Number(process.env.FRAMATIC_RENDER_GIB ?? 8);
  const cpuRate = Number(process.env.FRAMATIC_PRICE_RUN_VCPU_SECOND ?? 0.000018);
  const memRate = Number(process.env.FRAMATIC_PRICE_RUN_GIB_SECOND ?? 0.000002);
  const billed = Math.max(60, Math.ceil(seconds));
  return billed * (vcpu * cpuRate + gib * memRate);
}
