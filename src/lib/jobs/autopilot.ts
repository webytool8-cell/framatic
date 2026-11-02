import type { SupabaseClient } from "@supabase/supabase-js";
import type { CrawlOptions } from "@/lib/analyzer/crawl";
import { isLLMConfigured } from "@/lib/ai/llm";
import { settleOperation } from "@/lib/credits";
import { recordComputeCost } from "@/lib/metering";
import { setProjectStatus } from "@/lib/db/repo";
import { analyzeProject } from "./analyze-project";
import { generateAllConcepts } from "./concepts";
import { log } from "@/lib/log";

/**
 * The hands-off path: read the product page, build the brand profile, then go
 * straight on to three concepts. Settles the credit hold with what was
 * delivered: nothing is charged if no concepts came out of it.
 */
export async function runAutopilot(db: SupabaseClient, userId: string, projectId: string, crawlOptions?: CrawlOptions, operationId?: string) {
  const t0 = Date.now();
  let delivered = 0;
  let analyzed = false;
  try {
    analyzed = await analyzeProject(db, userId, projectId, crawlOptions, operationId);
    if (analyzed && isLLMConfigured()) {
      await setProjectStatus(db, userId, projectId, "generating", "Writing three ad concepts…");
      delivered = await generateAllConcepts(db, userId, projectId, operationId);
    }
  } catch (e) {
    log.error("autopilot crashed", { projectId, error: (e as Error).message });
  } finally {
    await settleOperation(db, operationId, "analyze", analyzed ? { kind: "concepts", delivered } : { kind: "failed" }, { projectId });
    if (operationId) await recordComputeCost(db, userId, operationId, "analyze", Date.now() - t0);
  }
}

/** Re-read the product page only (keeps concepts). Charged only if it worked. */
export async function runAnalyzeOnly(db: SupabaseClient, userId: string, projectId: string, operationId?: string) {
  const t0 = Date.now();
  let ok = false;
  try {
    ok = await analyzeProject(db, userId, projectId, undefined, operationId);
  } finally {
    await settleOperation(db, operationId, "analyze_only", ok ? { kind: "done" } : { kind: "failed" }, { projectId });
    if (operationId) await recordComputeCost(db, userId, operationId, "analyze_only", Date.now() - t0);
  }
}

/** New concept set for an existing project. Charged per concept delivered. */
export async function runGenerate(db: SupabaseClient, userId: string, projectId: string, operationId?: string) {
  const t0 = Date.now();
  let delivered = 0;
  try {
    delivered = await generateAllConcepts(db, userId, projectId, operationId);
  } finally {
    await settleOperation(db, operationId, "generate", { kind: "concepts", delivered }, { projectId });
    if (operationId) await recordComputeCost(db, userId, operationId, "generate", Date.now() - t0);
  }
}
