import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FakeDB } from "./fake-supabase";
import { aiBrandFixture, aiConceptFixture, FakeLLM, fixtureFetcher } from "./helpers";
import { setLLMForTesting } from "@/lib/ai/llm";
import { Brief, briefToPreferences, preferencesFromInstruction } from "@/lib/brief";
import { getBrandProfile, getProject, listConcepts } from "@/lib/db/repo";
import { runAutopilot } from "@/lib/jobs/autopilot";
import { regenerateConcept } from "@/lib/jobs/concepts";

const USER = "u1";
let fake: FakeDB;
let db: SupabaseClient;
const crawl = { fetcher: fixtureFetcher(), render: null };

beforeEach(() => {
  fake = new FakeDB();
  db = fake as unknown as SupabaseClient;
});
afterEach(() => setLLMForTesting(null));

describe("brief from the landing page", () => {
  it("turns starter ideas + notes into preferences", () => {
    const prefs = briefToPreferences(Brief.parse({ url: "https://x.example/", notes: "Spring sale, 20% off", ideas: ["vertical", "trials"] }));
    expect(prefs).toMatchObject({ aspectRatio: "9:16", targetDurationSec: 15, objective: "free_trial" });
    expect(prefs.notes).toContain("Spring sale, 20% off");
    expect(prefs.notes).toContain("Drive free-trial sign-ups.");
  });

  it("reads format and length hints from plain-language requests", () => {
    expect(preferencesFromInstruction("Make it a 15 second vertical for Reels")).toEqual({ aspectRatio: "9:16", targetDurationSec: 15 });
    expect(preferencesFromInstruction("square please, 30s")).toEqual({ aspectRatio: "1:1", targetDurationSec: 30 });
    expect(preferencesFromInstruction("make it punchier")).toEqual({});
    expect(preferencesFromInstruction("200 seconds")).toEqual({});
  });
});

describe("autopilot: website → brand → concepts with no review step", () => {
  it("runs everything and applies the brief", async () => {
    setLLMForTesting(new FakeLLM({ save_brand_profile: () => aiBrandFixture(), save_ad_concept: (_r, n) => aiConceptFixture(`C${n}`) }));
    fake.table("projects").push({
      id: "p1", user_id: USER, name: "tidyflow.example", website_url: "https://tidyflow.example/", status: "analyzing", brand_profile_id: null,
      creative_preferences: briefToPreferences(Brief.parse({ url: "https://tidyflow.example/", ideas: ["vertical", "retarget"] })),
    });
    await runAutopilot(db, USER, "p1", crawl);
    const p = await getProject(db, USER, "p1");
    expect(p?.status).toBe("concepts_ready");
    const brand = await getBrandProfile(db, USER, p!.brand_profile_id!);
    expect(brand?.profile.campaign.objective).toBe("retargeting"); // user's goal beats the AI's guess
    const concepts = await listConcepts(db, USER, "p1");
    expect(concepts).toHaveLength(3);
    expect(concepts.every((c) => c.scenePlan?.aspectRatio === "9:16")).toBe(true);
  });

  it("stops after the brand profile when AI isn't configured", async () => {
    const prev = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    fake.table("projects").push({ id: "p1", user_id: USER, name: "t", website_url: "https://tidyflow.example/", status: "analyzing", brand_profile_id: null, creative_preferences: {} });
    await runAutopilot(db, USER, "p1", crawl);
    process.env.ANTHROPIC_API_KEY = prev;
    expect((await getProject(db, USER, "p1"))?.status).toBe("analyzed");
    expect(fake.table("creative_concepts")).toHaveLength(0);
  });
});

describe("ask for changes", () => {
  it("applies a plain-language request, including format hints, and records a new version", async () => {
    const llm = new FakeLLM({
      save_brand_profile: () => aiBrandFixture(),
      save_ad_concept: (req) => (req.prompt.includes("THE USER ASKED FOR THESE CHANGES") ? { ...aiConceptFixture("Punchier"), headline: "Zero. Daily." } : aiConceptFixture("Original")),
    });
    setLLMForTesting(llm);
    fake.table("projects").push({ id: "p1", user_id: USER, name: "t", website_url: "https://tidyflow.example/", status: "analyzing", brand_profile_id: null, creative_preferences: {} });
    await runAutopilot(db, USER, "p1", crawl);
    const [a] = await listConcepts(db, USER, "p1");
    // the user had edited the headline; an explicit request may still change it
    fake.table("creative_concepts").find((r) => r.id === a.id)!.edited_fields = ["headline"];

    await regenerateConcept(db, USER, a.id, { instruction: "Make it punchier and a 15 second vertical" });
    const [after] = await listConcepts(db, USER, "p1");
    expect(after.content.headline).toBe("Zero. Daily.");
    expect(after.content.title).toBe("Punchier");
    expect(after.edited_fields).toEqual([]);
    expect(after.scenePlan?.aspectRatio).toBe("9:16");
    expect(after.preferences).toMatchObject({ aspectRatio: "9:16", targetDurationSec: 15 });
    expect(after.current_version).toBe(2);
    expect(llm.calls.at(-1)?.prompt).toContain("Make it punchier and a 15 second vertical");
  });
});
