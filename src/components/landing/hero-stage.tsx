"use client";
import { useRef, useState } from "react";
import { Composer } from "@/components/app/composer";
import { WorkspacePreview } from "@/components/landing/workspace-preview";
import { SAMPLE_PRODUCTS } from "@/lib/samples";
import { cn } from "@/lib/cn";

/** Store and product-page platforms whose public pages Framatic can read. */
export const PLATFORMS = ["Shopify", "WooCommerce", "Wix", "Squarespace", "Webflow", "Gumroad", "Lemon Squeezy", "App Store"];

/**
 * Hero: headline (children) + the link composer, a "try a sample" row that
 * swaps the live workspace example, and the platforms we read.
 */
export function HeroStage({ children }: { children: React.ReactNode }) {
  const [id, setId] = useState(SAMPLE_PRODUCTS[0].id);
  const sample = SAMPLE_PRODUCTS.find((s) => s.id === id) ?? SAMPLE_PRODUCTS[0];
  const previewRef = useRef<HTMLDivElement>(null);

  function pick(next: string) {
    setId(next);
    // On narrow screens the preview sits below the fold: bring it into view.
    if (window.matchMedia("(max-width: 1023px)").matches) previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="grid items-start gap-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
      <div>
        {children}
        <div className="mt-10">
          <Composer />
        </div>

        <div className="mt-7">
          <p className="mb-2.5 text-sm text-slate">No link handy? See what Framatic makes for a sample product:</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Sample products">
            {SAMPLE_PRODUCTS.map((s) => {
              const on = s.id === id;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => pick(s.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border-[1.5px] bg-white py-1.5 pl-1.5 pr-3 text-left text-sm transition-[border-color,transform] duration-150 hover:-translate-y-px",
                    on ? "border-ink shadow-[3px_3px_0_0_#202124]" : "border-line hover:border-ink",
                  )}
                >
                  <span aria-hidden className="flex h-7 w-7 overflow-hidden rounded-lg">
                    {s.colors.slice(0, 2).map((c) => <span key={c} className="flex-1" style={{ background: c }} />)}
                  </span>
                  <span className="leading-tight">
                    <span className="block font-semibold">{s.name}</span>
                    <span className="block text-xs text-slate">{s.kind}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate">
          {["Free to try, no credit card", "Three ads in about 2 minutes", "Built for Reels, TikTok & YouTube"].map((t) => (
            <li key={t} className="flex items-center gap-1.5"><span aria-hidden className="text-lime-deep">✓</span>{t}</li>
          ))}
        </ul>
      </div>

      <div ref={previewRef} className="scroll-mt-20 lg:sticky lg:top-24 lg:pt-12">
        <WorkspacePreview key={sample.id} sample={sample} />
      </div>
    </div>
  );
}

/** "Works with" strip of store platforms, set in plain wordmark type. */
export function PlatformStrip() {
  return (
    <div className="mt-16 border-t border-black/5 pt-8">
      <p className="mb-4 text-center text-sm text-slate">Paste a link from any public store, product or app page, including</p>
      <ul className="flex flex-wrap items-center justify-center gap-x-9 gap-y-3">
        {PLATFORMS.map((p) => (
          <li key={p} className="text-lg font-bold tracking-tight text-ink/45 transition-colors hover:text-ink">{p}</li>
        ))}
      </ul>
    </div>
  );
}
