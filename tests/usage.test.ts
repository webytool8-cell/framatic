import { afterEach, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FallbackLLM, LLMOutputError, shouldFallBack, type StructuredLLM } from "@/lib/ai/llm";
import { costForUsage, dbMeter, priceFor, renderCostUsd } from "@/lib/ai/usage";
import { CREDIT_COST, PLANS, creditBalance, creditPeriod, projectsPerMonth } from "@/lib/plans";
import { OutOfCreditsError, RateLimitError, chargeCredits, refundLatestCharge, setChargeRef } from "@/lib/rate-limit";
import { buildUsageReport } from "@/lib/usage-report";
import { FakeDB } from "./fake-supabase";

const asDb = (f: FakeDB) => f as unknown as SupabaseClient;
const NOW = new Date("2026-11-15T12:00:00Z");

afterEach(() => {
  delete process.env.FRAMATIC_QUOTAS;
  delete process.env.FRAMATIC_PRICE_CLAUDE_SONNET_5_5;
});

describe("AI cost", () => {
  it("prices Sonnet and Haiku calls from token usage", () => {
    expect(costForUsage("claude-sonnet-5-5", { input_tokens: 10_000, output_tokens: 2_000 })).toBeCloseTo(0.04, 6);
    expect(costForUsage("claude-haiku-5-5", { input_tokens: 10_000, output_tokens: 2_000 })).toBeCloseTo(0.002, 6);
  });
  it("bills cache writes at 1.25× and reads at 0.1× input", () => {
    expect(costForUsage("claude-sonnet-5-5", { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 1_000_000, cache_read_input_tokens: 1_000_000 })).toBeCloseTo(2.5 + 0.2, 6);
  });
  it("matches dated snapshots by prefix, returns null for unknown models, honours env overrides", () => {
    expect(priceFor("claude-sonnet-5-5-20260928")?.output).toBe(10);
    expect(priceFor("claude-sonnet-5-20260630")?.output).toBe(10);
    expect(costForUsage("mystery-model", { input_tokens: 1, output_tokens: 1 })).toBeNull();
    process.env.FRAMATIC_PRICE_CLAUDE_SONNET_5_5 = "3,15";
    expect(costForUsage("claude-sonnet-5-5", { input_tokens: 1_000_000, output_tokens: 0 })).toBeCloseTo(3, 6);
  });
  it("prices a render with Cloud Run's one-minute minimum", () => {
    expect(renderCostUsd(30)).toBeCloseTo(60 * (4 * 0.000018 + 8 * 0.000002), 8);
    expect(renderCostUsd(90)).toBeCloseTo(90 * (4 * 0.000018 + 8 * 0.000002), 8);
  });
  it("records each call in ai_usage", async () => {
    const db = new FakeDB();
    const meter = dbMeter({ db: asDb(db), userId: "u1", projectId: "p1", step: "analysis" });
    await meter({ model: "claude-haiku-5-5", tool: "t", attempt: 0, inputTokens: 9000, outputTokens: 1500, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0.00165, durationMs: 8000, ok: true });
    expect(db.table("ai_usage")).toMatchObject([{ user_id: "u1", project_id: "p1", step: "analysis", input_tokens: 9000, output_tokens: 1500, cost_usd: 0.00165 }]);
  });
});

describe("fast model with fallback", () => {
  const ok = (name: string): StructuredLLM => ({ name, generate: async <T,>() => name as unknown as T });
  const failing = (err: unknown): StructuredLLM => ({ name: "fast", generate: async () => { throw err; } });
  const req = { system: "", prompt: "", schema: {} as never, toolName: "x", toolDescription: "" };

  it("uses the fast model when it works", async () => {
    expect(await new FallbackLLM(ok("fast"), ok("main")).generate(req)).toBe("fast");
  });
  it("falls back on invalid output or an unavailable model", async () => {
    expect(await new FallbackLLM(failing(new LLMOutputError("bad")), ok("main")).generate(req)).toBe("main");
    expect(await new FallbackLLM(failing(Object.assign(new Error("not found"), { status: 404 })), ok("main")).generate(req)).toBe("main");
  });
  it("does not hide rate limits or billing problems", async () => {
    const e = Object.assign(new Error("rate limited"), { status: 429 });
    expect(shouldFallBack(e)).toBe(false);
    await expect(new FallbackLLM(failing(e), ok("main")).generate(req)).rejects.toThrow("rate limited");
  });
});

