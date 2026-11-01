"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteProject, renameProject } from "@/app/actions/projects";
import { StatusPill } from "@/components/ui/status";
import { Input } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import type { ProjectStatus } from "@/lib/types";

const fmt = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" });

export function ProjectCard({
  p,
}: {
  p: { id: string; name: string; website_url: string | null; status: ProjectStatus; created_at: string; updated_at: string; primary: string | null; preferred: string | null };
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [name, setName] = useState(p.name);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const host = p.website_url ? new URL(p.website_url).hostname.replace(/^www\./, "") : "Manual brand";

  return (
    <article className="lift group relative flex flex-col rounded-[var(--radius-card)] border-[1.5px] border-line bg-white p-5 hover:border-violet">
      <div className="mb-5 flex items-start justify-between gap-3">
        <span aria-hidden className="relative block h-11 w-11 shrink-0">
          <span className="absolute inset-0 rounded-xl" style={{ background: p.primary ?? "#F0EBFF" }} />
          <span className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-white bg-lime" />
        </span>
        <StatusPill status={p.status} />
      </div>

      {editing ? (
        <form
          className="mb-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await renameProject(p.id, name);
              if (r?.error) setError(r.error);
              else setEditing(false);
            });
          }}
        >
          <Input aria-label="Project name" value={name} onChange={(e) => setName(e.target.value)} autoFocus className="h-9" />
          <Button size="sm" disabled={pending}>Save</Button>
        </form>
      ) : (
        <h3 className="text-heading mb-1 truncate text-lg">
          <Link href={`/projects/${p.id}`} className="after:absolute after:inset-0 focus:outline-none">{p.name}</Link>
        </h3>
      )}
      <p className="mb-4 truncate font-mono text-xs text-slate">{host}</p>
      {p.preferred && (
        <p className="mb-4 truncate text-sm"><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-coral align-middle" />{p.preferred}</p>
      )}
      {error && <p className="mb-2 text-xs text-coral-deep">{error}</p>}

      <div className="mt-auto flex items-center justify-between border-t border-line pt-3 text-xs text-slate">
        <span title={`Created ${fmt.format(new Date(p.created_at))}`}>Updated {fmt.format(new Date(p.updated_at))}</span>
        <span className="relative z-10 flex gap-1">
          {confirming ? (
            <>
              <button className="rounded-md px-2 py-1 font-semibold text-coral-deep hover:bg-peach" disabled={pending} onClick={() => start(async () => { const r = await deleteProject(p.id); if (r?.error) setError(r.error); })}>
                Delete for good
              </button>
              <button className="rounded-md px-2 py-1 hover:bg-lavender" onClick={() => setConfirming(false)}>Cancel</button>
            </>
          ) : (
            <>
              <button className="rounded-md px-2 py-1 hover:bg-lavender hover:text-ink" onClick={() => setEditing((v) => !v)}>Rename</button>
              <button className="rounded-md px-2 py-1 hover:bg-peach hover:text-ink" onClick={() => setConfirming(true)}>Delete</button>
            </>
          )}
        </span>
      </div>
    </article>
  );
}
