import { describe, expect, it } from "vitest";
import { crawlSite } from "@/lib/analyzer/crawl";
import { assembleProfile, buildBrandProfile, extractionOnlyProfile, AIBrandAnalysis } from "@/lib/brand/intelligence";
import { BrandProfileSchema } from "@/lib/brand/schema";
import { generateConcept, brandBrief } from "@/lib/creative/director";
import { AIConcept, CONCEPT_KINDS, CreativePreferences, mergeConcept } from "@/lib/creative/concept";
import { ScenePlan, requiredAssets } from "@/lib/creative/scene-plan";
import { aiBrandFixture, aiConceptFixture, FakeLLM, fixtureFetcher } from "./helpers";

const prefs = CreativePreferences.parse({ aspectRatio: "9:16", targetDurationSec: 20 });

async function site() {
  return crawlSite("https://tidyflow.example", { fetcher: fixtureFetcher(), render: null, maxPages: 4 });
}

describe("brand intelligence", () => {
  it("verifies evidence and drops invented features and CTAs", async () => {
    const s = await site();
    const profile = assembleProfile(s, AIBrandAnalysis.parse(aiBrandFixture()));
    const features = profile.product.features.map((f) => f.value);
    expect(features).toEqual(["Automatic routing by topic and urgency", "AI-drafted replies"]);
    expect(features).not.toContain("Voice call transcription");
    expect(features).not.toContain("Slack integration");
    expect(profile.marketing.ctas.map((c) => c.value)).toEqual(["Start free trial"]);
    expect(profile.missing.join(" ")).toMatch(/2 suggested feature\(s\) were left out/);
    // Evidence found on the features page is attributed correctly.
    expect(profile.product.features[0].evidence[0].url).toBe("https://tidyflow.example/features");
  });

  it("labels verified facts vs AI interpretation", async () => {
    const profile = assembleProfile(await site(), AIBrandAnalysis.parse(aiBrandFixture()));
    expect(profile.product.valueProposition.provenance).toBe("extracted");
    expect(profile.product.targetAudience.provenance).toBe("inferred");
    expect(profile.marketing.adAngles[0].provenance).toBe("inferred");
    expect(profile.identity.primaryColor).toBe("#14B88A");
    expect(profile.identity.colorProvenance).toBe("extracted");
    expect(profile.identity.typography.heading).toBe("Sora");
    expect(profile.product.features.filter((f) => f.emphasized)).toHaveLength(2);
  });

  it("calls the LLM with a site digest and validates the result", async () => {
    const llm = new FakeLLM({ save_brand_profile: () => aiBrandFixture() });
    const profile = await buildBrandProfile(await site(), llm);
    expect(BrandProfileSchema.safeParse(profile).success).toBe(true);
    expect(llm.calls[0].prompt).toContain("=== PAGE https://tidyflow.example/features");
  });

  it("produces an honest extraction-only profile when AI is unavailable", async () => {
    const profile = extractionOnlyProfile(await site());
    expect(profile.product.name.value).toBe("Tidyflow");
    expect(profile.product.valueProposition.value).toBe("Inbox zero for support teams");
    expect(profile.product.targetAudience.value).toBe("");
    expect(profile.missing[0]).toMatch(/AI interpretation was unavailable/);
    expect(profile.product.features.every((f) => f.provenance === "extracted")).toBe(true);
  });
});

describe("creative director", () => {
  it("generates three distinct, validated concepts with renderer-ready scene plans", async () => {
    const brand = assembleProfile(await site(), AIBrandAnalysis.parse(aiBrandFixture()));
    const llm = new FakeLLM({ save_ad_concept: (_r, n) => aiConceptFixture(`Concept ${n}`) });
    const concepts = await Promise.all(CONCEPT_KINDS.map((kind) => generateConcept(llm, { kind, brand, preferences: prefs })));

    expect(concepts).toHaveLength(3);
    for (const c of concepts) {
      expect(AIConcept.safeParse(c).success).toBe(true);
      const plan = ScenePlan.parse(c.scenePlan);
      // brand-controlled values are set deterministically
      expect(plan.palette.primary).toBe("#14B88A");
      expect(plan.fonts.heading).toBe("Sora");
      expect(plan.aspectRatio).toBe("9:16");
      // duration normalized to frames and summed
      expect(plan.durationSec).toBeCloseTo(16, 1);
      expect(c.estimatedDurationSec).toBe(plan.durationSec);
      // unique scene ids
      expect(new Set(plan.scenes.map((s) => s.id)).size).toBe(plan.scenes.length);
      expect(plan.scenes.at(-1)?.cta?.text).toBe("Start free trial");
      expect(requiredAssets(plan)).toContain("logo");
    }
    const prompts = llm.calls.map((c) => c.prompt);
    expect(prompts[0]).toContain("Problem → Solution");
    expect(prompts[1]).toContain("Product in Motion");
    expect(prompts[2]).toContain("Brand Manifesto");
    expect(prompts[0]).toContain("Automatic routing by topic and urgency (EMPHASIZE)");
    expect(prompts[0]).toContain("[AI interpretation]");
  });

  it("rejects scene plans that use vocabulary outside the controlled set", () => {
    const bad = aiConceptFixture();
    (bad.scenePlan.scenes[0].visualElements[0] as { type: string }).type = "<script>alert(1)</script>";
    expect(AIConcept.safeParse(bad).success).toBe(false);
  });

  it("preserves user edits when regenerating, and only touches requested fields", () => {
    const base = AIConcept.parse(aiConceptFixture("Original"));
    const { scenePlan, ...content } = base;
    const existing = { content: { ...content, headline: "My own headline" }, scenePlan, editedFields: ["headline"] };
    const fresh = AIConcept.parse({ ...aiConceptFixture("Fresh title"), headline: "AI headline", cta: "Try it" });

    const full = mergeConcept(existing, fresh);
    expect(full.content.headline).toBe("My own headline");
    expect(full.content.title).toBe("Fresh title");
    expect(full.editedFields).toEqual(["headline"]);

    const partial = mergeConcept(existing, fresh, ["cta"]);
    expect(partial.content.cta).toBe("Try it");
    expect(partial.content.title).toBe("Original");
    expect(partial.content.headline).toBe("My own headline");
    expect(partial.scenePlan).toBe(scenePlan);
    expect(partial.changed).toEqual(["cta"]);

    const explicit = mergeConcept(existing, fresh, ["headline"]);
    expect(explicit.content.headline).toBe("AI headline");
    expect(explicit.editedFields).toEqual([]);
  });

  it("brand brief never presents inferred claims as facts", async () => {
    const brand = assembleProfile(await site(), AIBrandAnalysis.parse(aiBrandFixture()));
    expect(brandBrief(brand)).toMatch(/Target audience: Support teams at growing SaaS companies \[AI interpretation\]/);
    expect(brandBrief(brand)).not.toContain("Voice call transcription");
  });
});
