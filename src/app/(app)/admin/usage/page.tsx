import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionCard } from "@/components/ui/card";
import { isAdminEmail } from "@/lib/admin";
import { analysisModel, creativeModel } from "@/lib/ai/llm";
import { PLANS, isPlanId } from "@/lib/plans";
import { createServiceClient, requireUser } from "@/lib/supabase/server";
import { buildUsageReport, type AIUsageRow, type RenderRow } from "@/lib/usage-report";
import { BillingConfigForm } from "@/components/app/billing-config-form";
import { getBillingConfig } from "@/lib/billing-config";
import { OP_LABEL, buildEconomics, type AICost, type LedgerTx, type OtherCost } from "@/lib/unit-economics";
import { cn } from "@/lib/cn";

export const metadata = { title: "Usage & cost" };

const usd = (n: number, digits = 2) => `$${n.toFixed(n !== 0 && Math.abs(n) < 0.01 ? 4 : digits)}`;
const pct = (n: number | null) => (n === null ? "–" : `${Math.round(n * 100)}%`);

function monthRange(param?: string) {
  const m = /^(\d{4})-(\d{2})$/.exec(param ?? "");
  const now = new Date();
  const y = m ? Number(m[1]) : now.getUTCFullYear();
  const mo = m ? Number(m[2]) - 1 : now.getUTCMonth();
  const start = new Date(Date.UTC(y, mo, 1));
  const end = new Date(Date.UTC(y, mo + 1, 1));
  const key = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  return { start, end, label: start.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }), prev: key(new Date(Date.UTC(y, mo - 1, 1))), next: key(end) };
}

