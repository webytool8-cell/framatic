import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CREDIT_COST, type CreditCosts } from "@/lib/plans";
import { log } from "@/lib/log";

/**
 * Pricing knobs that change without a deploy: credits per operation, internal
 * cost ceilings, and the unit prices used to estimate non-AI costs. Stored in
 * billing_config (one row) and edited on /admin/usage.
 */
const Credits = z.number().int().min(0).max(1000);
const Usd = z.number().min(0).max(100);

export const BillingConfig = z.object({
  creditCosts: z.object({ analyze: Credits, generate: Credits, regenerate: Credits, render: Credits }),
  /** Most an operation should cost us (USD). Over-ceiling operations are flagged. */
  costCeilings: z.object({ analyze: Usd, analyze_only: Usd, generate: Usd, regenerate: Usd, render: Usd }),
  prices: z.object({
    /** Serverless compute per second of job time (Vercel Fluid, ~1 vCPU / 2 GB). */
    computePerSecond: z.number().min(0),
    storageGbMonth: z.number().min(0),
    egressGb: z.number().min(0),
    /** Downloads assumed per finished video when estimating delivery. */
    downloadsPerVideo: z.number().min(0).max(100),
    stripePercent: z.number().min(0).max(20),
    stripeFixed: z.number().min(0).max(5),
  }),
  targets: z.object({ targetMargin: z.number().min(0).max(1), minMargin: z.number().min(0).max(1) }),
});
export type BillingConfig = z.infer<typeof BillingConfig>;

export const DEFAULT_BILLING: BillingConfig = {
  creditCosts: { ...CREDIT_COST },
  costCeilings: { analyze: 0.3, analyze_only: 0.08, generate: 0.25, regenerate: 0.08, render: 0.02 },
  prices: { computePerSecond: 0.00004, storageGbMonth: 0.021, egressGb: 0.09, downloadsPerVideo: 1, stripePercent: 2.9, stripeFixed: 0.3 },
  targets: { targetMargin: 0.8, minMargin: 0.7 },
};

/** Merge a stored (possibly partial or outdated) config over the defaults. */
export function mergeBillingConfig(stored: unknown): BillingConfig {
  const s = (stored && typeof stored === "object" ? stored : {}) as Partial<Record<keyof BillingConfig, object>>;
  const merged = {
    creditCosts: { ...DEFAULT_BILLING.creditCosts, ...(s.creditCosts ?? {}) },
    costCeilings: { ...DEFAULT_BILLING.costCeilings, ...(s.costCeilings ?? {}) },
    prices: { ...DEFAULT_BILLING.prices, ...(s.prices ?? {}) },
    targets: { ...DEFAULT_BILLING.targets, ...(s.targets ?? {}) },
  };
  const parsed = BillingConfig.safeParse(merged);
  if (!parsed.success) {
    log.warn("billing_config invalid, using defaults", { issues: parsed.error.issues.slice(0, 5).map((i) => i.path.join(".")) });
    return DEFAULT_BILLING;
  }
  return parsed.data;
}

let cache: { at: number; value: BillingConfig } | null = null;
const TTL_MS = 30_000;

/** Current billing config (cached for 30s per server instance). */
export async function getBillingConfig(db: SupabaseClient): Promise<BillingConfig> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const { data, error } = await db.from("billing_config").select("data").eq("id", 1).maybeSingle();
  if (error) log.warn("billing_config unavailable, using defaults", { error: error.message });
  const value = mergeBillingConfig(data?.data);
  cache = { at: Date.now(), value };
  return value;
}

export async function getCreditCosts(db: SupabaseClient): Promise<CreditCosts> {
  return (await getBillingConfig(db)).creditCosts;
}

export function clearBillingConfigCache() {
  cache = null;
}
