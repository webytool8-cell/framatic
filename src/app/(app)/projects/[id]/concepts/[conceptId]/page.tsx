import { getCreditCosts } from "@/lib/billing-config";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConceptWorkspace } from "@/components/app/concept-workspace";
import { isLLMConfigured } from "@/lib/ai/llm";
import { isRenderConfigured } from "@/lib/render/cloudrun";
import type { RenderItem } from "@/components/app/export-panel";
import { getBrandProfile, getConcept, getProject, listSceneVersions } from "@/lib/db/repo";
import { requireUser } from "@/lib/supabase/server";
import { listPhotos } from "@/lib/photos/library";

export const metadata = { title: "Concept" };

export default async function ConceptPage({ params }: { params: Promise<{ id: string; conceptId: string }> }) {
  const { id, conceptId } = await params;
  const { supabase, user } = await requireUser();
  const concept = await getConcept(supabase, user.id, conceptId);
  if (!concept || concept.project_id !== id || !concept.scenePlan) notFound();
  const project = await getProject(supabase, user.id, id);
  const { data: renderRows } = await supabase
    .from("renders")
    .select("id, status, progress, aspect_ratio, duration_sec, scene_plan_version, out_size_bytes, error, created_at")
    .eq("concept_id", conceptId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(6);
  const [brand, versions, photos] = await Promise.all([
    project?.brand_profile_id ? getBrandProfile(supabase, user.id, project.brand_profile_id) : null,
    listSceneVersions(supabase, user.id, conceptId),
    listPhotos(supabase, user.id, id).catch(() => []),
  ]);

  return (
    <div>
      <Link href={`/projects/${id}`} className="mb-4 inline-block text-sm font-semibold text-slate hover:text-ink">← All concepts</Link>
      <ConceptWorkspace
        key={`${concept.id}-${concept.current_version}-${concept.updated_at}`}
        concept={{
          id: concept.id,
          kind: concept.kind,
          content: concept.content,
          preferences: concept.preferences,
          editedFields: concept.edited_fields,
          isPreferred: concept.is_preferred,
          version: concept.current_version,
          plan: concept.scenePlan,
        }}
        versions={versions}
        photos={photos}
        creditCosts={await getCreditCosts(supabase)}
        logoUrl={brand?.profile.identity.logoUrl ?? null}
        productName={brand?.profile.product.name.value || project?.name}
        aiReady={isLLMConfigured()}
        renderReady={isRenderConfigured()}
        renders={(renderRows ?? []) as RenderItem[]}
      />
    </div>
  );
}
