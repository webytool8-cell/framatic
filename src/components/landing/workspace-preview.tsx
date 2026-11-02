"use client";
import { useMemo, useState } from "react";
import { ScenePreview } from "@/components/app/scene-preview";
import { Tag } from "@/components/ui/status";
import { cn } from "@/lib/cn";
import type { SampleProduct } from "@/lib/samples";

const SLOT_STYLE = [
  { color: "bg-coral text-white", ring: "border-coral" },
  { color: "bg-cyan text-ink", ring: "border-cyan" },
  { color: "bg-violet text-white", ring: "border-violet" },
];

/**
 * Interactive example of the workspace using real storyboard components and
 * fictional sample data. Clearly labeled as an example.
 */
export function WorkspacePreview({ sample }: { sample: SampleProduct }) {
  const [active, setActive] = useState(0);
  const concepts = sample.concepts.map((k, i) => ({ ...k, ...SLOT_STYLE[i] }));
  const c = concepts[active] ?? concepts[0];
  const plan = sample.plans["16:9"];
  const p = useMemo(() => {
    const scenes = plan.scenes.map((s, i) => (i === 0 ? { ...s, headline: c.headline } : s));
    return { ...plan, scenes };
  }, [plan, c.headline]);

  return (
    <figure className="overflow-hidden rounded-2xl border border-line-strong bg-white shadow-[0_30px_60px_-30px_rgba(32,33,36,0.35)]">
      <div className="flex items-center gap-2 border-b border-line bg-[#FAFAFC] px-3 py-2">
        <span aria-hidden className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-coral" /><span className="h-2.5 w-2.5 rounded-full bg-yellow" /><span className="h-2.5 w-2.5 rounded-full bg-lime" />
        </span>
        <span className="ml-2 truncate rounded-md bg-white px-2 py-0.5 font-mono text-[11px] text-slate">framatic / {sample.host}</span>
        <span className="ml-auto rounded bg-butter px-1.5 py-0.5 text-[10px] font-semibold text-yellow-deep">Example output</span>
      </div>

      <div className="grid md:grid-cols-[180px_1fr]">
        {/* Brand panel */}
        <div className="hidden border-r border-line p-3 text-xs md:block">
          <p className="mb-2 font-semibold">Brand</p>
          <div className="mb-2 flex h-5 overflow-hidden rounded">
            {sample.colors.map((col, i) => <span key={col} className={["flex-[3]", "flex-[2]", "flex-1"][i]} style={{ background: col }} />)}
          </div>
          <p className="mb-3 text-slate">{sample.meta}</p>
          <ul className="space-y-2">
            {sample.facts.map((f) => (
              <li key={f.label}><p className="text-slate">{f.label}</p><p className="font-medium">{f.value}</p><Tag tone={f.tone}>{f.tone === "verified" ? "From site" : "AI read"}</Tag></li>
            ))}
          </ul>
        </div>

        {/* Concepts + storyboard */}
        <div className="min-w-0 p-3">
          <div role="tablist" aria-label="Example concepts" className="mb-3 grid grid-cols-3 gap-1.5">
            {concepts.map((k, i) => (
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
          <ScenePreview key={sample.id} plan={p} productName={sample.mark} autoPlay controls={false} compact />
          <dl className="mt-3 grid grid-cols-3 gap-1.5 text-[11px]">
            {[["Hook", c.hook], ["CTA", sample.cta], ["Music", sample.music]].map(([k, v]) => (
              <div key={k} className="min-w-0 rounded-md bg-[#FAFAFC] px-2 py-1.5"><dt className="text-slate">{k}</dt><dd className="truncate font-semibold">{v}</dd></div>
            ))}
          </dl>
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-line px-2.5 py-2">
            <span className="flex-1 truncate text-xs text-slate">Edit any scene, color or format yourself</span>
            <span className="rounded-md bg-violet px-2 py-1 text-[11px] font-semibold text-white">Edit</span>
          </div>
        </div>
      </div>
      <figcaption className="sr-only">Example of the Framatic workspace for a fictional product.</figcaption>
    </figure>
  );
}
