import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { safeFetchImage } from "@/lib/analyzer/safe-fetch";
import { getBillingConfig } from "@/lib/billing-config";
import type { BrandProfile } from "@/lib/brand/schema";
import type { Scene, ScenePlan, VisualElement } from "@/lib/creative/scene-plan";
import { recordCost } from "@/lib/metering";
import { log } from "@/lib/log";
import { aiPhotosPerConcept, buildImagePrompt, generateImage, isImageGenConfigured } from "./generate";

/**
 * A project's photo library: images imported from the product page and
 * AI-generated ones, all copied into public storage so the preview and the
 * renderer load them reliably.
 */
export const PHOTO_BUCKET = "brand-assets";
const MIN_BYTES = 12_000; // smaller files are icons, badges and spacers
const SKIP = /(logo|icon|sprite|favicon|badge|payment|flag|avatar|placeholder|spinner|pixel)/i;

export type Photo = { id: string; url: string; kind: "photo" | "ai_photo"; alt: string | null; prompt: string | null };

export async function listPhotos(db: SupabaseClient, userId: string, projectId: string): Promise<Photo[]> {
  const { data } = await db
    .from("assets")
    .select("id, url, kind, alt, prompt")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .in("kind", ["photo", "ai_photo"])
    .order("created_at", { ascending: true });
  return ((data ?? []) as Photo[]).filter((p) => !!p.url);
}

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

async function store(db: SupabaseClient, userId: string, projectId: string, bytes: Uint8Array, contentType: string): Promise<{ path: string; url: string }> {
  const path = `${userId}/${projectId}/photos/${randomUUID()}.${EXT[contentType] ?? "png"}`;
  const { error } = await db.storage.from(PHOTO_BUCKET).upload(path, bytes, { contentType, upsert: false, cacheControl: "31536000" });
  if (error) throw error;
  const { data } = db.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  return { path, url: data.publicUrl };
}

/**
 * Copy the best product-page images into the library (og:image first, then
 * page images), skipping icons and anything tiny. Safe to call repeatedly.
 */
export async function importSitePhotos(db: SupabaseClient, userId: string, projectId: string, max = 6): Promise<Photo[]> {
  if (process.env.FRAMATIC_PHOTO_IMPORT === "off") return listPhotos(db, userId, projectId);
  const existing = await listPhotos(db, userId, projectId);
  if (existing.filter((p) => p.kind === "photo").length >= max) return existing;
  const { data: imported } = await db.from("assets").select("source_url").eq("project_id", projectId).eq("user_id", userId).eq("kind", "photo");
  const done = new Set((imported ?? []).map((r) => r.source_url as string));
  const { data: candidates } = await db
    .from("assets")
    .select("url, kind, alt")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .in("kind", ["og_image", "image"])
    .limit(40);
  const ordered = ((candidates ?? []) as { url: string; kind: string; alt: string | null }[])
    .filter((c) => c.url && !done.has(c.url) && !SKIP.test(c.url) && !/\.svg(\?|$)/i.test(c.url))
    .sort((a, b) => (a.kind === "og_image" ? -1 : 0) - (b.kind === "og_image" ? -1 : 0));
  let added = existing.filter((p) => p.kind === "photo").length;
  for (const c of ordered) {
    if (added >= max) break;
    try {
      const img = await safeFetchImage(new URL(c.url));
      if (img.bytes.byteLength < MIN_BYTES) continue;
      const saved = await store(db, userId, projectId, img.bytes, img.contentType);
      const { error } = await db.from("assets").insert({ project_id: projectId, user_id: userId, kind: "photo", url: saved.url, storage_path: saved.path, alt: c.alt, source_url: c.url });
      if (error) throw error;
      added++;
    } catch (e) {
      log.debug("site photo skipped", { url: c.url, error: (e as Error).message });
    }
  }
  return listPhotos(db, userId, projectId);
}

