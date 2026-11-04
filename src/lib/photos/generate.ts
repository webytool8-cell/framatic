import { GoogleAuth } from "google-auth-library";
import { parseServiceAccountKey } from "@/lib/gcp-key";
import { log } from "@/lib/log";

/**
 * AI photos through Google Cloud Vertex AI (Gemini image models), using the
 * same project and service account as video rendering. The service account
 * needs the "Vertex AI User" role and the Vertex AI API enabled.
 */
export function imageModel(): string {
  return process.env.FRAMATIC_IMAGE_MODEL || "gemini-2.5-flash-image";
}

export function isImageGenConfigured(): boolean {
  return process.env.FRAMATIC_AI_PHOTOS !== "off" && !!process.env.GCP_PROJECT_ID && !!process.env.GCP_SERVICE_ACCOUNT_KEY;
}

export function aiPhotosPerConcept(): number {
  const n = Number(process.env.FRAMATIC_AI_PHOTOS_PER_CONCEPT ?? 1);
  return Number.isFinite(n) ? Math.max(0, Math.min(3, Math.floor(n))) : 1;
}

const RATIOS = new Set(["1:1", "9:16", "16:9", "4:5", "3:4", "4:3"]);

/**
 * The prompt actually sent. Generated photos set the scene (place, mood, light,
 * hands, ingredients) rather than depicting the customer's own product, so an
 * ad never shows a made-up version of something the shop really sells.
 */
export function buildImagePrompt(scene: string, brand: { category?: string; colors: string[]; tone?: string }): string {
  return [
    `Photorealistic lifestyle photo for a short social video ad${brand.category ? ` in the ${brand.category} category` : ""}: ${scene}.`,
    "Natural light, shallow depth of field, clean modern composition with empty space for overlaid text.",
    brand.colors.length ? `Color mood that fits these brand colors: ${brand.colors.slice(0, 3).join(", ")}.` : "",
    brand.tone ? `Feel: ${brand.tone}.` : "",
    "Do not show any specific branded product, packaging or logo. No text, no letters, no watermarks.",
  ]
    .filter(Boolean)
    .join(" ");
}

export type GeneratedImage = { bytes: Uint8Array; contentType: string; model: string };

/** Generate one image. Returns null (and logs why) instead of throwing. */
export async function generateImage(prompt: string, aspectRatio: string): Promise<GeneratedImage | null> {
  if (!isImageGenConfigured()) return null;
  const project = process.env.GCP_PROJECT_ID!;
  const location = process.env.FRAMATIC_IMAGE_LOCATION || "global";
  const model = imageModel();
  const host = location === "global" ? "aiplatform.googleapis.com" : `${location}-aiplatform.googleapis.com`;
  try {
    const auth = new GoogleAuth({ credentials: parseServiceAccountKey(process.env.GCP_SERVICE_ACCOUNT_KEY!), scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
    const client = await auth.getClient();
    const res = await client.request<{ candidates?: { content?: { parts?: { inlineData?: { mimeType?: string; data?: string } }[] } }[] }>({
      url: `https://${host}/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:generateContent`,
      method: "POST",
      timeout: 60_000,
      data: {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: RATIOS.has(aspectRatio) ? aspectRatio : "1:1" } },
      },
    });
    const part = res.data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
    if (!part?.inlineData?.data) {
      log.warn("image model returned no image", { model });
      return null;
    }
    return { bytes: Uint8Array.from(Buffer.from(part.inlineData.data, "base64")), contentType: part.inlineData.mimeType || "image/png", model };
  } catch (e) {
    const err = e as { response?: { status?: number; data?: { error?: { message?: string } } }; message?: string };
    log.warn("image generation failed", { model, status: err.response?.status, error: err.response?.data?.error?.message ?? err.message });
    return null;
  }
}
