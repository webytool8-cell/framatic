"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { normalizeUserUrl, UnsafeUrlError } from "@/lib/analyzer/url-safety";
import { blankBrandProfile } from "@/lib/brand/schema";
import { getBrandProfile, getProject } from "@/lib/db/repo";
import type { FormState } from "./auth";

const Name = z.string().trim().min(1, "Give your project a name.").max(120);

export async function createProject(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, user } = await requireUser();
  const mode = form.get("mode") === "manual" ? "manual" : "url";
  const reuse = typeof form.get("reuse_brand") === "string" ? String(form.get("reuse_brand")) : "";

  let url: string | null = null;
  if (mode === "url") {
    try {
      url = normalizeUserUrl(String(form.get("url") ?? "")).toString();
    } catch (e) {
      return { error: e instanceof UnsafeUrlError ? e.message : "Enter a valid website URL." };
    }
  }
  const rawName = String(form.get("name") ?? "").trim() || (url ? new URL(url).hostname.replace(/^www\./, "") : "");
  const name = Name.safeParse(rawName);
  if (!name.success) return { error: name.error.issues[0].message };

  let brandId: string | null = null;
  if (reuse) {
    const existing = await getBrandProfile(supabase, user.id, reuse);
    if (!existing) return { error: "That saved brand profile wasn't found." };
    brandId = existing.id;
  } else if (mode === "manual") {
    const { data, error } = await supabase
      .from("brand_profiles")
      .insert({ user_id: user.id, name: name.data, profile: blankBrandProfile(name.data) })
      .select("id")
      .single();
    if (error) return { error: "Couldn't create the brand profile." };
    brandId = data.id;
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      name: name.data,
      website_url: url,
      brand_profile_id: brandId,
      status: brandId ? "analyzed" : "draft",
    })
    .select("id")
    .single();
  if (error) return { error: "Couldn't create the project. Please try again." };
  revalidatePath("/dashboard");
  redirect(brandId ? `/projects/${data.id}/brand` : `/projects/${data.id}?start=1`);
}

export async function renameProject(projectId: string, name: string): Promise<FormState> {
  const { supabase, user } = await requireUser();
  const parsed = Name.safeParse(name);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { error } = await supabase.from("projects").update({ name: parsed.data }).eq("id", projectId).eq("user_id", user.id);
  if (error) return { error: "Couldn't rename the project." };
  revalidatePath("/dashboard");
  revalidatePath(`/projects/${projectId}`);
  return { message: "Renamed." };
}

export async function deleteProject(projectId: string): Promise<FormState> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("projects").delete().eq("id", projectId).eq("user_id", user.id);
  if (error) return { error: "Couldn't delete the project." };
  revalidatePath("/dashboard");
  return { message: "Deleted." };
}

/** Fallback when automatic analysis fails: start from a blank, user-owned profile. */
export async function startManualBrand(projectId: string) {
  const { supabase, user } = await requireUser();
  const project = await getProject(supabase, user.id, projectId);
  if (!project) redirect("/dashboard");
  if (!project.brand_profile_id) {
    const { data, error } = await supabase
      .from("brand_profiles")
      .insert({ user_id: user.id, name: project.name, source_url: project.website_url, profile: blankBrandProfile(project.name) })
      .select("id")
      .single();
    if (error) throw new Error("Couldn't create the brand profile.");
    await supabase.from("projects").update({ brand_profile_id: data.id, status: "analyzed", status_message: null }).eq("id", projectId).eq("user_id", user.id);
  } else {
    await supabase.from("projects").update({ status: "analyzed", status_message: null }).eq("id", projectId).eq("user_id", user.id);
  }
  redirect(`/projects/${projectId}/brand`);
}

export async function updateWebsiteUrl(projectId: string, input: string): Promise<FormState> {
  const { supabase, user } = await requireUser();
  let url: string;
  try {
    url = normalizeUserUrl(input).toString();
  } catch (e) {
    return { error: e instanceof UnsafeUrlError ? e.message : "Enter a valid website URL." };
  }
  const { error } = await supabase.from("projects").update({ website_url: url }).eq("id", projectId).eq("user_id", user.id);
  if (error) return { error: "Couldn't save the URL." };
  revalidatePath(`/projects/${projectId}`);
  return { message: "Saved." };
}
