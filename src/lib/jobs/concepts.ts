import type { SupabaseClient } from "@supabase/supabase-js";
import { describeLLMError, getLLM } from "@/lib/ai/llm";
import { dbMeter } from "@/lib/ai/usage";
import { CONCEPT_KINDS, CONCEPT_META, CreativePreferences, REGENERATABLE_FIELDS, mergeConcept, type ConceptKind, type RegeneratableField } from "@/lib/creative/concept";
import { preferencesFromInstruction } from "@/lib/brief";
import { generateConcept } from "@/lib/creative/director";
import { getBrandProfile, getConcept, getProject, listConcepts, saveConceptVersion, setProjectStatus } from "@/lib/db/repo";
import { log } from "@/lib/log";

export async function resolvePreferences(db: SupabaseClient, userId: string, projectPrefs: unknown): Promise<CreativePreferences> {
  const { data } = await db.from("user_preferences").select("*").eq("user_id", userId).maybeSingle();
  const defaults = {
    aspectRatio: data?.default_aspect_ratio ?? "16:9",
    targetDurationSec: data?.default_duration_sec ?? 30,
    pacing: data?.default_pacing ?? undefined,
    tone: data?.brand_voice_notes || undefined,
  };
  return CreativePreferences.parse({ ...defaults, ...((projectPrefs as object) ?? {}) });
}

/**
 * Background job: generate (or refresh) all three concepts.
 * Existing concepts are refreshed with user edits preserved.
 */
export async function generateAllConcepts(db: SupabaseClient, userId: string, projectId: string, operationId?: string): Promise<number> {
  try {
    const project = await getProject(db, userId, projectId);
    if (!project?.brand_profile_id) throw new UserFacingError("Analyze the link or complete the brand profile first.");
    const brand = await getBrandProfile(db, userId, project.brand_profile_id);
    if (!brand) throw new UserFacingError("The brand profile for this project is missing.");
    const prefs = await resolvePreferences(db, userId, project.creative_preferences);
    const existing = await listConcepts(db, userId, projectId);

    const results = await Promise.allSettled(
      CONCEPT_KINDS.map(async (kind) => {
        const current = existing.find((c) => c.kind === kind);
        const conceptPrefs = current ? CreativePreferences.parse({ ...prefs, ...current.preferences }) : prefs;
        const llm = getLLM("creative", dbMeter({ db, userId, projectId, conceptId: current?.id, operationId, step: `concept:${kind}` }));
        const fresh = await generateConcept(llm, {
          kind,
          brand: brand.profile,
          preferences: conceptPrefs,
          existing: current?.scenePlan ? { content: current.content, scenePlan: current.scenePlan } : undefined,
          lockedFields: current?.edited_fields,
          siblings: existing.filter((c) => c.kind !== kind).map((c) => c.content.title),
        });
        if (current && current.scenePlan) {
          const merged = mergeConcept({ content: current.content, scenePlan: current.scenePlan, editedFields: current.edited_fields }, fresh);
          await saveConceptVersion(db, userId, current, { content: merged.content, editedFields: merged.editedFields, scenePlan: merged.scenePlan, source: "ai" });
        } else {
          await insertConcept(db, userId, projectId, kind, fresh, conceptPrefs);
        }
      }),
    );

    const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    failed.forEach((f) => log.error("concept generation failed", { projectId, error: String(f.reason?.message ?? f.reason) }));
    if (failed.length === CONCEPT_KINDS.length) {
      const reason = failed[0].reason;
      throw reason instanceof UserFacingError ? reason : new UserFacingError(friendly(reason));
    }
    await setProjectStatus(
      db,
      userId,
      projectId,
      "concepts_ready",
      failed.length ? `${failed.length} of 3 concepts couldn't be generated (you weren't charged for ${failed.length === 1 ? "it" : "them"}). Use "Regenerate" on the missing concept to try again.` : null,
    );
    return CONCEPT_KINDS.length - failed.length;
  } catch (e) {
    const message = e instanceof UserFacingError ? e.message : friendly(e);
    log.error("generate all failed", { projectId, error: (e as Error).message });
    await setProjectStatus(db, userId, projectId, "generation_failed", message);
    return 0;
  }
}

