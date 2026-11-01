import { redirect } from "next/navigation";
import { BrandEditor } from "@/components/app/brand-editor";
import { JobRunner } from "@/components/app/job-runner";
import { isLLMConfigured } from "@/lib/ai/llm";
import { getBrandProfile, getProject } from "@/lib/db/repo";
import { requireUser } from "@/lib/supabase/server";
import { effectiveStatus, type AnalyzedPageRow } from "@/lib/types";

export const metadata = { title: "Brand" };

export default async function BrandPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const project = (await getProject(supabase, user.id, id))!;
  if (!project.brand_profile_id) redirect(`/projects/${id}`);
  const brand = await getBrandProfile(supabase, user.id, project.brand_profile_id);
  if (!brand) redirect(`/projects/${id}`);
  const [{ count }, { data: pages }] = await Promise.all([
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("brand_profile_id", brand.id),
    supabase.from("analyzed_pages").select("id, url, title, page_type").eq("project_id", id).order("created_at"),
  ]);
  const pageRows = (pages ?? []) as Pick<AnalyzedPageRow, "id" | "url" | "title" | "page_type">[];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-heading text-lg">Your brand, as we read it</h2>
          <p className="max-w-2xl text-sm text-slate">Fix anything that&apos;s off and star the features you want the ads to lead with. Then update your ads.</p>
        </div>
        {(count ?? 0) > 1 && <p className="rounded-full border border-yellow bg-butter px-3 py-1 text-xs font-semibold text-yellow-deep">Shared by {count} projects</p>}
      </div>
      <BrandEditor key={brand.updated_at} projectId={id} initial={brand.profile} aiReady={isLLMConfigured()} />
      {pageRows.length > 0 && (
        <details className="-mt-20 mb-28 text-sm">
          <summary className="cursor-pointer select-none text-slate hover:text-ink">What we read ({pageRows.length} page{pageRows.length === 1 ? "" : "s"})</summary>
          <ul className="mt-3 space-y-1.5">
            {pageRows.map((p) => (
              <li key={p.id} className="flex gap-3">
                <span className="w-20 shrink-0 text-slate">{p.page_type}</span>
                <a href={p.url} target="_blank" rel="noreferrer noopener" className="truncate hover:text-violet-deep">{p.title || p.url}</a>
              </li>
            ))}
          </ul>
          {project.website_url && (
            <div className="mt-4 max-w-sm">
              <JobRunner projectId={id} kind="autopilot" status={effectiveStatus(project).status} label="Read the website again" variant="secondary" />
              <p className="mt-2 text-xs text-slate">Keeps everything you&apos;ve edited, then refreshes the ads.</p>
            </div>
          )}
        </details>
      )}
    </div>
  );
}
