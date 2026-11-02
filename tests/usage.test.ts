import { afterEach, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FallbackLLM, LLMOutputError, shouldFallBack, type StructuredLLM } from "@/lib/ai/llm";
import { costForUsage, dbMeter, priceFor, renderCostUsd } from "@/lib/ai/usage";
import { CREDIT_COST, PLANS, creditPeriod, projectsPerMonth } from "@/lib/plans";
import { OperationInProgressError, OutOfCreditsError, RateLimitError } from "@/lib/rate-limit";
import { captureFor, getBalance, reserveCredits, settleCredits, settleOperation, sweepStaleReservations } from "@/lib/credits";
import { DEFAULT_BILLING, mergeBillingConfig } from "@/lib/billing-config";
import { buildEconomics, netOfFees, tierMargins } from "@/lib/unit-economics";
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
  it("refills on the 1st (UTC), or on the billing date once Stripe sets one", () => {
    expect(creditPeriod(NOW)).toEqual({ start: new Date("2026-11-01T00:00:00Z"), end: new Date("2026-12-01T00:00:00Z") });
    const anchor = new Date("2026-08-20T00:00:00Z");
    expect(creditPeriod(NOW, anchor)).toEqual({ start: new Date("2026-10-20T00:00:00Z"), end: new Date("2026-11-20T00:00:00Z") });
    expect(creditPeriod(new Date("2026-11-25T00:00:00Z"), anchor).start).toEqual(new Date("2026-11-20T00:00:00Z"));
    expect(creditPeriod(new Date("2026-03-01T00:00:00Z"), new Date("2026-01-31T00:00:00Z")).start).toEqual(new Date("2026-02-28T00:00:00Z"));
    expect(projectsPerMonth(PLANS.free.credits)).toBeGreaterThanOrEqual(1);
  });

  it("charges for what was delivered", () => {
    const c = CREDIT_COST; // analyze 10, generate 6, regenerate 2, render 1
    expect(captureFor(c, "analyze", { kind: "concepts", delivered: 3 })).toBe(10);
    expect(captureFor(c, "analyze", { kind: "concepts", delivered: 2 })).toBe(8);
    expect(captureFor(c, "analyze", { kind: "concepts", delivered: 0 })).toBe(0); // nothing usable: no charge
    expect(captureFor(c, "generate", { kind: "concepts", delivered: 1 })).toBe(2);
    expect(captureFor(c, "analyze_only", { kind: "done" })).toBe(4);
    expect(captureFor(c, "render", { kind: "failed" })).toBe(0);
    expect(captureFor(c, "regenerate", { kind: "done" })).toBe(2);
  });

  it("holds before work, settles after, and never overspends", async () => {
    const db = new FakeDB();
    let b = await getBalance(asDb(db), "u1", NOW);
    expect(b).toMatchObject({ plan: "free", allowance: 30, left: 30, used: 0, held: 0 });

    const h1 = await reserveCredits(asDb(db), "u1", "analyze", { ref: "p1", now: NOW });
    const h2 = await reserveCredits(asDb(db), "u1", "analyze", { ref: "p2", now: NOW });
    b = await getBalance(asDb(db), "u1", NOW);
    expect(b).toMatchObject({ left: 10, held: 20 });

    // A third fits exactly; a fourth doesn't while three are running.
    const h3 = await reserveCredits(asDb(db), "u1", "analyze", { ref: "p3", now: NOW });
    const err = await reserveCredits(asDb(db), "u1", "analyze", { ref: "p4", now: NOW }).catch((e: Error) => e);
    expect(err).toBeInstanceOf(OutOfCreditsError);
    expect(err).toBeInstanceOf(RateLimitError); // answered with 429
    expect((err as Error).message).toMatch(/uses 10 credits and you have 0 left on the Free plan.*December 1/);
    await settleOperation(asDb(db), h3.reservationId, "analyze", { kind: "failed" });

    // p1 delivered 2 of 3 concepts; p2 failed on our side.
    await settleOperation(asDb(db), h1.reservationId, "analyze", { kind: "concepts", delivered: 2 });
    await settleOperation(asDb(db), h2.reservationId, "analyze", { kind: "failed" });
    b = await getBalance(asDb(db), "u1", NOW);
    expect(b).toMatchObject({ left: 22, held: 0, used: 8 });

    // Settling twice is harmless.
    expect(await settleCredits(asDb(db), h1.reservationId, 10, "again")).toEqual({ captured: 0, alreadySettled: true });
    expect((await getBalance(asDb(db), "u1", NOW)).left).toBe(22);
  });

  it("dedupes repeated requests and refuses a second run of the same thing", async () => {
    const db = new FakeDB();
    const a = await reserveCredits(asDb(db), "u1", "render", { ref: "c1:v3", idempotencyKey: "click-1", now: NOW });
    const again = await reserveCredits(asDb(db), "u1", "render", { ref: "c1:v3", idempotencyKey: "click-1", now: NOW });
    expect(again).toMatchObject({ reservationId: a.reservationId, created: false });
    await expect(reserveCredits(asDb(db), "u1", "render", { ref: "c1:v3", idempotencyKey: "click-2", now: NOW })).rejects.toBeInstanceOf(OperationInProgressError);
    // Only one hold, one attempt counted towards the hourly limit.
    expect(db.table("credit_transactions").filter((t) => t.type === "reservation")).toHaveLength(1);
    expect(db.table("usage_events")).toHaveLength(1);
    // Once settled, the same version can be exported again.
    await settleOperation(asDb(db), a.reservationId, "render", { kind: "done" });
    await expect(reserveCredits(asDb(db), "u1", "render", { ref: "c1:v3", idempotencyKey: "click-3", now: NOW })).resolves.toMatchObject({ created: true });
  });

  it("settles holds whose job died, from what the database shows", async () => {
    const db = new FakeDB();
    const hold = await reserveCredits(asDb(db), "u1", "render", { ref: "c1:v1", now: NOW });
    db.table("renders").push({ id: "r1", user_id: "u1", operation_id: hold.reservationId, status: "done" });
    const t = db.table("credit_transactions").find((x) => x.id === hold.reservationId)!;
    t.created_at = new Date(Date.now() - 30 * 60_000).toISOString();
    expect(await sweepStaleReservations(asDb(db), "u1")).toBe(1);
    expect(db.table("credit_transactions").filter((x) => x.type === "capture")).toHaveLength(1);
    expect(await sweepStaleReservations(asDb(db), "u1")).toBe(0);
  });

  it("paid plans get their allowance; unlimited and the off switch deduct nothing", async () => {
    const db = new FakeDB();
    db.table("user_plans").push({ user_id: "u1", plan: "pro" });
    expect((await getBalance(asDb(db), "u1", NOW)).left).toBe(1000);
    db.table("user_plans")[0].plan = "unlimited";
    const h = await reserveCredits(asDb(db), "u1", "analyze", { ref: "p1", now: NOW });
    await settleOperation(asDb(db), h.reservationId, "analyze", { kind: "concepts", delivered: 3 });
    const b = await getBalance(asDb(db), "u1", NOW);
    expect(b).toMatchObject({ unlimited: true, used: 10 });
    expect(b.left).toBe(Infinity);
    expect(db.table("credit_transactions").filter((x) => x.type === "capture")[0]).toMatchObject({ amount: 0, list_credits: 10 });
    db.table("user_plans")[0].plan = "free";
    process.env.FRAMATIC_QUOTAS = "off";
    const h2 = await reserveCredits(asDb(db), "u1", "analyze", { ref: "p2", now: NOW });
    expect(db.table("credit_transactions").find((x) => x.id === h2.reservationId)).toMatchObject({ amount: 0 });
  });

  it("reads credit costs from billing config, falling back to defaults", () => {
    expect(mergeBillingConfig(null)).toEqual(DEFAULT_BILLING);
    expect(mergeBillingConfig({ creditCosts: { regenerate: 3 } }).creditCosts).toEqual({ ...CREDIT_COST, regenerate: 3 });
    expect(mergeBillingConfig({ creditCosts: { regenerate: -5 } })).toEqual(DEFAULT_BILLING); // invalid → defaults
  });
});