async function insertConcept(
  db: SupabaseClient,
  userId: string,
  projectId: string,
  kind: ConceptKind,
  fresh: Awaited<ReturnType<typeof generateConcept>>,
  prefs: CreativePreferences,
) {
  const { scenePlan, ...content } = fresh;
  const { data, error } = await db
    .from("creative_concepts")
    .upsert(
      { project_id: projectId, user_id: userId, kind, slot: CONCEPT_META[kind].slot, content, preferences: prefs, current_version: 1, edited_fields: [] },
      { onConflict: "project_id,kind" },
    )
    .select("id")
    .single();
  if (error) throw error;
  const { error: spErr } = await db
    .from("scene_plans")
    .upsert({ concept_id: data.id, project_id: projectId, user_id: userId, version: 1, schema_version: scenePlan.schemaVersion, source: "ai", plan: scenePlan }, { onConflict: "concept_id,version" });
  if (spErr) throw spErr;
}

/**
 * Synchronous single-concept regeneration:
 * - no options → fresh take, user-edited fields preserved
 * - `only` → rewrite just those fields
 * - `instruction` → apply a plain-language change request to the whole concept
 */
export async function regenerateConcept(
  db: SupabaseClient,
  userId: string,
  conceptId: string,
  opts: { only?: RegeneratableField[]; instruction?: string; operationId?: string } = {},
) {
  const instruction = opts.instruction?.trim() || undefined;
  const only = instruction ? undefined : opts.only;
  const concept = await getConcept(db, userId, conceptId);
  if (!concept || !concept.scenePlan) throw new UserFacingError("Concept not found.");
  const project = await getProject(db, userId, concept.project_id);
  const brand = project?.brand_profile_id ? await getBrandProfile(db, userId, project.brand_profile_id) : null;
  if (!brand) throw new UserFacingError("The brand profile for this project is missing.");
  const siblings = (await listConcepts(db, userId, concept.project_id)).filter((c) => c.id !== conceptId).map((c) => c.content.title);

  await db.from("creative_concepts").update({ status: "regenerating" }).eq("id", conceptId).eq("user_id", userId);
  try {
    const hinted = instruction ? preferencesFromInstruction(instruction) : {};
    const prefs = CreativePreferences.parse({ ...(await resolvePreferences(db, userId, project?.creative_preferences)), ...concept.preferences, ...hinted });
    if (Object.keys(hinted).length) {
      await db.from("creative_concepts").update({ preferences: { ...concept.preferences, ...hinted } }).eq("id", conceptId).eq("user_id", userId);
    }
    const step = instruction ? "edit" : only?.length ? "rewrite_fields" : "regenerate";
    const llm = getLLM("creative", dbMeter({ db, userId, projectId: concept.project_id, conceptId, operationId: opts.operationId, step }));
    const fresh = await generateConcept(llm, {
      kind: concept.kind,
      brand: brand.profile,
      preferences: prefs,
      existing: { content: concept.content, scenePlan: concept.scenePlan },
      only,
      instruction,
      lockedFields: instruction ? [] : concept.edited_fields,
      siblings,
    });
    // An explicit change request may touch anything, including fields the user edited.
    const merged = mergeConcept(
      { content: concept.content, scenePlan: concept.scenePlan, editedFields: concept.edited_fields },
      fresh,
      instruction ? [...REGENERATABLE_FIELDS] : only,
    );
    const scenesChanged = merged.changed.includes("scenes");
    await saveConceptVersion(db, userId, concept, {
      content: merged.content,
      editedFields: merged.editedFields,
      scenePlan: scenesChanged ? merged.scenePlan : undefined,
      source: only || instruction ? "ai_partial" : "ai",
    });
    return merged.changed;
  } catch (e) {
    await db.from("creative_concepts").update({ status: "ready", status_message: null }).eq("id", conceptId).eq("user_id", userId);
    throw e instanceof UserFacingError ? e : new UserFacingError(friendly(e));
  }
}

export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}

function friendly(e: unknown): string {
  return describeLLMError(e);
}
