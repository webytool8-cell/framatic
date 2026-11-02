import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/landing/site-chrome";
import { PricingTable } from "@/components/landing/pricing-table";
import { CREDIT_ACTIONS, CREDIT_COST, PLANS, PUBLIC_PLANS, formatResetDate, typicalProjectCredits, type CreditBalance, type CreditCosts } from "@/lib/plans";
import { getCreditCosts } from "@/lib/billing-config";
import { getBalance } from "@/lib/credits";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { Spark } from "@/components/ui/shapes";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Pricing",
  description: "Framatic plans: monthly credits for AI video ads. Start free, no credit card.",
};

const ACTION_DOT: Record<string, string> = { analyze: "bg-violet", generate: "bg-cyan", regenerate: "bg-yellow", render: "bg-coral" };

const faq = (CREDIT_COST: CreditCosts): [string, string][] => [
  ["What is a credit?", `Credits are how Framatic measures AI work. A new ad project (we read your product page and write three complete concepts) uses ${CREDIT_COST.analyze}. An AI rework (the AI rewrites a concept for you) uses ${CREDIT_COST.regenerate}, and each MP4 export uses ${CREDIT_COST.render}. Editing anything yourself (text, timing, colors, format, music) is always free.`],
  ["Do I have to regenerate to change something?", "No. After the first generation you can edit every scene yourself: text, length, colors, animation, format, font and music, as often as you like, for free. The AI is there when you want a bigger rework."],
  ["Do unused credits roll over?", "No. Your credits refill to your plan's amount at the start of each month."],
  ["What if a generation fails?", "You aren't charged. Credits are held while the work runs and charged only for what's delivered: if we can't read your page or an export fails, the hold is returned, and if only two of three concepts come out, you pay for two."],
  ["Can I change plans later?", "Yes. Upgrade or downgrade any time. Paid plans are opening soon, and your account and projects stay exactly as they are when you upgrade."],
  ["Do I need a credit card to start?", "No. The Free plan includes 30 credits every month, enough for a project with edits and exports."],
  ["What happens when I run out?", "Your projects and videos stay available. New AI work pauses until your credits refill, or until you move to a bigger plan."],
];

const DEFAULT_COSTS = CREDIT_COST;