describe("unit economics", () => {
  it("nets out payment fees and works out margin per plan", () => {
    expect(netOfFees(19, DEFAULT_BILLING)).toBeCloseTo(19 - 0.551 - 0.3, 6);
    const [starter] = tierMargins(0.016, DEFAULT_BILLING);
    expect(starter.plan).toBe("starter");
    expect(starter.monthly.revenuePerCredit).toBeCloseTo((19 - 0.551 - 0.3) / 300, 6);
    expect(starter.monthly.margin).toBeCloseTo(1 - 0.016 / starter.monthly.revenuePerCredit, 6);
    expect(starter.yearly.revenuePerCredit).toBeLessThan(starter.monthly.revenuePerCredit);
  });

  it("attributes costs to operations and finds failures, cost per video and utilization", () => {
    const tx = (id: string, type: string, extra: Record<string, unknown> = {}) => ({ id, user_id: "u1", type, operation: null, amount: 0, list_credits: null, reservation_id: null, reason: null, plan: "free", created_at: "2026-11-03T00:00:00Z", ...extra });
    const ledger = [
      tx("a", "allocation", { amount: 30 }),
      tx("r1", "reservation", { operation: "analyze", amount: -10, list_credits: 10 }),
      tx("x1", "release", { operation: "analyze", reservation_id: "r1", amount: 10, reason: "completed" }),
      tx("c1", "capture", { operation: "analyze", reservation_id: "r1", amount: -10, list_credits: 10 }),
      tx("r2", "reservation", { operation: "analyze", amount: -10, list_credits: 10 }),
      tx("x2", "release", { operation: "analyze", reservation_id: "r2", amount: 10, reason: "system_failure" }),
      tx("r3", "reservation", { operation: "render", amount: -1, list_credits: 1 }),
      tx("x3", "release", { operation: "render", reservation_id: "r3", amount: 1, reason: "completed" }),
      tx("c3", "capture", { operation: "render", reservation_id: "r3", amount: -1, list_credits: 1 }),
      tx("r4", "reservation", { operation: "regenerate", amount: -2, list_credits: 2 }),
    ];
    const ai = [
      { operation_id: "r1", cost_usd: "0.14", ok: true },
      { operation_id: "r2", cost_usd: "0.05", ok: false },
      { operation_id: null, cost_usd: "0.01", ok: true },
    ];
    const other = [
      { operation_id: "r1", operation: "analyze", category: "compute", cost_usd: "0.01" },
      { operation_id: "r3", operation: "render", category: "render", cost_usd: "0.00528" },
      { operation_id: "r3", operation: "render", category: "delivery", cost_usd: "0.0002" },
    ];
    const e = buildEconomics({ ledger, ai, other, doneRenders: 1, cfg: DEFAULT_BILLING });
    const project = e.byOperation.find((o) => o.operation === "analyze")!;
    expect(project).toMatchObject({ count: 2, completed: 1, failed: 1, failureRate: 0.5 });
    expect(project.avgCost).toBeCloseTo(0.15, 6);
    expect(project.wasted).toBeCloseTo(0.05, 6);
    expect(e.firstVideoCost).toBeCloseTo(0.15 + 0.00548, 6);
    expect(e.totals.all).toBeCloseTo(0.14 + 0.05 + 0.01 + 0.01 + 0.00528 + 0.0002, 6);
    expect(e.totals.unattributed).toBeCloseTo(0.01, 6);
    expect(e.costPerFinishedVideo).toBeCloseTo(e.totals.all, 6);
    expect(e.credits).toEqual({ allocated: 30, consumed: 11, held: 2, utilization: 11 / 30 });
    expect(e.costPerCredit).toBeCloseTo(e.totals.all / 11, 6);
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
