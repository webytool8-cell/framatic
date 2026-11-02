import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/form";
import { Arc, Circle } from "@/components/ui/shapes";
import { BrandStrip, BrandSummary } from "@/components/app/brand-summary";
import { ConceptCard } from "@/components/app/concept-card";
import { JobRunner } from "@/components/app/job-runner";
import { ManualFallbackButton } from "@/components/app/manual-fallback";
import { isLLMConfigured } from "@/lib/ai/llm";
import { getBrandProfile, getProject, listConcepts } from "@/lib/db/repo";
import { requireUser } from "@/lib/supabase/server";
import { effectiveStatus } from "@/lib/types";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const project = (await getProject(supabase, user.id, id))!;
  const { status, message } = effectiveStatus(project);
  const aiReady = isLLMConfigured();

  // 1. Working on it
  if (status === "analyzing" || status === "generating" || (status === "draft" && project.website_url)) {
    return (
      <div className="mx-auto max-w-2xl">
        <JobRunner projectId={id} kind="autopilot" status={status} message={message} label="Make my ad concepts" />
      </div>
    );
  }

  // 2. Couldn't read the site
  if (status === "analysis_failed" || (status === "draft" && !project.website_url)) {
    return (
      <Card accent="coral" className="relative mx-auto max-w-2xl overflow-hidden p-8">
        <Arc aria-hidden className="absolute -right-6 -top-2 h-16 w-32" color="#FFF0E8" stroke={18} />
        <h2 className="text-heading mb-3 text-2xl">We couldn&apos;t read this website</h2>
        <p className="mb-6 text-slate">{message ?? "Something went wrong."}</p>
        <div className="flex flex-wrap gap-3">
          {project.website_url && <JobRunner projectId={id} kind="autopilot" status={status} label="Try again" />}
          <ManualFallbackButton projectId={id} label="Describe the brand myself" />
        </div>
      </Card>
    );
  }

  const [concepts, brand] = await Promise.all([
    listConcepts(supabase, user.id, id),
    project.brand_profile_id ? getBrandProfile(supabase, user.id, project.brand_profile_id) : null,
  ]);
  const warnings = (project.analysis_warnings ?? []) as string[];

  // 3. Brand ready, no concepts yet (AI not configured, or generation failed)
  if (concepts.length === 0) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card accent="violet" className="relative overflow-hidden p-8 sm:p-10">
          <Circle aria-hidden className="absolute -right-10 -top-10 h-32 w-32" color="#F0EBFF" />
          <h2 className="text-heading relative mb-3 text-3xl">Your brand is ready</h2>
          <p className="relative mb-6 max-w-lg text-slate">Next, we&apos;ll write three different ad concepts with full storyboards.</p>
          {status === "generation_failed" && message && <Alert className="relative mb-4">{message}</Alert>}
          {aiReady ? (
            <div className="relative"><JobRunner projectId={id} kind="generate" status={status} label="Write my ad concepts" /></div>
          ) : (
            <Alert tone="info" className="relative">AI writing isn&apos;t switched on for this server yet (missing <code className="font-mono">ANTHROPIC_API_KEY</code>). Your brand profile is saved and editable.</Alert>
          )}
        </Card>
        {brand && <BrandSummary projectId={id} profile={brand.profile} />}
      </div>
    );
  }

  // 4. Results
  return (
    <div className="space-y-8">
      {brand && <BrandStrip projectId={id} profile={brand.profile} />}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-heading text-lg">3 concepts</h2>
          <p className="text-sm text-slate">Open one to tweak it. Frames are storyboard sketches, not rendered video.</p>
        </div>
        {aiReady && <JobRunner projectId={id} kind="generate" status={status} label="Try three new ones" variant="secondary" />}
      </div>
      {message && <Alert tone={status === "generation_failed" ? "error" : "warning"}>{message}</Alert>}
      {warnings.length > 0 && (
        <Alert tone="warning">
          <ul className="list-disc space-y-1 pl-4">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </Alert>
      )}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {concepts.map((c) => (
          <ConceptCard
            key={c.id}
            href={`/projects/${id}/concepts/${c.id}`}
            kind={c.kind}
            content={c.content}
            plan={c.scenePlan}
            preferred={c.is_preferred}
            edited={c.edited_fields.length}
            logoUrl={brand?.profile.identity.logoUrl}
          />
        ))}
      </div>
      <p className="text-xs text-slate">“Try three new ones” keeps any lines you&apos;ve edited yourself.</p>
    </div>
  );
}
