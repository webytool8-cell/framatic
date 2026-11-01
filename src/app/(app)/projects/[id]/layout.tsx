import Link from "next/link";
import { notFound } from "next/navigation";
import { WorkflowTabs } from "@/components/app/workflow-tabs";
import { StatusPill } from "@/components/ui/status";
import { getProject } from "@/lib/db/repo";
import { requireUser } from "@/lib/supabase/server";
import { effectiveStatus } from "@/lib/types";

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const project = await getProject(supabase, user.id, id).catch(() => null);
  if (!project) notFound();
  const host = project.website_url ? new URL(project.website_url).hostname.replace(/^www\./, "") : null;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div className="min-w-0">
          <nav aria-label="Breadcrumb" className="mb-0.5 text-xs text-slate">
            <Link href="/dashboard" className="hover:text-ink">Projects</Link> <span aria-hidden>/</span>
          </nav>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-heading truncate text-2xl">{project.name}</h1>
            <StatusPill status={effectiveStatus(project).status} />
            {host && (
              <a href={project.website_url!} target="_blank" rel="noreferrer noopener" className="font-mono text-xs text-slate hover:text-violet-deep">
                {host} ↗
              </a>
            )}
          </div>
        </div>
        <WorkflowTabs projectId={id} hasBrand={!!project.brand_profile_id} />
      </div>
      {children}
    </div>
  );
}
