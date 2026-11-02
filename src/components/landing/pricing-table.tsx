"use client";
import Link from "next/link";
import { useState } from "react";
import { CREDIT_COST, PLANS, PUBLIC_PLANS, projectsPerMonth, type CreditCosts, type PlanId } from "@/lib/plans";
import { cn } from "@/lib/cn";
import { Spark } from "@/components/ui/shapes";

const ACCENT: Record<string, { ring: string; chip: string; bar: string }> = {
  free: { ring: "ring-black/5", chip: "bg-[#F2F2F6] text-ink", bar: "bg-line-strong" },
  starter: { ring: "ring-black/5", chip: "bg-ice text-cyan-deep", bar: "bg-cyan" },
  pro: { ring: "ring-2 ring-violet", chip: "bg-lavender text-violet-deep", bar: "bg-violet" },
  studio: { ring: "ring-black/5", chip: "bg-peach text-coral-deep", bar: "bg-coral" },
};

/**
 * Plan cards with a monthly/yearly switch. Checkout isn't wired yet (Stripe
 * comes later), so paid plans start on Free and say upgrades open soon.
 */
export function PricingTable({ signedIn, currentPlan, costs = CREDIT_COST }: { signedIn: boolean; currentPlan: PlanId | null; costs?: CreditCosts }) {
  const [yearly, setYearly] = useState(true);
  const maxCredits = Math.max(...PUBLIC_PLANS.map((p) => PLANS[p].credits));

  return (
    <div>
      <div className="mb-10 flex justify-center">
        <div role="radiogroup" aria-label="Billing period" className="inline-flex rounded-full bg-white p-1 shadow-sm ring-1 ring-black/5">
          {[
            [false, "Monthly"],
            [true, "Yearly · 2 months free"],
          ].map(([val, label]) => (
            <button
              key={String(val)}
              role="radio"
              aria-checked={yearly === val}
              onClick={() => setYearly(val as boolean)}
              className={cn("rounded-full px-4 py-2 text-sm font-semibold transition-colors", yearly === val ? "bg-ink text-white" : "text-slate hover:text-ink")}
            >
              {label as string}
            </button>
          ))}
        </div>
      </div>

      <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {PUBLIC_PLANS.map((id) => {
          const p = PLANS[id];
          const a = ACCENT[id];
          const price = yearly ? p.priceYearlyPerMonth : p.priceMonthly;
          const current = currentPlan === id;
          const paid = (p.priceMonthly ?? 0) > 0;
          return (
            <li key={id} className={cn("relative flex flex-col rounded-3xl bg-white p-6 shadow-[0_24px_48px_-32px_rgba(32,33,36,0.35)] ring-1", a.ring, p.highlight && "xl:-mt-4 xl:pb-10")}>
              {p.highlight && (
                <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-violet px-3 py-1 text-xs font-semibold text-white">
                  <Spark className="h-3 w-3" color="#C5F467" />
                  Most popular
                </span>
              )}
              <div className="flex items-center justify-between">
                <h2 className="text-heading text-xl">{p.label}</h2>
                {current && <span className="rounded-full bg-mint px-2.5 py-0.5 text-xs font-semibold text-lime-deep">Your plan</span>}
              </div>
              <p className="mt-1 min-h-10 text-sm text-slate">{p.tagline}</p>

              <p className="mt-5 flex items-baseline gap-1">
                <span className="text-display text-5xl">${price}</span>
                <span className="text-sm text-slate">/ month</span>
              </p>
              <p className="mt-1 h-5 text-xs text-slate">{paid ? (yearly ? `Billed $${((price ?? 0) * 12).toLocaleString()} yearly` : "Billed monthly") : "Free forever"}</p>

              <div className="mt-5 rounded-2xl bg-[#FAFAFC] p-4">
                <p className="flex items-baseline justify-between">
                  <span className="text-heading text-2xl">{p.credits.toLocaleString()}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", a.chip)}>credits / month</span>
                </p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#ECECF2]">
                  <div className={cn("h-full rounded-full", a.bar)} style={{ width: `${Math.max(3, (p.credits / maxCredits) * 100)}%` }} />
                </div>
                <p className="mt-2 text-xs text-slate">About {projectsPerMonth(p.credits, costs).toLocaleString()} ad project{projectsPerMonth(p.credits, costs) === 1 ? "" : "s"} with edits and exports</p>
              </div>

              <ul className="mt-5 flex-1 space-y-2 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2"><span aria-hidden className="text-lime-deep">✓</span>{f}</li>
                ))}
              </ul>

              <div className="mt-6">
                {current ? (
                  <Link href="/dashboard" className="block rounded-xl border-[1.5px] border-line px-4 py-3 text-center text-sm font-semibold hover:border-ink">Go to your projects</Link>
                ) : !paid ? (
                  <Link href={signedIn ? "/dashboard" : "/signup"} className="block rounded-xl border-[1.5px] border-ink px-4 py-3 text-center text-sm font-semibold hover:bg-ink hover:text-white">
                    {signedIn ? "Go to your projects" : "Start free"}
                  </Link>
                ) : signedIn ? (
                  <button disabled className={cn("block w-full cursor-not-allowed rounded-xl px-4 py-3 text-center text-sm font-semibold opacity-60", p.highlight ? "bg-violet text-white" : "bg-ink text-white")}>
                    Upgrades open soon
                  </button>
                ) : (
                  <Link href={`/signup?plan=${id}`} className={cn("block rounded-xl px-4 py-3 text-center text-sm font-semibold text-white transition-transform hover:-translate-y-px", p.highlight ? "bg-violet hover:bg-violet-deep" : "bg-ink hover:bg-black")}>
                    Start free, upgrade later
                  </Link>
                )}
                {paid && !current && <p className="mt-2 text-center text-[11px] text-slate">Paid plans open soon. Your account upgrades in place.</p>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
