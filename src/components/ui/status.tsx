import { cn } from "@/lib/cn";
import type { ProjectStatus } from "@/lib/types";

const map: Record<ProjectStatus, { label: string; dot: string; ring: string; pulse?: boolean }> = {
  draft: { label: "Draft", dot: "bg-line-strong", ring: "border-line" },
  analyzing: { label: "Analyzing", dot: "bg-cyan", ring: "border-cyan", pulse: true },
  analyzed: { label: "Brand ready", dot: "bg-violet", ring: "border-violet" },
  analysis_failed: { label: "Analysis failed", dot: "bg-coral", ring: "border-coral" },
  generating: { label: "Generating concepts", dot: "bg-yellow", ring: "border-yellow", pulse: true },
  concepts_ready: { label: "Concepts ready", dot: "bg-lime", ring: "border-lime" },
  generation_failed: { label: "Generation failed", dot: "bg-coral", ring: "border-coral" },
};

export function StatusPill({ status, className }: { status: ProjectStatus; className?: string }) {
  const s = map[status] ?? map.draft;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border-[1.5px] bg-white px-2.5 py-0.5 text-xs font-semibold", s.ring, className)}>
      <span className="relative flex h-2 w-2">
        {s.pulse && <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", s.dot)} />}
        <span className={cn("relative inline-flex h-2 w-2 rounded-full", s.dot)} />
      </span>
      {s.label}
    </span>
  );
}

export function Tag({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "verified" | "inferred" | "user" }) {
  const tones = {
    neutral: "border-line text-slate",
    verified: "border-lime bg-mint text-lime-deep",
    inferred: "border-yellow bg-butter text-yellow-deep",
    user: "border-violet bg-lavender text-violet-deep",
  } as const;
  return <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10.5px] font-medium uppercase tracking-wider", tones[tone])}>{children}</span>;
}
