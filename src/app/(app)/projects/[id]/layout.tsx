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

  return (
    <div>
      <div className="mb-8">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <h1 className="text-display text-4xl">{project.name}</h1>
          <StatusPill status={effectiveStatus(project).status} />
        </div>
        {project.website_url && <p className="-mt-3 mb-5 font-mono text-xs text-slate">{project.website_url}</p>}
        <WorkflowTabs projectId={id} hasBrand={!!project.brand_profile_id} />
      </div>
      {children}
    </div>
  );
}