export default async function PricingPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  let signedIn = false;
  let balance: CreditBalance | null = null;
  let CREDIT_COST: CreditCosts = DEFAULT_COSTS;
  try {
    const supabase = await createClient();
    CREDIT_COST = await getCreditCosts(supabase);
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      signedIn = true;
      balance = await getBalance(createServiceClient(), data.user.id).catch(() => null);
    }
  } catch {
    // Supabase not configured (preview builds): show the public page.
  }
  const outOfCredits = reason === "credits" && balance;

  return (
    <div className="min-h-dvh overflow-x-clip bg-white">
      <SiteHeader signedIn={signedIn} active="/pricing" />

      <section className="bg-[radial-gradient(1000px_500px_at_10%_0%,#F0EBFF_0%,transparent_60%),radial-gradient(800px_500px_at_100%_10%,#E7F8FD_0%,transparent_55%),linear-gradient(180deg,#FFFFFF_0%,#FAFAFC_100%)]">
        <div className="mx-auto max-w-[1200px] px-5 pb-24 pt-20 sm:px-8 md:pb-32 md:pt-24">
          {outOfCredits && balance && (
            <div role="status" className="mx-auto mb-10 max-w-2xl rounded-2xl border-[1.5px] border-coral bg-peach px-5 py-4 text-center">
              <p className="font-semibold">You&apos;ve used this month&apos;s credits.</p>
              <p className="text-sm text-slate">
                A new ad project needs {CREDIT_COST.analyze} and you have {balance.left} left. They refill on {formatResetDate(balance.resetsAt)}.
              </p>
            </div>
          )}
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <p className="mb-3 text-sm font-semibold text-violet-deep">Pricing</p>
            <h1 className="text-display relative inline-block text-[clamp(2.4rem,4.2vw,3.6rem)]">
              Pay for ads, not seats.
              <Spark className="absolute -right-8 -top-4 h-8 w-8" color="#FF6B6B" twinkle />
              <Spark className="absolute -left-7 bottom-1 h-4 w-4" color="#39C6E8" twinkle delay={1200} />
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-slate">Every plan comes with monthly credits for AI work. Start free with no credit card, and pick a bigger plan when you&apos;re running more ads.</p>
          </div>
          <PricingTable costs={CREDIT_COST} signedIn={signedIn} currentPlan={balance?.plan === "unlimited" ? null : (balance?.plan ?? null)} />
        </div>
      </section>

      <section className="bg-[linear-gradient(180deg,#FFF0E8_0%,#FFF8E1_100%)]">
        <div className="mx-auto max-w-[1200px] px-5 py-24 sm:px-8 md:py-28">
          <div className="mb-12 max-w-2xl">
            <p className="mb-3 text-sm font-semibold text-violet-deep">How credits work</p>
            <h2 className="text-display text-[clamp(2.2rem,4.6vw,3.4rem)]">What a credit buys</h2>
            <p className="mt-4 text-lg text-slate">Only AI work and exports use credits. After the first generation, edit any scene yourself as much as you like: that&apos;s always free.</p>
          </div>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <ul className="space-y-3">
              {CREDIT_ACTIONS.map((a) => (
                <li key={a.kind} className="flex items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-black/5">
                  <span aria-hidden className={`h-10 w-1.5 rounded-full ${ACTION_DOT[a.kind]}`} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{a.label}</p>
                    <p className="text-sm text-slate">{a.detail}</p>
                  </div>
                  <p className="text-right">
                    <span className="text-heading text-2xl">{CREDIT_COST[a.kind]}</span>
                    <span className="block text-xs text-slate">credit{CREDIT_COST[a.kind] === 1 ? "" : "s"}</span>
                  </p>
                </li>
              ))}
              <li className="flex items-center gap-4 rounded-2xl border-[1.5px] border-dashed border-lime-deep/40 bg-mint/60 p-4">
                <span aria-hidden className="h-10 w-1.5 rounded-full bg-lime-deep" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">Editing by hand, previews and music</p>
                  <p className="text-sm text-slate">Change text, timing, colors, animation, format, font and music yourself</p>
                </div>
                <p className="text-heading text-2xl text-lime-deep">Free</p>
              </li>
            </ul>

            <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-black/5">
              <table className="w-full text-left text-sm">
                <caption className="px-5 pt-5 text-left">
                  <span className="font-semibold">What each plan covers in a month</span>
                  <span className="block text-xs text-slate">If you spent every credit on one thing</span>
                </caption>
                <thead className="text-slate">
                  <tr className="border-b border-line">
                    <th className="px-5 py-3 font-medium">Plan</th>
                    <th className="px-2 py-3 font-medium">New projects</th>
                    <th className="px-2 py-3 font-medium">AI reworks</th>
                    <th className="px-5 py-3 font-medium">MP4 exports</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {PUBLIC_PLANS.map((id) => {
                    const c = PLANS[id].credits;
                    return (
                      <tr key={id} className={PLANS[id].highlight ? "bg-lavender/50" : ""}>
                        <td className="px-5 py-3 font-semibold">{PLANS[id].label}<span className="block text-xs font-normal text-slate">{c.toLocaleString()} credits</span></td>
                        <td className="px-2 py-3 tabular-nums">{Math.floor(c / CREDIT_COST.analyze).toLocaleString()}</td>
                        <td className="px-2 py-3 tabular-nums">{Math.floor(c / CREDIT_COST.regenerate).toLocaleString()}</td>
                        <td className="px-5 py-3 tabular-nums">{Math.floor(c / CREDIT_COST.render).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="border-t border-line px-5 py-4 text-sm text-slate">
                A typical project, with a couple of AI reworks and two exports, uses about {typicalProjectCredits(CREDIT_COST)} credits.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto grid max-w-[1200px] gap-12 px-5 py-24 sm:px-8 md:py-28 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
          <div>
            <p className="mb-3 text-sm font-semibold text-violet-deep">FAQ</p>
            <h2 className="text-display text-[clamp(2.2rem,4.6vw,3.4rem)]">Questions, answered</h2>
          </div>
          <div className="divide-y divide-line border-y border-line">
            {faq(CREDIT_COST).map(([q, a]) => (
              <details key={q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold">
                  {q}
                  <span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#F2F2F6] text-slate transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 max-w-2xl text-slate">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[radial-gradient(800px_400px_at_85%_0%,rgba(121,87,255,0.55)_0%,transparent_60%),linear-gradient(180deg,#1B1A24_0%,#202124_100%)] text-white">
        <div className="mx-auto flex max-w-[1200px] flex-col items-start gap-8 px-5 py-24 sm:px-8 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="mb-3 text-sm font-semibold text-lime">Start free</p>
            <h2 className="text-display text-[clamp(2.4rem,5vw,4rem)]">{PLANS.free.credits} credits, on us, every month.</h2>
            <p className="mt-4 text-lg text-white/75">Enough to turn a product page into three ads and export your favorites.</p>
          </div>
          <Link href={signedIn ? "/dashboard" : "/#start"} className="rounded-xl bg-lime px-6 py-4 text-lg font-semibold text-ink transition-transform hover:-translate-y-0.5">
            {signedIn ? "Make a new ad" : "Paste a product link"}
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
