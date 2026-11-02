import type { SupabaseClient } from "@supabase/supabase-js";
import type { CrawlOptions } from "@/lib/analyzer/crawl";
import { isLLMConfigured } from "@/lib/ai/llm";
import { getProject, setProjectStatus } from "@/lib/db/repo";
import { analyzeProject } from "./analyze-project";
import { generateAllConcepts } from "./concepts";
import { refundLatestCharge } from "@/lib/rate-limit";

/**
 * The hands-off path: read the website, build the brand profile, then go
 * straight on to three concepts — no review step in between.
 */
export async function runAutopilot(db: SupabaseClient, userId: string, projectId: string, crawlOptions?: CrawlOptions) {
  await analyzeProject(db, userId, projectId, crawlOptions);
  const project = await getProject(db, userId, projectId);
  if (project?.status !== "analyzed" || !project.brand_profile_id) return;
  if (!isLLMConfigured()) {
    // Brand profile is ready; concepts need an AI key. Nothing to charge for.
    await refundLatestCharge(db, userId, projectId, "AI not configured");
    return;
  }
  await setProjectStatus(db, userId, projectId, "generating", "Writing three ad concepts…");
  await generateAllConcepts(db, userId, projectId);
}
