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
    <nav aria-label="Project" className="flex flex-wrap items-center gap-2">
      {tabs.map((t) =>
        t.enabled ? (
          <Link
            key={t.href}
            href={t.href}
            aria-current={t.active ? "page" : undefined}
            className={cn(
              "rounded-full border-[1.5px] px-4 py-1.5 text-sm font-semibold transition-colors duration-200",
              t.active ? "border-ink bg-ink text-white" : "border-line bg-white text-slate hover:border-ink hover:text-ink",
            )}
          >
            {t.label}
          </Link>
        ) : (
          <span key={t.href} aria-disabled className="cursor-not-allowed rounded-full border-[1.5px] border-line px-4 py-1.5 text-sm font-semibold text-slate opacity-50">{t.label}</span>
        ),
      )}
      <span className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-dashed border-line px-4 py-1.5 text-sm text-slate" title="Planned for a future release">
        Video <span className="text-xs">coming soon</span>
      </span>
    </nav>
  );
}
