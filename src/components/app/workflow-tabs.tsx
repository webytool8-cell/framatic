"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

/** Two places to be: the ads, and the brand they're built from. */
export function WorkflowTabs({ projectId, hasBrand }: { projectId: string; hasBrand: boolean; hasConcepts?: boolean }) {
  const path = usePathname();
  const base = `/projects/${projectId}`;
  const tabs = [
    { href: base, label: "Ad concepts", active: !path.startsWith(`${base}/brand`), enabled: true },
    { href: `${base}/brand`, label: "Brand", active: path.startsWith(`${base}/brand`), enabled: hasBrand },
  ];
  return (
    <nav aria-label="Project" className="flex items-center gap-1 rounded-lg border border-line bg-white p-1">
      {tabs.map((t) =>
        t.enabled ? (
          <Link
            key={t.href}
            href={t.href}
            aria-current={t.active ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1 text-sm font-semibold transition-colors duration-150",
              t.active ? "bg-ink text-white" : "text-slate hover:bg-lavender hover:text-ink",
            )}
          >
            {t.label}
          </Link>
        ) : (
          <span key={t.href} aria-disabled className="cursor-not-allowed rounded-md px-3 py-1 text-sm font-semibold text-slate opacity-50">{t.label}</span>
        ),
      )}
    </nav>
  );
}
