"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "@/app/actions/auth";
import { Logo } from "@/components/ui/shapes";
import { cn } from "@/lib/cn";
import type { ProjectStatus } from "@/lib/types";
import { CreditPill } from "./credits-card";

export type SidebarCredits = { left: number; allowance: number; unlimited: boolean } | null;

export interface SidebarProject {
  id: string;
  name: string;
  status: ProjectStatus;
  color: string | null;
}

const DOT: Record<ProjectStatus, string> = {
  draft: "bg-line-strong",
  analyzing: "bg-cyan animate-pulse",
  analyzed: "bg-violet",
  analysis_failed: "bg-coral",
  generating: "bg-yellow animate-pulse",
  concepts_ready: "bg-lime-deep",
  generation_failed: "bg-coral",
};

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn("flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors duration-150", active ? "bg-lavender font-semibold text-ink" : "text-slate hover:bg-[#F5F5F8] hover:text-ink")}
    >
      {children}
    </Link>
  );
}

function SidebarBody({ projects, email, credits }: { projects: SidebarProject[]; email: string | null; credits: SidebarCredits }) {
  const path = usePathname();
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center px-4">
        <Link href="/dashboard" aria-label="Framatic home"><Logo /></Link>
      </div>
      <div className="px-3">
        <Link href="/projects/new" className="flex h-9 items-center justify-center gap-2 rounded-lg bg-violet text-sm font-semibold text-white transition-colors hover:bg-violet-deep">
          <span aria-hidden className="text-base leading-none">+</span> New ad
        </Link>
      </div>
      <nav className="mt-4 space-y-0.5 px-3" aria-label="Main">
        <NavLink href="/dashboard" active={path === "/dashboard"}>
          <svg aria-hidden viewBox="0 0 16 16" className="h-4 w-4"><rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.5" fill="currentColor" opacity=".9" /><rect x="9" y="1.5" width="5.5" height="5.5" rx="2.75" fill="currentColor" opacity=".5" /><rect x="1.5" y="9" width="5.5" height="5.5" rx="1.5" fill="currentColor" opacity=".5" /><rect x="9" y="9" width="5.5" height="5.5" rx="1.5" fill="currentColor" opacity=".9" /></svg>
          All projects
        </NavLink>
        <NavLink href="/sample" active={path.startsWith("/sample")}>
          <svg aria-hidden viewBox="0 0 16 16" className="h-4 w-4"><path d="M8 1.5c.5 0 .4 3 2 4.4 1.5 1.3 4.5 1.4 4.5 1.9s-3 .6-4.5 1.9C8.4 11.1 8.5 14.5 8 14.5s-.4-3.4-2-4.8C4.5 8.4 1.5 8.3 1.5 7.8s3-.6 4.5-1.9C7.6 4.5 7.5 1.5 8 1.5Z" fill="currentColor" /></svg>
          Sample project
        </NavLink>
        <NavLink href="/music" active={path === "/music"}>
          <svg aria-hidden viewBox="0 0 16 16" className="h-4 w-4"><path d="M6 12.5V3.5l7-1.5v9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><circle cx="4.5" cy="12.5" r="1.8" fill="currentColor" /><circle cx="11.5" cy="11" r="1.8" fill="currentColor" /></svg>
          Music library
        </NavLink>
        <NavLink href="/settings" active={path === "/settings"}>
          <svg aria-hidden viewBox="0 0 16 16" className="h-4 w-4"><circle cx="8" cy="8" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          Settings
        </NavLink>
      </nav>
      <p className="mt-6 px-5 text-xs font-medium text-slate">Recent</p>
      <ul className="mt-1.5 min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
        {projects.length === 0 && <li className="px-2.5 py-1.5 text-sm text-slate">No projects yet</li>}
        {projects.map((p) => {
          const active = path.startsWith(`/projects/${p.id}`);
          return (
            <li key={p.id}>
              <NavLink href={`/projects/${p.id}`} active={active}>
                <span aria-hidden className="relative h-4 w-4 shrink-0 rounded" style={{ background: p.color ?? "#E8E8EE" }}>
                  <span className={cn("absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-white", DOT[p.status])} />
                </span>
                <span className="truncate">{p.name}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
      <div className="space-y-3 border-t border-line p-3">
        {credits && <CreditPill {...credits} />}
        <div className="flex items-center gap-2.5 px-1">
          <span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink text-xs font-bold uppercase text-white">{email?.[0] ?? "?"}</span>
          <span className="min-w-0 flex-1 truncate text-sm">{email}</span>
          <form action={signOut}>
            <button className="rounded-md px-2 py-1 text-xs text-slate hover:bg-peach hover:text-ink">Sign out</button>
          </form>
        </div>
      </div>
    </div>
  );
}

/** Persistent sidebar on desktop, slide-over drawer on small screens. */
export function Sidebar({ projects, email, credits = null }: { projects: SidebarProject[]; email: string | null; credits?: SidebarCredits }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-line bg-white lg:block">
        <SidebarBody projects={projects} email={email} credits={credits} />
      </aside>
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-white px-4 lg:hidden">
        <Link href="/dashboard" aria-label="Framatic home"><Logo /></Link>
        <div className="flex items-center gap-2">
          <Link href="/projects/new" className="rounded-lg bg-violet px-3 py-1.5 text-sm font-semibold text-white">+ New ad</Link>
          <button aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)} className="grid h-9 w-9 place-items-center rounded-lg border border-line">
            <svg aria-hidden viewBox="0 0 16 16" className="h-4 w-4"><path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          </button>
        </div>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button aria-label="Close menu" className="absolute inset-0 bg-ink/30" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 animate-[rise_200ms_var(--ease-snap)_both] bg-white shadow-xl">
            <SidebarBody projects={projects} email={email} credits={credits} />
          </aside>
        </div>
      )}
    </>
  );
}
