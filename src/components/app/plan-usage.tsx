import { METER_LABEL, PLANS, type MeterUsage, type PlanId } from "@/lib/plans";
import { cn } from "@/lib/cn";

const BAR: Record<MeterUsage["meter"], string> = { projects: "bg-violet", edits: "bg-cyan", exports: "bg-coral" };

/** This month's usage against the plan's allowance. */
export function PlanUsage({ plan, meters, resetsAt }: { plan: PlanId; meters: MeterUsage[]; resetsAt: Date }) {
  const resets = resetsAt.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
  return (
    <div>
      <p className="mb-5 text-sm text-slate">
        You&apos;re on the <span className="font-semibold text-ink">{PLANS[plan].label}</span> plan. Allowances reset on {resets}.
      </p>
      <ul className="grid gap-4 sm:grid-cols-3">
        {meters.map((m) => {
          const unlimited = !Number.isFinite(m.limit);
          const pct = unlimited ? 0 : Math.min(100, Math.round((m.used / Math.max(1, m.limit)) * 100));
          const full = !unlimited && m.used >= m.limit;
          return (
            <li key={m.meter} className="rounded-xl border border-line p-4">
              <p className="text-sm text-slate">{METER_LABEL[m.meter].many[0].toUpperCase() + METER_LABEL[m.meter].many.slice(1)}</p>
              <p className="text-heading mt-1 text-2xl">
                {m.used}
                <span className="text-base font-medium text-slate"> / {unlimited ? "∞" : m.limit}</span>
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#F2F2F6]" role="meter" aria-valuemin={0} aria-valuemax={unlimited ? undefined : m.limit} aria-valuenow={m.used} aria-label={METER_LABEL[m.meter].many}>
                <div className={cn("h-full rounded-full", full ? "bg-coral-deep" : BAR[m.meter])} style={{ width: `${unlimited ? 4 : Math.max(pct, m.used ? 4 : 0)}%` }} />
              </div>
              {full && <p className="mt-2 text-xs font-medium text-coral-deep">Used up for this month</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