describe("credits", () => {
  const spend = (db: FakeDB, kind: string, credits: number, at = "2026-11-03T00:00:00.000Z", ref: string | null = null) =>
    db.table("usage_events").push({ id: db.table("usage_events").length + 1, user_id: "u1", kind, credits, ref, created_at: at });

  it("refills on the 1st (UTC), or on the billing date once Stripe sets one", () => {
    expect(creditPeriod(NOW)).toEqual({ start: new Date("2026-11-01T00:00:00Z"), end: new Date("2026-12-01T00:00:00Z") });
    const anchor = new Date("2026-08-20T00:00:00Z");
    expect(creditPeriod(NOW, anchor)).toEqual({ start: new Date("2026-10-20T00:00:00Z"), end: new Date("2026-11-20T00:00:00Z") });
    expect(creditPeriod(new Date("2026-11-25T00:00:00Z"), anchor).start).toEqual(new Date("2026-11-20T00:00:00Z"));
    // Billing on the 31st lands on the last day of shorter months.
    expect(creditPeriod(new Date("2026-03-01T00:00:00Z"), new Date("2026-01-31T00:00:00Z")).start).toEqual(new Date("2026-02-28T00:00:00Z"));
  });

  it("every paid plan keeps a healthy margin at ~3¢ of AI per credit", () => {
    for (const id of ["starter", "pro", "studio"] as const) {
      const p = PLANS[id];
      expect(p.credits * 0.03).toBeLessThan((p.priceYearlyPerMonth ?? 0) * 0.8);
    }
    expect(projectsPerMonth(PLANS.free.credits)).toBeGreaterThanOrEqual(1);
  });

  it("charges credits, counts only this period and blocks when they run out", async () => {
    const db = new FakeDB();
    spend(db, "analyze", 10, "2026-10-20T00:00:00.000Z"); // last month: ignored
    spend(db, "analyze", 10);
    spend(db, "regenerate", 2);
    let b = await creditBalance(asDb(db), "u1", NOW);
    expect(b).toMatchObject({ plan: "free", allowance: 30, used: 12, left: 18, unlimited: false });

    await chargeCredits(asDb(db), "u1", "analyze", "p2", NOW);
    expect(db.table("usage_events").at(-1)).toMatchObject({ kind: "analyze", credits: CREDIT_COST.analyze, ref: "p2" });
    b = await creditBalance(asDb(db), "u1", NOW);
    expect(b.left).toBe(8);

    const err = await chargeCredits(asDb(db), "u1", "analyze", "p3", NOW).catch((e: Error) => e);
    expect(err).toBeInstanceOf(OutOfCreditsError);
    expect(err).toBeInstanceOf(RateLimitError); // routes answer with 429
    expect((err as Error).message).toMatch(/uses 10 credits and you have 8 left on the Free plan.*December 1/);
    await expect(chargeCredits(asDb(db), "u1", "render", "c1", NOW)).resolves.toBeTypeOf("string");
  });

  it("refunds a failed job once, and the credits come back", async () => {
    const db = new FakeDB();
    spend(db, "analyze", 10, "2026-11-03T00:00:00.000Z", "p1");
    expect((await creditBalance(asDb(db), "u1", NOW)).left).toBe(20);
    expect(await refundLatestCharge(asDb(db), "u1", "p1", "test")).toBe(10);
    expect(await refundLatestCharge(asDb(db), "u1", "p1", "again")).toBe(0);
    expect((await creditBalance(asDb(db), "u1", NOW)).left).toBe(30);
    expect(db.table("usage_events").at(-1)).toMatchObject({ kind: "refund", credits: -10 });
    // A retry is a new charge and can be refunded on its own.
    spend(db, "analyze", 10, "2026-11-04T00:00:00.000Z", "p1");
    expect(await refundLatestCharge(asDb(db), "u1", "p1", "retry failed")).toBe(10);
  });

  it("tags a charge after the fact so exports can refund themselves", async () => {
    const db = new FakeDB();
    const id = await chargeCredits(asDb(db), "u1", "render", "c1", NOW);
    await setChargeRef(asDb(db), id as unknown as number, "render:r1");
    expect(await refundLatestCharge(asDb(db), "u1", "render:r1", "render failed")).toBe(1);
  });

  it("paid plans get their allowance; unlimited and the off switch charge nothing", async () => {
    const db = new FakeDB();
    spend(db, "analyze", 30);
    await expect(chargeCredits(asDb(db), "u1", "render", null, NOW)).rejects.toBeInstanceOf(OutOfCreditsError);
    db.table("user_plans").push({ user_id: "u1", plan: "pro" });
    expect((await creditBalance(asDb(db), "u1", NOW)).left).toBe(970);
    db.table("user_plans")[0].plan = "unlimited";
    await chargeCredits(asDb(db), "u1", "analyze", null, NOW);
    expect(db.table("usage_events").at(-1)).toMatchObject({ kind: "analyze", credits: 0 });
    const b = await creditBalance(asDb(db), "u1", NOW);
    expect(b.unlimited).toBe(true);
    expect(b.left).toBe(Infinity);
    db.table("user_plans")[0].plan = "free";
    process.env.FRAMATIC_QUOTAS = "off";
    await chargeCredits(asDb(db), "u1", "analyze", null, NOW);
    expect(db.table("usage_events").at(-1)).toMatchObject({ credits: 0 });
  });
});