/** Generate one AI photo into the library, metered against the operation. */
export async function addAiPhoto(
  db: SupabaseClient,
  ctx: { userId: string; projectId: string; operationId?: string | null; brand: BrandProfile; prompt: string; aspectRatio: string },
): Promise<Photo | null> {
  const fullPrompt = buildImagePrompt(ctx.prompt, {
    category: ctx.brand.product.category.value || undefined,
    colors: [ctx.brand.identity.primaryColor, ...ctx.brand.identity.secondaryColors, ...ctx.brand.identity.accentColors].filter(Boolean) as string[],
    tone: ctx.brand.marketing.tone.value || undefined,
  });
  const img = await generateImage(fullPrompt, ctx.aspectRatio);
  if (!img) return null;
  const { prices } = await getBillingConfig(db);
  await recordCost(db, { userId: ctx.userId, operationId: ctx.operationId, operation: null, category: "image", quantity: 1, unit: "image", costUsd: prices.imagePerUnit, detail: { model: img.model } });
  try {
    const saved = await store(db, ctx.userId, ctx.projectId, img.bytes, img.contentType);
    const { data, error } = await db
      .from("assets")
      .insert({ project_id: ctx.projectId, user_id: ctx.userId, kind: "ai_photo", url: saved.url, storage_path: saved.path, alt: ctx.prompt.slice(0, 300), prompt: ctx.prompt.slice(0, 1000) })
      .select("id, url, kind, alt, prompt")
      .single();
    if (error) throw error;
    return data as Photo;
  } catch (e) {
    log.warn("couldn't save AI photo", { error: (e as Error).message });
    return null;
  }
}

const PLACEHOLDER_ELEMENT: VisualElement = { type: "kinetic_text", position: "center" };

/**
 * Give every photo element in a plan a real picture: an unused photo from the
 * project's library first, then (if enabled and within budget) a newly
 * generated one. Photo elements that can't be filled are removed, so a plan
 * never points at an image that doesn't exist. The AI never sets `src` itself.
 */
export async function attachPhotos(
  db: SupabaseClient,
  ctx: { userId: string; projectId: string; operationId?: string | null; brand: BrandProfile; plan: ScenePlan; library?: Photo[]; aiBudget?: number },
): Promise<ScenePlan> {
  const library = ctx.library ?? (await listPhotos(db, ctx.userId, ctx.projectId));
  const known = new Set(library.map((p) => p.url));
  const used = new Set<string>();
  let aiLeft = ctx.aiBudget ?? (isImageGenConfigured() ? aiPhotosPerConcept() : 0);
  const pick = () => library.find((p) => p.kind === "photo" && !used.has(p.url)) ?? library.find((p) => !used.has(p.url));

  const scenes: Scene[] = [];
  for (const scene of ctx.plan.scenes) {
    const elements: VisualElement[] = [];
    for (const el of scene.visualElements) {
      if (el.type !== "photo") {
        elements.push(el);
        continue;
      }
      // Keep a photo that's already from this project's library.
      if (el.src && known.has(el.src)) {
        used.add(el.src);
        elements.push(el);
        continue;
      }
      let photo = pick();
      if (!photo && aiLeft > 0 && el.prompt) {
        aiLeft--;
        photo = (await addAiPhoto(db, { userId: ctx.userId, projectId: ctx.projectId, operationId: ctx.operationId, brand: ctx.brand, prompt: el.prompt, aspectRatio: el.photoStyle === "full" ? ctx.plan.aspectRatio : "4:5" })) ?? undefined;
        if (photo) {
          library.push(photo);
          known.add(photo.url);
        }
      }
      if (photo) {
        used.add(photo.url);
        elements.push({ ...el, src: photo.url, motion: el.motion ?? "ken_burns", photoStyle: el.photoStyle ?? "card" });
      }
    }
    scenes.push({ ...scene, visualElements: elements.length ? elements.slice(0, 5) : [PLACEHOLDER_ELEMENT] });
  }
  return { ...ctx.plan, scenes };
}
