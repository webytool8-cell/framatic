import { afterEach, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FallbackLLM, LLMOutputError, shouldFallBack, type StructuredLLM } from "@/lib/ai/llm";
import { costForUsage, dbMeter, priceFor, renderCostUsd } from "@/lib/ai/usage";
import { PLANS, monthlyUsage, monthStart, nextMonthStart } from "@/lib/plans";
import { QuotaError, RateLimitError, checkMonthlyQuota } from "@/lib/rate-limit";
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

describe("monthly quotas", () => {
  const seed = (db: FakeDB, kind: string, n: number, at: string) => {
    for (let i = 0; i < n; i++) db.table("usage_events").push({ id: db.table("usage_events").length + 1, user_id: "u1", kind, created_at: at });
  };

  it("uses calendar months in UTC", () => {
    expect(monthStart(NOW).toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(nextMonthStart(NOW).toISOString()).toBe("2026-12-01T00:00:00.000Z");
  });

  it("blocks the free plan after 3 product links this month, ignoring last month", async () => {
    const db = new FakeDB();
    seed(db, "analyze", 5, "2026-10-20T00:00:00.000Z");
    seed(db, "analyze", 2, "2026-11-03T00:00:00.000Z");
    await expect(checkMonthlyQuota(asDb(db), "u1", "analyze", NOW)).resolves.toBeUndefined();
    seed(db, "analyze", 1, "2026-11-04T00:00:00.000Z");
    const err = await checkMonthlyQuota(asDb(db), "u1", "analyze", NOW).catch((e) => e);
    expect(err).toBeInstanceOf(QuotaError);
    expect(err).toBeInstanceOf(RateLimitError); // routes answer it with 429
    expect(err.message).toMatch(/all 3 product links on the Free plan.*December 1/);
  });

  it("counts regenerations and new concept sets together as AI edits", async () => {
    const db = new FakeDB();
    seed(db, "generate", 10, "2026-11-02T00:00:00.000Z");
    seed(db, "regenerate", PLANS.free.limits.edits - 10, "2026-11-02T00:00:00.000Z");
    await expect(checkMonthlyQuota(asDb(db), "u1", "regenerate", NOW)).rejects.toBeInstanceOf(QuotaError);
    await expect(checkMonthlyQuota(asDb(db), "u1", "render", NOW)).resolves.toBeUndefined();
  });

  it("respects paid plans, unlimited and the off switch", async () => {
    const db = new FakeDB();
    seed(db, "render", 10, "2026-11-02T00:00:00.000Z");
    await expect(checkMonthlyQuota(asDb(db), "u1", "render", NOW)).rejects.toBeInstanceOf(QuotaError);
    db.table("user_plans").push({ user_id: "u1", plan: "starter" });
    await expect(checkMonthlyQuota(asDb(db), "u1", "render", NOW)).resolves.toBeUndefined();
    db.table("user_plans")[0].plan = "unlimited";
    seed(db, "render", 500, "2026-11-02T00:00:00.000Z");
    await expect(checkMonthlyQuota(asDb(db), "u1", "render", NOW)).resolves.toBeUndefined();
    db.table("user_plans")[0].plan = "free";
    process.env.FRAMATIC_QUOTAS = "off";
    await expect(checkMonthlyQuota(asDb(db), "u1", "render", NOW)).resolves.toBeUndefined();
  });

  it("reports usage per meter for the Settings page", async () => {
    const db = new FakeDB();
    seed(db, "analyze", 2, "2026-11-02T00:00:00.000Z");
    seed(db, "regenerate", 4, "2026-11-02T00:00:00.000Z");
    const u = await monthlyUsage(asDb(db), "u1", NOW);
    expect(u.plan).toBe("free");
    expect(u.meters).toEqual([
      { meter: "projects", used: 2, limit: 3 },
      { meter: "edits", used: 4, limit: 30 },
      { meter: "exports", used: 0, limit: 3 },
    ]);
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
