"use client";
import { CREDIT_COST } from "@/lib/plans";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export interface RenderItem {
  id: string;
  status: "rendering" | "done" | "failed";
  progress: number;
  aspect_ratio: string;
  duration_sec: number;
  scene_plan_version: number;
  out_size_bytes?: number | null;
  error?: string | null;
  created_at: string;
}

const time = new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit", month: "short", day: "numeric" });

/** Export the saved concept to MP4 through the cloud renderer, with live progress. */
export function ExportPanel({ conceptId, enabled, initial, version, aspectRatio, durationSec, hasUnsaved }: { conceptId: string; enabled: boolean; initial: RenderItem[]; version: number; aspectRatio: string; durationSec: number; hasUnsaved: boolean }) {
  const [items, setItems] = useState<RenderItem[]>(initial);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = items.filter((r) => r.status === "rendering").map((r) => r.id).join(",");

  const poll = useCallback(async (id: string) => {
    const res = await fetch(`/api/renders/${id}`, { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return;
    const body = (await res.json()) as RenderItem & { downloadUrl?: string | null };
    setItems((list) => list.map((r) => (r.id === id ? { ...r, ...body } : r)));
  }, []);

  useEffect(() => {
    if (!active) return;
    const ids = active.split(",");
    const iv = setInterval(() => ids.forEach((id) => void poll(id)), 2500);
    return () => clearInterval(iv);
  }, [active, poll]);

  async function start() {
    setStarting(true);
    setError(null);
    const res = await fetch(`/api/concepts/${conceptId}/renders`, { method: "POST" }).catch(() => null);
    const body = res ? await res.json().catch(() => ({})) : {};
    setStarting(false);
    if (!res?.ok) return setError(body.error ?? "Couldn't start the export. Please try again.");
    setItems((list) => [body as RenderItem, ...list].slice(0, 6));
  }

  async function download(id: string) {
    const res = await fetch(`/api/renders/${id}`, { cache: "no-store" });
    const body = await res.json().catch(() => ({}));
    if (body.downloadUrl) window.location.assign(body.downloadUrl);
    else setError(body.error ?? "That file isn't available anymore. Export again.");
  }

  return (
    <section aria-labelledby="export-title" className="rounded-xl border-[1.5px] border-line bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 id="export-title" className="text-heading text-lg">Export</h3>
        <span className="font-mono text-xs text-slate">MP4 · {aspectRatio} · {Math.round(durationSec)}s</span>
      </div>
      {enabled ? (
        <>
          <Button className="w-full" variant="ink" disabled={starting} onClick={start}>
            {starting ? "Starting export…" : "Export MP4"}
          </Button>
          <p className="mt-2 text-xs text-slate">
            Renders the saved version (v{version}) in the cloud, usually in about a minute. Uses {CREDIT_COST.render} credit.
            {hasUnsaved && <span className="text-coral-deep"> You have unsaved edits; save first to include them.</span>}
          </p>
        </>
      ) : (
        <p className="rounded-lg bg-[#FAFAFC] px-3 py-2 text-sm text-slate">Video export isn&apos;t switched on for this server yet. It needs the Google Cloud settings described in the README.</p>
      )}
      {error && <p className="mt-2 text-sm text-coral-deep">{error}</p>}
      {items.length > 0 && (
        <ul className="mt-3 divide-y divide-line border-t border-line text-sm">
          {items.map((r) => (
            <li key={r.id} className="py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate">v{r.scene_plan_version} · {r.aspect_ratio} · {time.format(new Date(r.created_at))}</span>
                {r.status === "done" && (
                  <button onClick={() => download(r.id)} className="rounded-md bg-lime px-2.5 py-1 text-xs font-semibold text-ink hover:brightness-95">
                    Download{r.out_size_bytes ? ` · ${(r.out_size_bytes / 1e6).toFixed(1)} MB` : ""}
                  </button>
                )}
                {r.status === "failed" && <span className="text-xs font-semibold text-coral-deep">Failed</span>}
                {r.status === "rendering" && <span className="font-mono text-xs">{Math.round(r.progress * 100)}%</span>}
              </div>
              {r.status === "rendering" && (
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#F2F2F6]">
                  <div className={cn("h-full rounded-full bg-violet transition-[width] duration-500")} style={{ width: `${Math.max(4, r.progress * 100)}%` }} />
                </div>
              )}
              {r.status === "failed" && r.error && <p className="mt-1 text-xs text-slate">{r.error}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
