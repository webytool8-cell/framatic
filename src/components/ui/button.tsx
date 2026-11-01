import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "ink";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap rounded-[var(--radius-control)] " +
  "transition-[transform,background-color,border-color,color] duration-200 ease-[var(--ease-snap)] " +
  "hover:-translate-y-px active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  primary: "bg-violet text-white border-2 border-violet hover:bg-violet-deep hover:border-violet-deep",
  secondary: "bg-white text-violet-deep border-2 border-violet hover:bg-lavender",
  ghost: "bg-transparent text-ink border-2 border-transparent hover:border-line hover:bg-white",
  danger: "bg-white text-coral-deep border-2 border-coral hover:bg-peach",
  ink: "bg-ink text-white border-2 border-ink hover:bg-black",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-[15px]",
  lg: "h-14 px-7 text-base",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)}>
      {children}
    </Link>
  );
}