describe("usage report", () => {
  it("works out cost per project, per render and per user", () => {
    const row = (user: string, project: string, step: string, model: string, cost: number) => ({
      user_id: user, project_id: project, step, model, input_tokens: 10_000, output_tokens: 2_000, cache_read_tokens: 0, cache_write_tokens: 0, cost_usd: String(cost), duration_ms: 10_000, ok: true,
    });
    const ai = [
      row("a", "p1", "analysis", "claude-haiku-5-5", 0.002),
      row("a", "p1", "concept:problem_solution", "claude-sonnet-5-5", 0.05),
      row("a", "p1", "concept:product_in_motion", "claude-sonnet-5-5", 0.05),
      row("a", "p1", "concept:brand_manifesto", "claude-sonnet-5-5", 0.05),
      row("a", "p1", "edit", "claude-sonnet-5-5", 0.048),
      row("b", "p2", "analysis", "claude-haiku-5-5", 0.002),
    ];
    const renders = [
      { user_id: "a", status: "done", created_at: "2026-11-02T00:00:00Z", updated_at: "2026-11-02T00:00:45Z", duration_sec: 12 },
      { user_id: "a", status: "rendering", created_at: "2026-11-02T00:00:00Z", updated_at: "2026-11-02T00:00:10Z", duration_sec: 12 },
    ];
    const r = buildUsageReport(ai, renders);
    expect(r.projects).toBe(2);
    expect(r.aiCost).toBeCloseTo(0.202, 6);
    expect(r.firstRunPerProject).toBeCloseTo(0.154 / 2, 6);
    expect(r.renders).toBe(1);
    expect(r.perRender).toBeCloseTo(renderCostUsd(45), 8);
    expect(r.byUser[0].userId).toBe("a");
    expect(r.steps.find((s) => s.step === "concept")).toMatchObject({ calls: 3, avgOutput: 2000, avgSeconds: 10 });
  });
});
