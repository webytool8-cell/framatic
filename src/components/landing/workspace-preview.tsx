"use client";
import { useMemo, useState } from "react";
import { ScenePreview } from "@/components/app/scene-preview";
import { Tag } from "@/components/ui/status";
import { cn } from "@/lib/cn";
import type { ScenePlan } from "@/lib/creative/scene-plan";

const CONCEPTS = [
  { slot: "A", name: "Problem → Solution", title: "Never cold again", color: "bg-coral text-white", ring: "border-coral" },
  { slot: "B", name: "Product in Motion", title: "Sip. Set. Stay hot.", color: "bg-cyan text-ink", ring: "border-cyan" },
  { slot: "C", name: "Brand Manifesto", title: "Good mornings deserve better", color: "bg-violet text-white", ring: "border-violet" },
];

/**
 * Interactive example of the workspace using real storyboard components and
 * fictional sample data. Clearly labeled as an example.
 */
export function WorkspacePreview({ plan }: { plan: ScenePlan }) {
  const [active, setActive] = useState(0);
  const c = CONCEPTS[active];
  const p = useMemo(() => {
    const scenes = plan.scenes.map((s, i) => (i === 0 ? { ...s, headline: active === 0 ? "Cold coffee. Again." : active === 1 ? "Sip. Set. Stay hot." : "Mornings, upgraded." } : s));
    return { ...plan, scenes };
  }, [plan, active]);

  return (
    <figure className="overflow-hidden rounded-2xl border border-line-strong bg-white shadow-[0_30px_60px_-30px_rgba(32,33,36,0.35)]">
      <div className="flex items-center gap-2 border-b border-line bg-[#FAFAFC] px-3 py-2">
        <span aria-hidden className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-coral" /><span className="h-2.5 w-2.5 rounded-full bg-yellow" /><span className="h-2.5 w-2.5 rounded-full bg-lime" />
        </span>
        <span className="ml-2 truncate rounded-md bg-white px-2 py-0.5 font-mono text-[11px] text-slate">framatic / lumenmug.example</span>
        <span className="ml-auto rounded bg-butter px-1.5 py-0.5 text-[10px] font-semibold text-yellow-deep">Example output</span>
      </div>

      <div className="grid md:grid-cols-[180px_1fr]">
        {/* Brand panel */}
        <div className="hidden border-r border-line p-3 text-xs md:block">
          <p className="mb-2 font-semibold">Brand</p>
          <div className="mb-2 flex h-5 overflow-hidden rounded"><span className="flex-[3] bg-[#E8572A]" /><span className="flex-[2] bg-[#2B2D42]" /><span className="flex-1 bg-[#F2C14E]" /></div>
          <p className="mb-3 text-slate">Space Grotesk · light · $39</p>
          <ul className="space-y-2">
            <li><p className="text-slate">Promise</p><p className="font-medium">Your coffee, hot for 3 hours</p><Tag tone="verified">From site</Tag></li>
            <li><p className="text-slate">Feature</p><p className="font-medium">Dishwasher-safe lid</p><Tag tone="verified">From site</Tag></li>
            <li><p className="text-slate">Audience</p><p className="font-medium">Busy remote workers</p><Tag tone="inferred">AI read</Tag></li>
          </ul>
        </div>

        {/* Concepts + storyboard */}
        <div className="min-w-0 p-3">
          <div role="tablist" aria-label="Example concepts" className="mb-3 grid grid-cols-3 gap-1.5">
            {CONCEPTS.map((k, i) => (
              <button
                key={k.slot}
                role="tab"
                aria-selected={active === i}
                onClick={() => setActive(i)}
                className={cn("flex min-w-0 items-center gap-1.5 rounded-lg border-[1.5px] px-2 py-1.5 text-left text-xs transition-colors duration-150", active === i ? cn(k.ring, "bg-white") : "border-line bg-[#FAFAFC] hover:border-line-strong")}
              >
                <span className={cn("grid h-5 w-5 shrink-0 place-items-center rounded text-[10px] font-bold", k.color)}>{k.slot}</span>
                <span className="truncate font-medium">{k.name}</span>
              </button>
            ))}
          </div>
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <p className="truncate text-sm font-semibold">{c.title}</p>
            <p className="shrink-0 font-mono text-[11px] text-slate">16:9 · {p.durationSec.toFixed(0)}s · 4 scenes · live preview</p>
          </div>
          <ScenePreview plan={p} productName="Lumen" autoPlay controls={false} compact />
          <dl className="mt-3 grid grid-cols-3 gap-1.5 text-[11px]">
            {[["Headline", active === 2 ? "Good mornings deserve better" : "Coffee that waits for you"], ["CTA", "Shop now"], ["Music", active === 2 ? "Soft Piano, 74 bpm" : "Bright Pop, 120 bpm"]].map(([k, v]) => (
              <div key={k} className="min-w-0 rounded-md bg-[#FAFAFC] px-2 py-1.5"><dt className="text-slate">{k}</dt><dd className="truncate font-semibold">{v}</dd></div>
            ))}
          </dl>
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-line px-2.5 py-2">
            <span className="flex-1 truncate text-xs text-slate">Make it punchier, 15 seconds, vertical…</span>
            <span className="rounded-md bg-violet px-2 py-1 text-[11px] font-semibold text-white">Apply</span>
          </div>
        </div>
      </div>
      <figcaption className="sr-only">Example of the Framatic workspace for a fictional brand.</figcaption>
    </figure>
  );
}
