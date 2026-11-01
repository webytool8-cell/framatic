"use client";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import type { ScenePlan } from "@/lib/creative/scene-plan";
import { sceneStarts } from "@/video/timeline";
import { PURPOSE_COLOR } from "./storyboard";
import { cn } from "@/lib/cn";

const AdPlayer = dynamic(() => import("./ad-player"), {
  ssr: false,
  loading: () => <div className="grid aspect-video w-full place-items-center rounded-xl bg-[#F2F2F6] text-sm text-slate">Loading preview…</div>,
});

/** Animated preview with a clickable scene timeline underneath. */
export function ScenePreview({ plan, logoUrl, productName, autoPlay = false, controls = true, compact = false }: { plan: ScenePlan; logoUrl?: string | null; productName?: string; autoPlay?: boolean; controls?: boolean; compact?: boolean }) {
  const starts = useMemo(() => sceneStarts(plan), [plan]);
  const [frame, setFrame] = useState(0);
  const [seek, setSeek] = useState<{ frame: number; id: number } | null>(null);
  const current = starts.reduce((acc, s, i) => (frame >= s ? i : acc), 0);
  const portrait = plan.aspectRatio === "9:16" || plan.aspectRatio === "4:5";

  return (
    <div>
      <div className={cn("mx-auto overflow-hidden rounded-xl border border-line", portrait && !compact && "max-w-[340px]")}>
        <AdPlayer plan={plan} logoUrl={logoUrl} productName={productName} autoPlay={autoPlay} controls={controls} onFrame={setFrame} seekTo={seek} />
      </div>
      <ol className={cn("mt-2 flex gap-1", compact && "mt-1.5")} aria-label="Scenes">
        {plan.scenes.map((s, i) => (
          <li key={s.id} style={{ flex: s.durationSec }} className="min-w-0">
            <button
              type="button"
              onClick={() => setSeek({ frame: starts[i], id: Date.now() })}
              title={`Jump to scene ${i + 1}: ${s.headline}`}
              className={cn("w-full rounded-md border px-1.5 py-1 text-left transition-colors duration-150", current === i ? "border-ink bg-white" : "border-line bg-[#FAFAFC] hover:border-line-strong")}
            >
              <span className="block h-1 rounded-full" style={{ background: PURPOSE_COLOR[s.purpose] }} />
              {!compact && <span className="mt-1 block truncate text-[11px] font-medium">{s.headline}</span>}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
