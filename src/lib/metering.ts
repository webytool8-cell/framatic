import type { SupabaseClient } from "@supabase/supabase-js";
import { getBillingConfig } from "@/lib/billing-config";
import { renderCostUsd } from "@/lib/ai/usage";
import { log } from "@/lib/log";

/**
 * Non-AI cost events (compute, rendering, storage, delivery), each linked to
 * the credit operation that paid for it. AI calls are metered separately in
 * ai_usage with the same operation id. Costs are list-price estimates.
 */
export type CostCategory = "compute" | "render" | "storage" | "delivery" | "image" | "other";

export async function recordCost(
  db: SupabaseClient,
  e: { userId: string; operationId?: string | null; operation?: string | null; category: CostCategory; quantity: number; unit: string; costUsd: number; detail?: Record<string, unknown> },
): Promise<void> {
  const { error } = await db.from("cost_events").insert({
    user_id: e.userId,
    operation_id: e.operationId ?? null,
    operation: e.operation ?? null,
    category: e.category,
    quantity: e.quantity,
    unit: e.unit,
    cost_usd: Number(e.costUsd.toFixed(6)),
    detail: e.detail ?? {},
  });
  if (error) log.warn("couldn't record cost", { category: e.category, error: error.message });
}

/** Serverless time spent on a background job (crawl, waiting on AI, saving). */
export async function recordComputeCost(db: SupabaseClient, userId: string, operationId: string | null | undefined, operation: string, ms: number): Promise<void> {
  const { prices } = await getBillingConfig(db);
  const seconds = Math.max(0, ms / 1000);
  await recordCost(db, { userId, operationId, operation, category: "compute", quantity: Number(seconds.toFixed(2)), unit: "second", costUsd: seconds * prices.computePerSecond });
}

const GB = 1024 ** 3;

/** Rendering (Cloud Run lifetime, 60s minimum), one month of storage, and expected downloads. */
export async function recordRenderCosts(
  db: SupabaseClient,
  r: { userId: string; operationId?: string | null; renderId: string; seconds: number; sizeBytes: number | null; done: boolean },
): Promise<void> {
  const { prices } = await getBillingConfig(db);
  const base = { userId: r.userId, operationId: r.operationId, operation: "render" };
  await recordCost(db, { ...base, category: "render", quantity: Math.round(r.seconds), unit: "second", costUsd: renderCostUsd(r.seconds), detail: { renderId: r.renderId, done: r.done } });
  if (r.done && r.sizeBytes) {
    const gb = r.sizeBytes / GB;
    await recordCost(db, { ...base, category: "storage", quantity: r.sizeBytes, unit: "byte-month", costUsd: gb * prices.storageGbMonth, detail: { renderId: r.renderId } });
    await recordCost(db, { ...base, category: "delivery", quantity: r.sizeBytes * prices.downloadsPerVideo, unit: "byte", costUsd: gb * prices.egressGb * prices.downloadsPerVideo, detail: { renderId: r.renderId, downloads: prices.downloadsPerVideo } });
  }
}
