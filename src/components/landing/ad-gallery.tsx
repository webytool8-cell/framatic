"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { SAMPLE_PRODUCTS } from "@/lib/samples";
import { cn } from "@/lib/cn";

const AdPlayer = dynamic(() => import("@/components/app/ad-player"), { ssr: false });

type Ratio = "9:16" | "1:1" | "4:5";
const ITEMS: { id: string; ratio: Ratio; concept: number; offset: number }[] = [
  // Offsets stagger the loops so the wall never shows the same scene type at once.
  { id: "mug", ratio: "9:16", concept: 0, offset: 0 },
  { id: "app", ratio: "1:1", concept: 1, offset: 200 },
  { id: "course", ratio: "4:5", concept: 0, offset: 100 },
  { id: "serum", ratio: "9:16", concept: 2, offset: 280 },
];
const PLACEMENT: Record<Ratio, string> = { "9:16": "Reels · TikTok · Shorts", "1:1": "Feed", "4:5": "Feed · Stories" };
const ASPECT: Record<Ratio, string> = { "9:16": "aspect-[9/16]", "1:1": "aspect-square", "4:5": "aspect-[4/5]" };

/** Mounts the player only once the tile scrolls near the viewport. */
function useNearViewport<T extends Element>() {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  return [ref, near] as const;
}

function Tile({ id, ratio, concept, offset }: (typeof ITEMS)[number]) {
  const s = SAMPLE_PRODUCTS.find((x) => x.id === id)!;
  const k = s.concepts[concept];
  const plan = s.plans[ratio];
  const withHook = { ...plan, scenes: plan.scenes.map((sc, i) => (i === 0 ? { ...sc, headline: k.headline } : sc)) };
  const [ref, near] = useNearViewport<HTMLDivElement>();

  return (
    <figure className="flex flex-col">
      <div ref={ref} className={cn("relative overflow-hidden rounded-2xl bg-white shadow-[0_24px_48px_-28px_rgba(32,33,36,0.45)] ring-1 ring-black/5", ASPECT[ratio])}>
        {near ? (
          <AdPlayer plan={withHook} productName={s.mark} autoPlay controls={false} startFrame={offset} />
        ) : (
          <div className="h-full w-full" style={{ background: `linear-gradient(160deg, ${s.colors[0]}, ${s.colors[1]})` }} />
        )}
        <span className="pointer-events-none absolute left-2.5 top-2.5 rounded-full bg-black/55 px-2 py-0.5 font-mono text-[10px] font-semibold text-white backdrop-blur">{ratio}</span>
      </div>
      <figcaption className="mt-3 px-0.5">
        <p className="flex items-center gap-2 font-semibold">
          <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: s.colors[0] }} />
          {s.name}
          <span className="ml-auto hidden rounded-md bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate ring-1 ring-black/5 lg:inline">{s.kind}</span>
        </p>
        <p className="mt-1 text-sm text-slate"><span className="lg:hidden">{s.kind} · </span>{k.hook} · {PLACEMENT[ratio]}</p>
        <p className="mt-0.5 font-mono text-[11px] text-slate">{plan.durationSec.toFixed(0)}s · {s.music}</p>
      </figcaption>
    </figure>
  );
}

/** Wall of finished example ads, each rendered live by the real video engine. */
export function AdGallery() {
  return (
    <div className="grid grid-cols-2 items-end gap-x-5 gap-y-10 lg:grid-cols-4">
      {ITEMS.map((it) => <Tile key={it.id} {...it} />)}
    </div>
  );
}
