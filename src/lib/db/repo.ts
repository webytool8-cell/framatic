import type { SupabaseClient } from "@supabase/supabase-js";
import { BrandProfileSchema, type BrandProfile } from "@/lib/brand/schema";
import { ConceptContent, CreativePreferences, type ConceptKind } from "@/lib/creative/concept";
import { ScenePlan } from "@/lib/creative/scene-plan";
import type { ProjectRow, ProjectStatus } from "@/lib/types";

/**
 * Data access. Functions accept either the user-scoped client (RLS enforced)
 * or the service client; every query is additionally scoped by user_id so the
 * service client can never cross users.
 */

export async function getProject(db: SupabaseClient, userId: string, projectId: string): Promise<ProjectRow | null> {
  const { data, error } = await db.from("projects").select("*").eq("id", projectId).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data as ProjectRow | null;
}

export async function setProjectStatus(
  db: SupabaseClient,
  userId: string,
  projectId: string,
  status: ProjectStatus,
  message: string | null = null,
  extra: Record<string, unknown> = {},
) {
  const { error } = await db
    .from("projects")
    .update({ status, status_message: message, status_updated_at: new Date().toISOString(), ...extra })
    .eq("id", projectId)
    .eq("user_id", userId);
  if (error) throw error;
}

export interface BrandProfileRecord {
  id: string;
  name: string;
  source_url: string | null;
  profile: BrandProfile;
  updated_at: string;
}

export async function getBrandProfile(db: SupabaseClient, userId: string, id: string): Promise<BrandProfileRecord | null> {
  const { data, error } = await db.from("brand_profiles").select("id, name, source_url, profile, updated_at").eq("id", id).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const parsed = BrandProfileSchema.safeParse(data.profile);
  if (!parsed.success) throw new Error(`Stored brand profile ${id} failed validation`);
  return { ...data, profile: parsed.data } as BrandProfileRecord;
}

export async function listBrandProfiles(db: SupabaseClient, userId: string) {
  const { data, error } = await db.from("brand_profiles").select("id, name, source_url, updated_at").eq("user_id", userId).order("updated_at", { ascending: false }).limit(50);
  if (error) throw error;
  return data ?? [];
}

export interface ConceptRecord {
  id: string;
  project_id: string;
  kind: ConceptKind;
  slot: "A" | "B" | "C";
  content: ConceptContent;
  preferences: CreativePreferences;
  edited_fields: string[];
  is_preferred: boolean;
  current_version: number;
  status: "ready" | "regenerating" | "failed";
  status_message: string | null;
  updated_at: string;
  scenePlan: ScenePlan | null;
}

export async function listConcepts(db: SupabaseClient, userId: string, projectId: string): Promise<ConceptRecord[]> {
  const { data, error } = await db.from("creative_concepts").select("*").eq("project_id", projectId).eq("user_id", userId).order("slot");
  if (error) throw error;
  const rows = data ?? [];
  if (!rows.length) return [];
  const plans = await db
    .from("scene_plans")
    .select("concept_id, version, plan")
    .eq("user_id", userId)
    .in(
      "concept_id",
      rows.map((r) => r.id),
    );
  if (plans.error) throw plans.error;
  return rows.map((r) => {
    const plan = plans.data?.find((p) => p.concept_id === r.id && p.version === r.current_version);
    const parsedPlan = plan ? ScenePlan.safeParse(plan.plan) : null;
    return {
      ...r,
      content: ConceptContent.parse(r.content),
      preferences: CreativePreferences.parse(r.preferences ?? {}),
      scenePlan: parsedPlan?.success ? parsedPlan.data : null,
    } as ConceptRecord;
  });
}

export async function getConcept(db: SupabaseClient, userId: string, conceptId: string): Promise<ConceptRecord | null> {
  const { data, error } = await db.from("creative_concepts").select("project_id").eq("id", conceptId).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return (await listConcepts(db, userId, data.project_id)).find((c) => c.id === conceptId) ?? null;
}

export async function listSceneVersions(db: SupabaseClient, userId: string, conceptId: string) {
  const { data, error } = await db
    .from("scene_plans")
    .select("version, source, created_at")
    .eq("concept_id", conceptId)
    .eq("user_id", userId)
    .order("version", { ascending: false })
    .limit(20);
  if (error) throw error;
  return data ?? [];
}

/** Save content and (optionally) a new scene-plan version atomically enough for Phase 1. */
export async function saveConceptVersion(
  db: SupabaseClient,
  userId: string,
  concept: { id: string; project_id: string; current_version: number },
  update: {
    content: ConceptContent;
    editedFields: string[];
    scenePlan?: ScenePlan;
    source?: "ai" | "ai_partial" | "user";
    preferences?: CreativePreferences;
  },
): Promise<number> {
  let version = concept.current_version;
  if (update.scenePlan) {
    version = concept.current_version + 1;
    const { error } = await db.from("scene_plans").insert({
      concept_id: concept.id,
      project_id: concept.project_id,
      user_id: userId,
      version,
      schema_version: update.scenePlan.schemaVersion,
      source: update.source ?? "user",
      plan: ScenePlan.parse(update.scenePlan),
    });
    if (error) throw error;
  }
  const { error } = await db
    .from("creative_concepts")
    .update({
      content: ConceptContent.parse(update.content),
      edited_fields: update.editedFields,
      current_version: version,
      status: "ready",
      status_message: null,
      ...(update.preferences ? { preferences: update.preferences } : {}),
    })
    .eq("id", concept.id)
    .eq("user_id", userId);
  if (error) throw error;
  return version;
}
