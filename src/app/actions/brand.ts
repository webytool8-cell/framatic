"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import { BrandProfileSchema } from "@/lib/brand/schema";
import { getBrandProfile, getProject } from "@/lib/db/repo";
import type { FormState } from "./auth";

export async function saveBrandProfile(projectId: string, profile: unknown): Promise<FormState> {
  const { supabase, user } = await requireUser();
  const project = await getProject(supabase, user.id, projectId);
  if (!project?.brand_profile_id) return { error: "Project not found." };
  const parsed = BrandProfileSchema.safeParse(profile);
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { error: `Please check ${i.path.join(" → ")}: ${i.message}` };
  }
  const { error } = await supabase
    .from("brand_profiles")
    .update({ profile: parsed.data, name: parsed.data.product.name.value || project.name })
    .eq("id", project.brand_profile_id)
    .eq("user_id", user.id);
  if (error) return { error: "Couldn't save the brand profile." };
  revalidatePath(`/projects/${projectId}`, "layout");
  return { message: "Saved" };
}

const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const LOGO_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg" };

export async function uploadLogo(projectId: string, form: FormData): Promise<{ error?: string; url?: string }> {
  const { supabase, user } = await requireUser();
  const project = await getProject(supabase, user.id, projectId);
  if (!project?.brand_profile_id) return { error: "Project not found." };
  const file = form.get("logo");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image file." };
  if (file.size > MAX_LOGO_BYTES) return { error: "Logos must be 5 MB or smaller." };
  const ext = LOGO_TYPES[file.type];
  if (!ext) return { error: "Use a PNG, JPG, WebP or SVG file." };

  const path = `${user.id}/${projectId}/logo-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("brand-assets").upload(path, file, { contentType: file.type, upsert: false });
  if (error) return { error: "Upload failed. Please try again." };
  const { data } = supabase.storage.from("brand-assets").getPublicUrl(path);

  await supabase.from("assets").insert({ project_id: projectId, user_id: user.id, kind: "uploaded_logo", storage_path: path, url: data.publicUrl, alt: "Uploaded logo" });
  const brand = await getBrandProfile(supabase, user.id, project.brand_profile_id);
  if (brand) {
    const profile = { ...brand.profile, identity: { ...brand.profile.identity, logoUrl: data.publicUrl, logoProvenance: "user" as const } };
    await supabase.from("brand_profiles").update({ profile }).eq("id", brand.id).eq("user_id", user.id);
  }
  revalidatePath(`/projects/${projectId}`, "layout");
  return { url: data.publicUrl };
}
