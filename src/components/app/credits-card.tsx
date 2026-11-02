import Link from "next/link";
import { KIND_LABEL, PLANS, formatResetDate, type CreditBalance } from "@/lib/plans";
import { cn } from "@/lib/cn";

export type CreditActivity = { id: number | string; kind: string; credits: number; created_at: string };

/** Credits left this period, with a bar and a short activity list. */
export function CreditsCard({ balance, activity }: { balance: CreditBalance; activity: CreditActivity[] }) {
  const { plan, allowance, used, left, unlimited, resetsAt } = balance;
  const pct = unlimited ? 100 : Math.max(0, Math.min(100, (left / Math.max(1, allowance)) * 100));
  const low = !unlimited && left < allowance * 0.15;
  return (
    <div className="grid gap-8 md:grid-cols-[1fr_1fr]">
      <div>
        <p className="text-sm text-slate">
          <span className="font-semibold text-ink">{PLANS[plan].label}</span> plan
          {unlimited ? " · admin access" : ` · ${allowance.toLocaleString()} credits a month`}
        </p>
        <p className="text-heading mt-2 text-5xl">
          {unlimited ? "∞" : left.toLocaleString()}
          <span className="ml-2 text-base font-medium text-slate">{unlimited ? "credits" : `of ${allowance.toLocaleString()} left`}</span>
        </p>
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-[#F2F2F6]" role="meter" aria-label="Credits left" aria-valuemin={0} aria-valuemax={unlimited ? undefined : allowance} aria-valuenow={unlimited ? undefined : left}>
          <div className={cn("h-full rounded-full", unlimited ? "bg-gradient-to-r from-violet via-cyan to-lime" : low ? "bg-coral" : "bg-violet")} style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-3 text-sm text-slate">
          {unlimited ? `${used.toLocaleString()} credits' worth used this month, not deducted.` : `${used.toLocaleString()} used. Refills to ${allowance.toLocaleString()} on ${formatResetDate(resetsAt)}.`}
        </p>
        {!unlimited && (
          <Link href="/pricing" className="mt-4 inline-flex rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-black">
            {plan === "free" ? "See plans" : "Change plan"}
          </Link>
        )}
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold">Recent activity</h3>
        {activity.length === 0 ? (
          <p className="text-sm text-slate">Nothing yet this month.</p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line text-sm">
            {activity.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span>
                  {KIND_LABEL[a.kind] ?? a.kind}
                  <span className="ml-2 text-xs text-slate">{new Date(a.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                </span>
                <span className={cn("font-mono text-xs font-semibold", a.credits < 0 ? "text-lime-deep" : "text-ink")}>
                  {a.credits < 0 ? `+${-a.credits}` : `−${a.credits}`}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-slate">If a generation or export fails, its credits come back automatically.</p>
      </div>
    </div>
  );
}

/** Compact balance for the sidebar. */
export function CreditPill({ left, allowance, unlimited }: { left: number; allowance: number; unlimited: boolean }) {
  const pct = unlimited ? 100 : Math.max(0, Math.min(100, (left / Math.max(1, allowance)) * 100));
  const low = !unlimited && left < allowance * 0.15;
  return (
    <Link href="/settings#credits" className="block rounded-xl border border-line bg-white px-3 py-2.5 transition-colors hover:border-line-strong">
      <span className="flex items-baseline justify-between text-xs">
        <span className="font-semibold text-ink">Credits</span>
        <span className={cn("font-mono", low ? "font-semibold text-coral-deep" : "text-slate")}>{unlimited ? "Unlimited" : `${left.toLocaleString()} / ${allowance.toLocaleString()}`}</span>
      </span>
      <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-[#F2F2F6]">
        <span className={cn("block h-full rounded-full", unlimited ? "bg-gradient-to-r from-violet via-cyan to-lime" : low ? "bg-coral" : "bg-violet")} style={{ width: `${pct}%` }} />
      </span>
      {low && <span className="mt-1.5 block text-[11px] font-medium text-coral-deep">Running low · see plans</span>}
    </Link>
  );
}
