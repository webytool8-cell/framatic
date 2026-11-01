"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/form";
import { Circle, Ring } from "@/components/ui/shapes";
import type { ProjectStatus } from "@/lib/types";

type Kind = "analyze" | "generate" | "autopilot";
const RUNNING: Record<Kind, ProjectStatus[]> = { analyze: ["analyzing"], generate: ["generating"], autopilot: ["analyzing", "generating"] };
const ENDPOINT: Record<Kind, string> = { analyze: "analyze", generate: "concepts", autopilot: "autopilot" };
const TITLE: Record<Kind, string> = { analyze: "Reading your website", generate: "Writing your ad concepts", autopilot: "Making your ad concepts" };
const STEPS: Record<Kind, string[]> = {
  autopilot: ["Reading your website", "Picking up colors, type and logo", "Understanding the product and audience", "Writing three creative directions", "Planning every scene"],
  analyze: ["Checking the address", "Reading your pages", "Collecting colors, type and assets", "Understanding the product", "Writing the brand profile"],
  generate: ["Reading the brand profile", "Finding the strongest stories", "Writing three directions", "Planning scenes and timing", "Validating scene plans"],
};

/** Starts a background job and polls project status until it finishes. */
export function JobRunner({
  projectId,
  kind,
  status,
  message,
  autoStart = false,
  label,
  variant = "primary",
}: {
  projectId: string;
  kind: Kind;
  status: ProjectStatus;
  message?: string | null;
  autoStart?: boolean;
  label: string;
  variant?: "primary" | "secondary";
}) {
  const router = useRouter();
  const [running, setRunning] = useState(RUNNING[kind].includes(status));
  const [polling, setPolling] = useState(RUNNING[kind].includes(status));
  const polls = useRef(0);
  const [liveMessage, setLiveMessage] = useState<string | null>(message ?? null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const started = useRef(false);

  const start = useCallback(async () => {
    setError(null);
    setRunning(true);
    const res = await fetch(`/api/projects/${projectId}/${ENDPOINT[kind]}`, { method: "POST" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setRunning(false);
      setError(body.error ?? "Couldn't start. Please try again.");
      return;
    }
    setPolling(true);
  }, [projectId, kind]);

  useEffect(() => {
    if (autoStart && !started.current && status === "draft") {
      started.current = true;
      void start();
      router.replace(`/projects/${projectId}`);
    }
  }, [autoStart, status, start, router, projectId]);

  useEffect(() => {
    if (!polling) return;
    let alive = true;
    polls.current = 0;
    const iv = setInterval(async () => {
      polls.current += 1;
      setTick(polls.current);
      const res = await fetch(`/api/projects/${projectId}/status`, { cache: "no-store" }).catch(() => null);
      if (!alive || !res?.ok) return;
      const s = (await res.json()) as { status: ProjectStatus; message: string | null };
      setLiveMessage(s.message);
      if (!RUNNING[kind].includes(s.status)) {
        setPolling(false);
        setRunning(false);
        router.refresh();
      }
    }, 2000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [polling, projectId, kind, router]);

  if (running) {
    const generatingNow = kind === "autopilot" && /concept|direction|Writing/i.test(liveMessage ?? "");
    const step = Math.min(STEPS[kind].length - 1, Math.max(generatingNow ? 3 : 0, Math.floor(tick / 5)));
    return (
      <div role="status" aria-live="polite" className="relative overflow-hidden rounded-[var(--radius-card)] border-[1.5px] border-cyan bg-white p-8">
        <div className="mb-6 flex items-center gap-4">
          <span aria-hidden className="relative h-12 w-12">
            <Ring className="absolute inset-0 animate-spin-slow" color="#39C6E8" stroke={12} />
            <Circle className="absolute inset-3 animate-pulse" color="#7957FF" />
          </span>
          <div>
            <p className="text-heading text-xl">{TITLE[kind]}</p>
            <p className="text-sm text-slate">{liveMessage ?? "Working…"} {kind === "autopilot" ? "About a minute. You can leave this page; we'll keep going." : "This usually takes under a minute."}</p>
          </div>
        </div>
        <ol className="space-y-2">
          {STEPS[kind].map((s, i) => (
            <li key={s} className="flex items-center gap-3 text-sm">
              <span className={`h-2.5 w-2.5 rounded-full transition-colors duration-300 ${i < step ? "bg-lime" : i === step ? "bg-cyan animate-pulse" : "bg-line"}`} />
              <span className={i <= step ? "text-ink" : "text-slate"}>{s}</span>
            </li>
          ))}
        </ol>
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-1 overflow-hidden bg-ice">
          <div className="h-full w-1/3 animate-scan bg-gradient-to-r from-cyan via-violet to-coral" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && <Alert>{error}</Alert>}
      <Button variant={variant} size="lg" onClick={start}>{label}</Button>
    </div>
  );
}
