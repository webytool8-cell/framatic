import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FakeDB } from "./fake-supabase";
import { aiBrandFixture, aiConceptFixture, FakeLLM, fixtureFetcher } from "./helpers";
import { setLLMForTesting } from "@/lib/ai/llm";
import { listConcepts, getBrandProfile, getProject } from "@/lib/db/repo";
import { consumeRateLimit, RateLimitError } from "@/lib/rate-limit";

import { analyzeProject as analyze } from "@/lib/jobs/analyze-project";
import { generateAllConcepts, regenerateConcept } from "@/lib/jobs/concepts";

const analyzeProject = (d: SupabaseClient, u: string, p: string) => analyze(d, u, p, { fetcher: fixtureFetcher(), render: null });

const USER = "user-a";
let fake: FakeDB;
let db: SupabaseClient;

beforeEach(() => {
  fake = new FakeDB();
  db = fake as unknown as SupabaseClient;
  fake.table("projects").push({ id: "p1", user_id: USER, name: "Tidyflow", website_url: "https://tidyflow.example/", status: "analyzing", brand_profile_id: null, creative_preferences: {} });
  fake.table("user_preferences").push({ user_id: USER, default_aspect_ratio: "1:1", default_duration_sec: 15, default_pacing: null, brand_voice_notes: "" });
});
afterEach(() => setLLMForTesting(null));

describe("end-to-end workflow (website → brand → concepts → refine)", () => {
  it("runs the full pipeline and persists everything", async () => {
    let regenTitle = 0;
    setLLMForTesting(
      new FakeLLM({
        save_brand_profile: () => aiBrandFixture(),
        save_ad_concept: (req) => {
          const c = aiConceptFixture(`Concept ${++regenTitle}`);
          return req.prompt.includes("Rewrite ONLY") ? { ...c, cta: "Try Tidyflow free" } : c;
        },
      }),
    );

    // 1. Analyze
    await analyzeProject(db, USER, "p1");
    const project = await getProject(db, USER, "p1");
    expect(project?.status).toBe("analyzed");
    expect(project?.brand_profile_id).toBeTruthy();
    expect(fake.table("analyzed_pages").length).toBeGreaterThanOrEqual(3);
    expect(fake.table("assets").some((a) => a.kind === "logo")).toBe(true);
    const brand = await getBrandProfile(db, USER, project!.brand_profile_id!);
    expect(brand?.profile.product.features.map((f) => f.value)).not.toContain("Voice call transcription");

    // 2. Generate three concepts
    await generateAllConcepts(db, USER, "p1");
    expect((await getProject(db, USER, "p1"))?.status).toBe("concepts_ready");
    let concepts = await listConcepts(db, USER, "p1");
    expect(concepts.map((c) => c.slot)).toEqual(["A", "B", "C"]);
    for (const c of concepts) {
      expect(c.scenePlan?.aspectRatio).toBe("1:1"); // user default preference applied
      expect(c.scenePlan?.palette.primary).toBe("#14B88A");
    }
    expect(fake.table("scene_plans")).toHaveLength(3);

    // 3. User edits the headline, then regenerates only the CTA
    const a = concepts[0];
    fake.table("creative_concepts").find((r) => r.id === a.id)!.content = { ...a.content, headline: "Mine" };
    fake.table("creative_concepts").find((r) => r.id === a.id)!.edited_fields = ["headline"];
    const changed = await regenerateConcept(db, USER, a.id, { only: ["cta"] });
    expect(changed).toEqual(["cta"]);
    concepts = await listConcepts(db, USER, "p1");
    expect(concepts[0].content.cta).toBe("Try Tidyflow free");
    expect(concepts[0].content.headline).toBe("Mine");
    expect(concepts[0].current_version).toBe(1); // scenes untouched → no new scene-plan version

    // 4. Regenerate whole concept: edits preserved, new scene-plan version saved
    await regenerateConcept(db, USER, a.id);
    concepts = await listConcepts(db, USER, "p1");
    expect(concepts[0].content.headline).toBe("Mine");
    expect(concepts[0].current_version).toBe(2);
    expect(fake.table("scene_plans").filter((s) => s.concept_id === a.id)).toHaveLength(2);

    // 5. Re-analysis keeps user edits in the brand profile
    const bp = fake.table("brand_profiles")[0] as { profile: { product: { targetAudience: unknown } } };
    bp.profile.product.targetAudience = { value: "Heads of support", provenance: "user", evidence: [] };
    await analyzeProject(db, USER, "p1");
    const after = await getBrandProfile(db, USER, project!.brand_profile_id!);
    expect(after?.profile.product.targetAudience.value).toBe("Heads of support");
    expect(fake.table("brand_profiles")).toHaveLength(1);
  });

  it("fails clearly (no mock substitution) when the site can't be analyzed", async () => {
    fake.table("projects")[0].website_url = "https://tidyflow.example/missing-page-404";
    // Homepage fetch of a 404 path → definitive failure
    const { crawlSite } = await import("@/lib/analyzer/crawl");
    await expect(crawlSite("https://tidyflow.example/missing-page-404", { fetcher: fixtureFetcher(), render: null })).rejects.toThrow();
    await analyzeProject(db, USER, "p1");
    const p = await getProject(db, USER, "p1");
    expect(p?.status).toBe("analysis_failed");
    expect(p?.status_message).toMatch(/HTTP 404.*manually/);
    expect(fake.table("brand_profiles")).toHaveLength(0);
  });

  it("falls back to extraction-only when AI is not configured, and says so", async () => {
    setLLMForTesting(null);
    const prev = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    await analyzeProject(db, USER, "p1");
    process.env.ANTHROPIC_API_KEY = prev;
    const p = await getProject(db, USER, "p1");
    expect(p?.status).toBe("analyzed");
    expect(JSON.stringify(p?.analysis_warnings)).toMatch(/AI is not configured/);
  });

  it("marks generation failed with a friendly message when the AI errors", async () => {
    setLLMForTesting(new FakeLLM({ save_brand_profile: () => aiBrandFixture(), save_ad_concept: () => { throw Object.assign(new Error("overloaded"), { status: 529 }); } }));
    await analyzeProject(db, USER, "p1");
    await generateAllConcepts(db, USER, "p1");
    const p = await getProject(db, USER, "p1");
    expect(p?.status).toBe("generation_failed");
    expect(p?.status_message).toMatch(/temporarily unavailable/);
    expect(fake.table("creative_concepts")).toHaveLength(0);
  });

  it("enforces per-user rate limits", async () => {
    for (let i = 0; i < 10; i++) await consumeRateLimit(db, USER, "analyze");
    await expect(consumeRateLimit(db, USER, "analyze")).rejects.toBeInstanceOf(RateLimitError);
    await expect(consumeRateLimit(db, "someone-else", "analyze")).resolves.toBeUndefined();
  });
});