export default async function UsagePage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { user } = await requireUser();
  if (!isAdminEmail(user.email)) notFound();
  const { month } = await searchParams;
  const range = monthRange(month);
  const admin = createServiceClient();

  const iso = { from: range.start.toISOString(), to: range.end.toISOString() };
  const cfg = await getBillingConfig(admin);
  const [ledgerRes, opCostRes, aiOpsRes, balancesRes] = await Promise.all([
    admin.from("credit_transactions").select("id, user_id, type, operation, amount, list_credits, reservation_id, reason, plan, created_at").gte("created_at", iso.from).lt("created_at", iso.to).limit(100_000),
    admin.from("cost_events").select("operation_id, operation, category, cost_usd").gte("created_at", iso.from).lt("created_at", iso.to).limit(100_000),
    admin.from("ai_usage").select("operation_id, cost_usd, ok").gte("created_at", iso.from).lt("created_at", iso.to).limit(100_000),
    admin.from("credit_transactions").select("user_id, amount").limit(200_000),
  ]);
  const ledgerError = ledgerRes.error?.message;

  const [aiRes, renderRes, planRes] = await Promise.all([
    admin.from("ai_usage").select("user_id, project_id, step, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost_usd, duration_ms, ok").gte("created_at", range.start.toISOString()).lt("created_at", range.end.toISOString()).limit(50_000),
    admin.from("renders").select("user_id, status, created_at, updated_at, duration_sec").gte("created_at", range.start.toISOString()).lt("created_at", range.end.toISOString()).limit(50_000),
    admin.from("user_plans").select("user_id, plan"),
  ]);
  const setupError = aiRes.error?.message;
  const report = buildUsageReport((aiRes.data ?? []) as AIUsageRow[], (renderRes.data ?? []) as RenderRow[]);
  const plans = new Map((planRes.data ?? []).map((p) => [p.user_id as string, p.plan as string]));
  const top = report.byUser.slice(0, 50);
  const emails = new Map<string, string>();
  await Promise.all(
    top.map(async (s) => {
      const { data } = await admin.auth.admin.getUserById(s.userId);
      if (data.user?.email) emails.set(s.userId, data.user.email);
    }),
  );

  const econ = buildEconomics({
    ledger: (ledgerRes.data ?? []) as LedgerTx[],
    ai: (aiOpsRes.data ?? []) as AICost[],
    other: (opCostRes.data ?? []) as OtherCost[],
    doneRenders: ((renderRes.data ?? []) as RenderRow[]).filter((r) => r.status === "done").length,
    cfg,
  });
  const balances = new Map<string, number>();
  for (const r of (balancesRes.data ?? []) as { user_id: string; amount: number }[]) balances.set(r.user_id, (balances.get(r.user_id) ?? 0) + Number(r.amount));
  const negative = [...balances.values()].filter((b) => b < 0).length;
  const staleCutoff = Date.now() - 20 * 60_000;
  const stale = econ.ops.filter((o) => o.status === "open" && new Date(o.createdAt).getTime() < staleCutoff).length;
  const { targetMargin, minMargin } = cfg.targets;
  const marginTone = (m: number | null) => (m === null ? "" : m >= targetMargin ? "text-lime-deep" : m >= minMargin ? "text-yellow-deep" : "text-coral-deep font-semibold");
  const inTarget = (c: number | null) => (c === null ? "" : c <= 0.3 ? "text-lime-deep" : "text-coral-deep");

  const tiles: [string, string, string, string?][] = [
    ["Cost per finished video", econ.costPerFinishedVideo === null ? "–" : usd(econ.costPerFinishedVideo), `All spend ÷ ${econ.finishedVideos} exported videos · target $0.15–0.30`, inTarget(econ.costPerFinishedVideo)],
    ["First video from a link", econ.firstVideoCost === null ? "–" : usd(econ.firstVideoCost), "Avg new project + one export", inTarget(econ.firstVideoCost)],
    ["Cost per credit charged", econ.costPerCredit === null ? "–" : usd(econ.costPerCredit, 4), econ.costPerCreditIsEstimate ? "No charges yet" : "Includes failures and retries"],
    ["Credit utilization", pct(econ.credits.utilization), `${econ.credits.consumed.toLocaleString()} of ${econ.credits.allocated.toLocaleString()} allocated · ${econ.credits.held} on hold`],
    ["Failed operations", pct(econ.failureRate), `${usd(econ.totals.wastedOnFailures)} spent on failures (not charged)`],
    ["Total spend", usd(econ.totals.all), `AI ${usd(econ.totals.ai)} · photos ${usd(econ.totals.image)} · render ${usd(econ.totals.render)} · other ${usd(econ.totals.compute + econ.totals.storage + econ.totals.delivery + econ.totals.other)}`],
  ];

  return (
    <div className="max-w-5xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-heading text-2xl">Usage, cost & margins</h1>
          <p className="text-sm text-slate">Measured from every AI call and render. Models: analysis {analysisModel()}, concepts {creativeModel()}.</p>
        </div>
        <nav className="flex items-center gap-2 text-sm font-semibold">
          <Link href={`/admin/usage?month=${range.prev}`} className="rounded-lg border border-line px-3 py-1.5 hover:border-ink">←</Link>
          <span className="px-2">{range.label}</span>
          <Link href={`/admin/usage?month=${range.next}`} className="rounded-lg border border-line px-3 py-1.5 hover:border-ink">→</Link>
        </nav>
      </div>

      {ledgerError && (
        <p className="rounded-xl border border-coral bg-peach p-4 text-sm">Couldn&apos;t read the credit ledger ({ledgerError}). Run the migration <code className="font-mono">20261105000000_credit_ledger.sql</code> in Supabase.</p>
      )}
      {setupError && (
        <p className="rounded-xl border border-coral bg-peach p-4 text-sm">Couldn&apos;t read usage ({setupError}). Run the migration <code className="font-mono">20261103000000_usage_and_plans.sql</code> in Supabase.</p>
      )}

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map(([k, v, hint, tone]) => (
          <li key={k} className="rounded-2xl border border-line bg-white p-5">
            <p className="text-sm text-slate">{k}</p>
            <p className={cn("text-heading mt-1 text-3xl", tone)}>{v}</p>
            <p className="mt-1 text-xs text-slate">{hint}</p>
          </li>
        ))}
      </ul>

      <SectionCard accent="coral" eyebrow="Actual cost vs credits charged" title="By operation">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-slate">
              <tr><th className="py-2 font-medium">Operation</th><th className="font-medium">Runs</th><th className="font-medium">Failed</th><th className="font-medium">Avg cost</th><th className="font-medium">Ceiling</th><th className="font-medium">Avg credits</th><th className="font-medium">Cost / credit</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {econ.byOperation.map((o) => (
                <tr key={o.operation}>
                  <td className="py-2 font-semibold">{OP_LABEL[o.operation]}<span className="block text-xs font-normal text-slate">{cfg.creditCosts[o.operation === "analyze_only" ? "analyze" : o.operation] !== undefined ? `${o.operation === "analyze_only" ? Math.max(1, cfg.creditCosts.analyze - cfg.creditCosts.generate) : cfg.creditCosts[o.operation]} credits list` : ""}</span></td>
                  <td>{o.count}{o.open ? <span className="text-slate"> ({o.open} running)</span> : null}</td>
                  <td className={o.failed ? "text-coral-deep" : ""}>{o.failed ? `${o.failed} · ${pct(o.failureRate)}` : "0"}</td>
                  <td className={o.avgCost > o.ceiling ? "font-semibold text-coral-deep" : ""}>{o.completed ? usd(o.avgCost, 4) : "–"}</td>
                  <td className="text-slate">{usd(o.ceiling, 3)}{o.overCeiling ? <span className="block text-xs text-coral-deep">{o.overCeiling} over</span> : null}</td>
                  <td>{o.completed ? o.avgCredits.toFixed(1) : "–"}</td>
                  <td className="font-mono text-xs">{o.costPerCredit === null ? "–" : usd(o.costPerCredit, 4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate">Cost includes AI calls, server time, rendering, storage and delivery linked to each operation. {usd(econ.totals.unattributed)} of spend this month isn&apos;t linked to an operation (calls made before the ledger existed, or without credits).</p>
      </SectionCard>

      <SectionCard accent="violet" eyebrow={`Target ${Math.round(targetMargin * 100)}% · minimum ${Math.round(minMargin * 100)}%`} title="Plan margins at full use">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-slate">
              <tr><th className="py-2 font-medium">Plan</th><th className="font-medium">Credits</th><th className="font-medium">Monthly: net / credit</th><th className="font-medium">Margin</th><th className="font-medium">Yearly: net / credit</th><th className="font-medium">Margin</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {econ.tiers.map((t) => (
                <tr key={t.plan}>
                  <td className="py-2 font-semibold">{PLANS[t.plan].label}<span className="block text-xs font-normal text-slate">${t.monthly.price} / ${t.yearly.price} per month</span></td>
                  <td>{t.credits.toLocaleString()}</td>
                  <td className="font-mono text-xs">{usd(t.monthly.revenuePerCredit, 4)}</td>
                  <td className={marginTone(t.monthly.margin)}>{pct(t.monthly.margin)}</td>
                  <td className="font-mono text-xs">{usd(t.yearly.revenuePerCredit, 4)}</td>
                  <td className={marginTone(t.yearly.margin)}>{pct(t.yearly.margin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate">
          Revenue after payment fees ({cfg.prices.stripePercent}% + ${cfg.prices.stripeFixed.toFixed(2)}) per credit, against {econ.costPerCreditIsEstimate ? "an estimated $0.016 (list prices, no measured data yet)" : `the measured ${usd(econ.costPerCredit ?? 0, 4)}`} cost per credit, if a subscriber used every credit. Unused credits only raise the margin.
        </p>
      </SectionCard>

      <SectionCard accent="lime" eyebrow="Server-side enforcement" title="Credit ledger audit">
        <ul className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Negative balances", String(negative), negative ? "text-coral-deep font-semibold" : "text-lime-deep"],
            ["Holds running now", String(econ.ops.filter((o) => o.status === "open").length), ""],
            ["Stuck holds (>20 min)", String(stale), stale ? "text-yellow-deep" : "text-lime-deep"],
            ["Partial deliveries", String(econ.ops.filter((o) => o.status === "partial").length), ""],
          ].map(([k, v, tone]) => (
            <li key={k} className="rounded-xl border border-line p-3">
              <p className="text-slate">{k}</p>
              <p className={cn("text-heading text-2xl", tone)}>{v}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate">Every change is an append-only row in credit_transactions. Holds are settled when work finishes; stuck holds settle automatically from what was delivered on the user&apos;s next action.</p>
        {econ.highUsage.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 text-sm font-semibold">Unusually high usage this month</h3>
            <ul className="divide-y divide-line rounded-xl border border-line text-sm">
              {econ.highUsage.map((u) => (
                <li key={u.userId} className="flex justify-between px-3 py-2"><span className="font-mono text-xs">{u.userId.slice(0, 8)}</span><span>{u.credits} credits · {usd(u.cost)}</span></li>
              ))}
            </ul>
          </div>
        )}
      </SectionCard>

      <SectionCard accent="cyan" eyebrow="Where time and money go" title="By step">
        {report.steps.length === 0 ? (
          <p className="text-sm text-slate">No AI calls yet this month.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-slate"><tr><th className="py-2 font-medium">Step</th><th className="font-medium">Calls</th><th className="font-medium">Avg tokens in / out</th><th className="font-medium">Avg time</th><th className="font-medium">Avg cost</th><th className="font-medium">Models</th></tr></thead>
              <tbody className="divide-y divide-line">
                {report.steps.map((s) => (
                  <tr key={s.step}>
                    <td className="py-2 font-semibold">{s.step}</td>
                    <td>{s.calls}{s.failed ? <span className="text-coral-deep"> ({s.failed} invalid)</span> : null}</td>
                    <td className="font-mono text-xs">{Math.round(s.avgInput).toLocaleString()} / {Math.round(s.avgOutput).toLocaleString()}</td>
                    <td>{s.avgSeconds.toFixed(1)}s</td>
                    <td>{usd(s.avgCost, 4)}</td>
                    <td className="font-mono text-xs text-slate">{s.models.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard accent="violet" eyebrow="Top 50 by cost" title="By user">
        {top.length === 0 ? (
          <p className="text-sm text-slate">No usage yet this month.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-slate"><tr><th className="py-2 font-medium">User</th><th className="font-medium">Plan</th><th className="font-medium">Projects</th><th className="font-medium">AI calls</th><th className="font-medium">AI</th><th className="font-medium">Exports</th><th className="font-medium">Rendering</th><th className="font-medium">Total</th></tr></thead>
              <tbody className="divide-y divide-line">
                {top.map((s) => {
                  const plan = plans.get(s.userId);
                  return (
                    <tr key={s.userId}>
                      <td className="py-2">{emails.get(s.userId) ?? <span className="font-mono text-xs">{s.userId.slice(0, 8)}</span>}</td>
                      <td>{isPlanId(plan) ? PLANS[plan].label : "Free"}</td>
                      <td>{s.projects}</td>
                      <td>{s.aiCalls}</td>
                      <td>{usd(s.aiCost)}</td>
                      <td>{s.renders}</td>
                      <td>{usd(s.renderCost)}</td>
                      <td className="font-semibold">{usd(s.total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
      <SectionCard accent="none" eyebrow="Changes apply without a deploy" title="Billing settings">
        <BillingConfigForm config={cfg} />
      </SectionCard>

      <p className="text-xs text-slate">AI cost uses list prices per model (see src/lib/ai/usage.ts). Render cost assumes the deployed job size (4 vCPU, 8 GiB) and doesn&apos;t subtract Google&apos;s monthly free tier.</p>
    </div>
  );
}
