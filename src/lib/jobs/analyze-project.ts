import type { SupabaseClient } from "@supabase/supabase-js";
import { crawlSite, CrawlError, type CrawlOptions, type SiteAnalysis } from "@/lib/analyzer/crawl";
import { buildBrandProfile, extractionOnlyProfile } from "@/lib/brand/intelligence";
import { mergeReanalysis } from "@/lib/brand/merge";
import { BrandProfileSchema, CampaignObjective, type BrandProfile } from "@/lib/brand/schema";
import { describeLLMError, getLLM, isLLMConfigured } from "@/lib/ai/llm";
import { dbMeter } from "@/lib/ai/usage";
import { refundLatestCharge } from "@/lib/rate-limit";
import { getBrandProfile, getProject, setProjectStatus } from "@/lib/db/repo";
import { log } from "@/lib/log";

/**
 * Background job: crawl → persist pages/assets → brand intelligence → persist
 * profile. Always leaves the project in a terminal status with a clear message.
 */
export async function analyzeProject(db: SupabaseClient, userId: string, projectId: string, crawlOptions?: CrawlOptions): Promise<void> {
  const started = Date.now();
  const project = await getProject(db, userId, projectId);
  if (!project?.website_url) {
    await setProjectStatus(db, userId, projectId, "analysis_failed", "This project has no link. Add one or enter your product details manually.");
    await refundLatestCharge(db, userId, projectId, "analysis failed");
    return;
  }

  let site: SiteAnalysis;
  try {
    await setProjectStatus(db, userId, projectId, "analyzing", "Reading your product pages…");
    site = await crawlSite(project.website_url, crawlOptions);
  } catch (e) {
    const userMessage = e instanceof CrawlError ? e.userMessage : "Something went wrong while reading the page.";
    log.warn("crawl failed", { projectId, error: (e as Error).message });
    await setProjectStatus(db, userId, projectId, "analysis_failed", `${userMessage} You can try again or fill in your brand details manually.`);
    await refundLatestCharge(db, userId, projectId, "analysis failed");
    return;
  }

  try {
    await persistSite(db, userId, projectId, site);
    await setProjectStatus(db, userId, projectId, "analyzing", "Understanding your brand and product…");

    const warnings = [...site.warnings];
    let profile: BrandProfile;
    if (isLLMConfigured()) {
      try {
        profile = await buildBrandProfile(site, getLLM("analysis", dbMeter({ db, userId, projectId, step: "analysis" })));
      } catch (e) {
        log.error("brand intelligence failed", { projectId, error: (e as Error).message });
        profile = extractionOnlyProfile(site);
        warnings.push(`The AI brand analysis failed (${describeLLMError(e)}), so only content found directly on the site was filled in.`);
      }
    } else {
      profile = extractionOnlyProfile(site);
      warnings.push("AI is not configured on this server, so only content found directly on the site was filled in.");
    }

    // Re-analysis keeps the user's edits.
    if (project.brand_profile_id) {
      const existing = await getBrandProfile(db, userId, project.brand_profile_id).catch(() => null);
      if (existing) profile = mergeReanalysis(existing.profile, profile);
    } else {
      // A goal picked up front (e.g. "More free-trial sign-ups") wins over the AI's guess.
      const chosen = CampaignObjective.safeParse((project.creative_preferences as { objective?: unknown } | null)?.objective);
      if (chosen.success) profile.campaign.objective = chosen.data;
    }
    profile = BrandProfileSchema.parse(profile);

    const name = profile.product.name.value || site.siteName || new URL(site.rootUrl).hostname;
    let brandId = project.brand_profile_id;
    if (brandId) {
      const { error } = await db.from("brand_profiles").update({ profile, name, source_url: site.rootUrl }).eq("id", brandId).eq("user_id", userId);
      if (error) throw error;
    } else {
      const { data, error } = await db
        .from("brand_profiles")
        .insert({ user_id: userId, name, source_url: site.rootUrl, profile, schema_version: profile.schemaVersion })
        .select("id")
        .single();
      if (error) throw error;
      brandId = data.id;
    }

    await setProjectStatus(db, userId, projectId, "analyzed", null, {
      brand_profile_id: brandId,
      analyzed_at: new Date().toISOString(),
      analysis_warnings: warnings,
    });
    log.info("analysis complete", { projectId, pages: site.pages.length, ms: Date.now() - started });
  } catch (e) {
    log.error("analysis failed", { projectId, error: (e as Error).message });
    await setProjectStatus(db, userId, projectId, "analysis_failed", "We couldn't finish the analysis. Please try again, or fill in your brand details manually.");
    await refundLatestCharge(db, userId, projectId, "analysis failed");
  }
}

async function persistSite(db: SupabaseClient, userId: string, projectId: string, site: SiteAnalysis) {
  await db.from("analyzed_pages").delete().eq("project_id", projectId).eq("user_id", userId);
  await db.from("assets").delete().eq("project_id", projectId).eq("user_id", userId).neq("kind", "uploaded_logo");

  const pages = site.pages.map((p) => ({
    project_id: projectId,
    user_id: userId,
    url: p.url,
    page_type: p.pageType,
    title: p.title,
    description: p.description,
    headings: p.headings.slice(0, 30),
    text_excerpt: p.text.slice(0, 4000),
    ctas: p.ctas,
    og: p.og,
    fetched_via: p.fetchedVia,
    http_status: p.status,
  }));
  const { error: pErr } = await db.from("analyzed_pages").insert(pages);
  if (pErr) throw pErr;

  const assets: Array<Record<string, unknown>> = [];
  if (site.logo) assets.push({ kind: "logo", url: site.logo.url, alt: site.logo.alt, source_page_url: site.logo.source });
  if (site.favicon) assets.push({ kind: "favicon", url: site.favicon, source_page_url: site.rootUrl });
  const seen = new Set(assets.map((a) => a.url));
  for (const p of site.pages) {
    const og = p.og["og:image"];
    if (og) {
      try {
        const u = new URL(og, p.url).toString();
        if (!seen.has(u)) {
          seen.add(u);
          assets.push({ kind: "og_image", url: u, alt: "Open Graph image", source_page_url: p.url });
        }
      } catch {
        /* ignore malformed */
      }
    }
    for (const img of p.images.slice(0, 6)) {
      if (seen.has(img.url) || assets.length >= 24) continue;
      seen.add(img.url);
      assets.push({ kind: "image", url: img.url, alt: img.alt, source_page_url: p.url });
    }
  }
  if (assets.length) {
    const { error } = await db.from("assets").insert(assets.map((a) => ({ ...a, project_id: projectId, user_id: userId })));
    if (error) throw error;
  }
}
