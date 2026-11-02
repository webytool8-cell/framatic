import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionCard } from "@/components/ui/card";
import { isAdminEmail } from "@/lib/admin";
import { analysisModel, creativeModel } from "@/lib/ai/llm";
import { PLANS, isPlanId } from "@/lib/plans";
import { createServiceClient, requireUser } from "@/lib/supabase/server";
import { buildUsageReport, type AIUsageRow, type RenderRow } from "@/lib/usage-report";

export const metadata = { title: "Usage & cost" };

const usd = (n: number, digits = 2) => `$${n.toFixed(n !== 0 && Math.abs(n) < 0.01 ? 4 : digits)}`;

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

  const tiles: [string, string, string][] = [
    ["Cost per “make my ad”", usd(report.firstRunPerProject), "Analysis + 3 concepts, per project"],
    ["AI cost per project", usd(report.perProject), "Including later edits"],
    ["Cost per MP4 export", usd(report.perRender, 4), "Cloud Run, 60s minimum"],
    ["Cost per active user", usd(report.perUser), `${report.users} active this month`],
    ["Total AI", usd(report.aiCost), `${report.projects} projects`],
    ["Total rendering", usd(report.renderCost), `${report.renders} exports`],
  ];

  return (
    <div className="max-w-5xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-heading text-2xl">Usage & cost</h1>
          <p className="text-sm text-slate">Measured from every AI call and render. Models: analysis {analysisModel()}, concepts {creativeModel()}.</p>
        </div>
        <nav className="flex items-center gap-2 text-sm font-semibold">
          <Link href={`/admin/usage?month=${range.prev}`} className="rounded-lg border border-line px-3 py-1.5 hover:border-ink">←</Link>
          <span className="px-2">{range.label}</span>
          <Link href={`/admin/usage?month=${range.next}`} className="rounded-lg border border-line px-3 py-1.5 hover:border-ink">→</Link>
        </nav>
      </div>

      {setupError && (
        <p className="rounded-xl border border-coral bg-peach p-4 text-sm">Couldn&apos;t read usage ({setupError}). Run the migration <code className="font-mono">20261103000000_usage_and_plans.sql</code> in Supabase.</p>
      )}

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map(([k, v, hint]) => (
          <li key={k} className="rounded-2xl border border-line bg-white p-5">
            <p className="text-sm text-slate">{k}</p>
            <p className="text-heading mt-1 text-3xl">{v}</p>
            <p className="mt-1 text-xs text-slate">{hint}</p>
          </li>
        ))}
      </ul>

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
      <p className="text-xs text-slate">AI cost uses list prices per model (see src/lib/ai/usage.ts). Render cost assumes the deployed job size (4 vCPU, 8 GiB) and doesn&apos;t subtract Google&apos;s monthly free tier.</p>
    </div>
  );
}
