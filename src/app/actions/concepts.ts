"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { ConceptContent, CreativePreferences, EDITABLE_FIELDS } from "@/lib/creative/concept";
import { Scene, ScenePlan, normalizeScenePlan, snapToBeats } from "@/lib/creative/scene-plan";
import { SOUND_SETS, trackById } from "@/video/music";
import { getConcept, saveConceptVersion } from "@/lib/db/repo";
import type { FormState } from "./auth";

const ContentPatch = ConceptContent.pick(Object.fromEntries(EDITABLE_FIELDS.map((f) => [f, true])) as Record<(typeof EDITABLE_FIELDS)[number], true>).partial();

/** Edit concept copy. Edited fields are remembered so regeneration preserves them. */
export async function updateConceptContent(conceptId: string, patch: unknown): Promise<FormState> {
  const { supabase, user } = await requireUser();
  const concept = await getConcept(supabase, user.id, conceptId);
  if (!concept) return { error: "Concept not found." };
  const parsed = ContentPatch.safeParse(patch);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const changed = Object.entries(parsed.data).filter(([k, v]) => JSON.stringify(concept.content[k as keyof typeof concept.content]) !== JSON.stringify(v)).map(([k]) => k);
  if (!changed.length) return { message: "No changes" };
  const content = ConceptContent.parse({ ...concept.content, ...parsed.data });
  const edited = [...new Set([...concept.edited_fields, ...changed])];
  await saveConceptVersion(supabase, user.id, concept, { content, editedFields: edited });
  revalidatePath(`/projects/${concept.project_id}`, "layout");
  return { message: "Saved" };
}

const SceneEdits = z.array(
  z.object({
    id: z.string(),
    headline: Scene.shape.headline,
    supportingText: z.string().max(160),
    durationSec: Scene.shape.durationSec,
  }),
).min(3).max(14);

/** Edit/reorder scenes → a new scene-plan version (source: user). */
export async function updateScenes(conceptId: string, edits: unknown): Promise<FormState> {
  const { supabase, user } = await requireUser();
  const concept = await getConcept(supabase, user.id, conceptId);
  if (!concept?.scenePlan) return { error: "Concept not found." };
  const parsed = SceneEdits.safeParse(edits);
  if (!parsed.success) return { error: `Scene ${parsed.error.issues[0].path.join(".")}: ${parsed.error.issues[0].message}` };
  const byId = new Map(concept.scenePlan.scenes.map((s) => [s.id, s]));
  if (parsed.data.some((e) => !byId.has(e.id)) || parsed.data.length !== byId.size) return { error: "Scenes changed elsewhere — reload and try again." };
  const scenes = parsed.data.map((e) => ({ ...byId.get(e.id)!, headline: e.headline, supportingText: e.supportingText, durationSec: e.durationSec }));
  const plan = ScenePlan.safeParse(normalizeScenePlan({ ...concept.scenePlan, scenes }, concept.content.cta));
  if (!plan.success) return { error: `The scene plan isn't valid: ${plan.error.issues[0].message}` };
  const edited = [...new Set([...concept.edited_fields, "scenes"])];
  await saveConceptVersion(supabase, user.id, concept, {
    content: { ...concept.content, estimatedDurationSec: plan.data.durationSec },
    editedFields: edited,
    scenePlan: plan.data,
    source: "user",
  });
  revalidatePath(`/projects/${concept.project_id}`, "layout");
  return { message: "Saved" };
}

export async function updateConceptPreferences(conceptId: string, prefs: unknown): Promise<FormState> {
  const { supabase, user } = await requireUser();
  const concept = await getConcept(supabase, user.id, conceptId);
  if (!concept) return { error: "Concept not found." };
  const parsed = CreativePreferences.safeParse(prefs);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { error } = await supabase.from("creative_concepts").update({ preferences: parsed.data }).eq("id", conceptId).eq("user_id", user.id);
  if (error) return { error: "Couldn't save preferences." };
  revalidatePath(`/projects/${concept.project_id}`, "layout");
  return { message: "Saved — regenerate to apply." };
}

export async function setPreferredConcept(conceptId: string, preferred: boolean): Promise<FormState> {
  const { supabase, user } = await requireUser();
  const concept = await getConcept(supabase, user.id, conceptId);
  if (!concept) return { error: "Concept not found." };
  if (preferred) {
    await supabase.from("creative_concepts").update({ is_preferred: false }).eq("project_id", concept.project_id).eq("user_id", user.id);
  }
  const { error } = await supabase.from("creative_concepts").update({ is_preferred: preferred }).eq("id", conceptId).eq("user_id", user.id);
  if (error) return { error: "Couldn't save your choice." };
  revalidatePath(`/projects/${concept.project_id}`, "layout");
  revalidatePath("/dashboard");
  return { message: preferred ? "Saved as preferred concept" : "Removed preference" };
}

export async function restoreSceneVersion(conceptId: string, version: number): Promise<FormState> {
  const { supabase, user } = await requireUser();
  const concept = await getConcept(supabase, user.id, conceptId);
  if (!concept) return { error: "Concept not found." };
  const { data } = await supabase.from("scene_plans").select("plan").eq("concept_id", conceptId).eq("user_id", user.id).eq("version", version).maybeSingle();
  const plan = ScenePlan.safeParse(data?.plan);
  if (!plan.success) return { error: "That version couldn't be loaded." };
  await saveConceptVersion(supabase, user.id, concept, {
    content: { ...concept.content, estimatedDurationSec: plan.data.durationSec },
    editedFields: [...new Set([...concept.edited_fields, "scenes"])],
    scenePlan: plan.data,
    source: "user",
  });
  revalidatePath(`/projects/${concept.project_id}`, "layout");
  return { message: `Restored version ${version} as a new version` };
}

/** Change the soundtrack (scenes re-cut on the track's beat), its volume and the transition sound set. */
export async function updateMusic(conceptId: string, trackId: string, volume: number, soundSet?: string): Promise<FormState> {
  const { supabase, user } = await requireUser();
  const concept = await getConcept(supabase, user.id, conceptId);
  if (!concept?.scenePlan) return { error: "Concept not found." };
  const track = trackId === "none" ? null : trackById(trackId);
  if (trackId !== "none" && !track) return { error: "That track isn't available." };
  if (soundSet && soundSet !== "off" && !SOUND_SETS.some((s) => s.id === soundSet)) return { error: "That sound set isn't available." };
  const vol = Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : 0.7));
  const set = soundSet ?? concept.preferences.soundSet ?? concept.scenePlan.music.soundSet ?? track?.soundSet ?? "airy";
  const base = { ...concept.scenePlan, music: { ...concept.scenePlan.music, track: track ? track.id : "none", volume: vol, soundSet: set } };
  const plan = ScenePlan.safeParse(normalizeScenePlan(track ? snapToBeats(base, track.bpm) : base, concept.content.cta));
  if (!plan.success) return { error: "Couldn't apply that track to this concept." };
  await supabase
    .from("creative_concepts")
    .update({ preferences: { ...concept.preferences, musicTrack: track ? track.id : "none", ...(soundSet ? { soundSet } : {}) } })
    .eq("id", conceptId)
    .eq("user_id", user.id);
  await saveConceptVersion(supabase, user.id, { ...concept }, {
    content: { ...concept.content, estimatedDurationSec: plan.data.durationSec },
    editedFields: concept.edited_fields,
    scenePlan: plan.data,
    source: "user",
  });
  revalidatePath(`/projects/${concept.project_id}`, "layout");
  return { message: track ? `Music: ${track.title}` : "Music off" };
}
