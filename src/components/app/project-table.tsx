"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteProject, renameProject } from "@/app/actions/projects";
import { StatusPill } from "@/components/ui/status";
import type { ProjectStatus } from "@/lib/types";

export interface ProjectListItem {
  id: string;
  name: string;
  website_url: string | null;
  status: ProjectStatus;
  updated_at: string;
  primary: string | null;
  palette: string[];
  concepts: number;
  preferred: string | null;
}

const fmt = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
function ago(iso: string) {
  const mins = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (Math.abs(mins) < 60) return fmt.format(mins, "minute");
  const hrs = Math.round(mins / 60);
  if (Math.abs(hrs) < 24) return fmt.format(hrs, "hour");
  return fmt.format(Math.round(hrs / 24), "day");
}

function Row({ p }: { p: ProjectListItem }) {
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [name, setName] = useState(p.name);
  const [pending, start] = useTransition();
  const host = p.website_url ? new URL(p.website_url).hostname.replace(/^www\./, "") : "No website";
  return (
    <li className="group relative grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-1 px-5 py-4 transition-colors hover:bg-[#FAFAFC] md:grid-cols-[auto_minmax(0,2fr)_minmax(0,1.4fr)_170px_90px_110px_auto]">
      <span aria-hidden className="flex h-9 w-9 overflow-hidden rounded-lg border border-black/5">
        {(p.palette.length ? p.palette : ["#F0EBFF"]).slice(0, 3).map((c, i) => <span key={i} className="flex-1" style={{ background: c }} />)}
      </span>
      <div className="min-w-0">
        {editing ? (
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await renameProject(p.id, name); if (!r?.error) setEditing(false); }); }}>
            <input aria-label="Project name" value={name} onChange={(e) => setName(e.target.value)} autoFocus className="h-8 w-full rounded-md border border-violet px-2 text-sm focus:outline-none" />
            <button className="rounded-md bg-ink px-2.5 text-xs font-semibold text-white" disabled={pending}>Save</button>
          </form>
        ) : (
          <Link href={`/projects/${p.id}`} className="block truncate font-semibold after:absolute after:inset-0">{p.name}</Link>
        )}
        <p className="truncate font-mono text-xs text-slate md:hidden">{host}</p>
      </div>
      <p className="hidden truncate font-mono text-xs text-slate md:block">{host}</p>
      <div className="hidden md:block"><StatusPill status={p.status} /></div>
      <p className="hidden text-sm md:block">{p.concepts ? `${p.concepts} concepts` : "—"}</p>
      <p className="hidden text-sm text-slate md:block">{ago(p.updated_at)}</p>
      <div className="relative z-10 flex items-center justify-end gap-1 text-xs">
        {confirm ? (
          <>
            <button className="rounded-md px-2 py-1 font-semibold text-coral-deep hover:bg-peach" disabled={pending} onClick={() => start(async () => { await deleteProject(p.id); })}>Delete</button>
            <button className="rounded-md px-2 py-1 text-slate hover:bg-lavender" onClick={() => setConfirm(false)}>Cancel</button>
          </>
        ) : (
          <span className="flex gap-1 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:group-focus-within:opacity-100">
            <button className="rounded-md px-2 py-1 text-slate hover:bg-lavender hover:text-ink" onClick={() => setEditing((v) => !v)}>Rename</button>
            <button className="rounded-md px-2 py-1 text-slate hover:bg-peach hover:text-ink" onClick={() => setConfirm(true)}>Delete</button>
          </span>
        )}
      </div>
      {p.preferred && <p className="col-span-full -mt-0.5 truncate pl-[3.25rem] text-xs text-slate"><span className="text-coral">★</span> {p.preferred}</p>}
    </li>
  );
}

export function ProjectTable({ projects }: { projects: ProjectListItem[] }) {
  const [q, setQ] = useState("");
  const shown = projects.filter((p) => `${p.name} ${p.website_url ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <h2 className="text-sm font-semibold">Projects <span className="ml-1 font-normal text-slate">{projects.length}</span></h2>
        <label className="relative">
          <span className="sr-only">Search projects</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="h-8 w-44 rounded-md border border-line bg-[#FAFAFC] pl-7 pr-2 text-sm focus:border-violet focus:outline-none" />
          <svg aria-hidden viewBox="0 0 16 16" className="absolute left-2 top-2 h-4 w-4 text-slate"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        </label>
      </div>
      <div className="hidden grid-cols-[auto_minmax(0,2fr)_minmax(0,1.4fr)_170px_90px_110px_auto] gap-x-4 border-b border-line bg-[#FAFAFC] px-4 py-2 text-xs font-medium text-slate md:grid">
        <span className="w-9" /><span>Name</span><span>Link</span><span>Status</span><span>Output</span><span>Updated</span><span className="w-[7.5rem]" />
      </div>
      {shown.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-slate">{projects.length ? "No projects match that search." : "No projects yet. Paste a store or product link above to make your first ad."}</p>
      ) : (
        <ul className="divide-y divide-line">{shown.map((p) => <Row key={p.id} p={p} />)}</ul>
      )}
    </section>
  );
}
