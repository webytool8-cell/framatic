import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full rounded-[var(--radius-control)] border-[1.5px] border-line bg-white px-3.5 text-[15px] text-ink " +
  "placeholder:text-slate/70 transition-colors duration-150 hover:border-line-strong " +
  "focus:border-violet focus:outline-none focus:ring-4 focus:ring-lavender";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-24 py-2.5 leading-relaxed", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(control, "h-11 pr-8", className)} {...props} />;
}

export function Field({
  label,
  hint,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-slate">{hint}</p>}
    </div>
  );
}

export function Alert({
  tone = "error",
  children,
  className,
}: {
  tone?: "error" | "info" | "success" | "warning";
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    error: "border-coral bg-peach text-ink",
    info: "border-cyan bg-ice text-ink",
    success: "border-lime bg-mint text-ink",
    warning: "border-yellow bg-butter text-ink",
  } as const;
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("rounded-[var(--radius-control)] border-l-4 px-4 py-3 text-sm", tones[tone], className)}>
      {children}
    </div>
  );
}
