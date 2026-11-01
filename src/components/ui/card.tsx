import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export type Accent = "violet" | "coral" | "cyan" | "lime" | "yellow" | "none";

export const accentBorder: Record<Accent, string> = {
  violet: "border-violet",
  coral: "border-coral",
  cyan: "border-cyan",
  lime: "border-lime",
  yellow: "border-yellow",
  none: "border-line",
};

export const accentSurface: Record<Accent, string> = {
  violet: "bg-lavender",
  coral: "bg-peach",
  cyan: "bg-ice",
  lime: "bg-mint",
  yellow: "bg-butter",
  none: "bg-white",
};

export const accentHex: Record<Exclude<Accent, "none">, string> = {
  violet: "#7957FF",
  coral: "#FF6B6B",
  cyan: "#39C6E8",
  lime: "#C5F467",
  yellow: "#FFD166",
};

export function Card({
  accent = "none",
  tinted = false,
  interactive = false,
  className,
  ...props
}: ComponentProps<"div"> & { accent?: Accent; tinted?: boolean; interactive?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border-[1.5px]",
        accentBorder[accent],
        tinted ? accentSurface[accent] : "bg-white",
        interactive && "lift",
        className,
      )}
      {...props}
    />
  );
}

export function SectionCard({
  accent,
  title,
  eyebrow,
  action,
  children,
  className,
}: {
  accent: Accent;
  title: string;
  eyebrow?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card accent={accent} className={cn("p-6", className)}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          {eyebrow && <p className="label-tech mb-1">{eyebrow}</p>}
          <h2 className="text-heading text-xl">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}
