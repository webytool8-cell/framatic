import "server-only";
import { GoogleAuth } from "google-auth-library";
import type { AdVideoProps } from "@/video/AdVideo";

/**
 * MP4 export on Google Cloud Run Jobs. Each export starts one job execution
 * (image built from renderer/Dockerfile) that renders with Remotion, uploads
 * the MP4 to Supabase Storage and updates the renders row itself.
 */
export const RENDER_BUCKET = "renders";

export class RenderNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RenderNotConfiguredError";
  }
}

function settings() {
  return {
    project: process.env.GCP_PROJECT_ID,
    region: process.env.GCP_REGION || "us-central1",
    job: process.env.FRAMATIC_RENDER_JOB || "framatic-renderer",
    key: process.env.GCP_SERVICE_ACCOUNT_KEY,
  };
}

export function isRenderConfigured(): boolean {
  const s = settings();
  return !!s.project && !!s.key;
}

export { parseServiceAccountKey } from "@/lib/gcp-key";
import { parseServiceAccountKey } from "@/lib/gcp-key";

export interface RenderPayload {
  renderId: string;
  userId: string;
  fileName: string;
  props: AdVideoProps;
}

/** The job execution request body (exported for tests). */
export function buildRunRequest(payload: RenderPayload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64");
  return { overrides: { containerOverrides: [{ env: [{ name: "RENDER_PAYLOAD", value: encoded }] }], taskCount: 1 } };
}

/** Start one Cloud Run Job execution for this render. Returns the execution name. */
export async function startCloudRunRender(payload: RenderPayload): Promise<string | null> {
  const s = settings();
  if (!s.project || !s.key) throw new RenderNotConfiguredError("Video export isn't set up yet: add the GCP_* settings in Vercel.");
  const auth = new GoogleAuth({ credentials: parseServiceAccountKey(s.key), scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  const client = await auth.getClient();
  const res = await client.request<{ metadata?: { name?: string }; name?: string }>({
    url: `https://run.googleapis.com/v2/projects/${s.project}/locations/${s.region}/jobs/${s.job}:run`,
    method: "POST",
    data: buildRunRequest(payload),
    timeout: 20_000,
  });
  return res.data?.metadata?.name ?? res.data?.name ?? null;
}

/** Friendly text for Google Cloud failures. */
export function describeRenderError(e: unknown): string {
  const err = e as { name?: string; message?: string; status?: number; response?: { status?: number } };
  if (err?.name === "RenderNotConfiguredError") return err.message ?? "Video export isn't set up yet.";
  const status = err?.response?.status ?? err?.status;
  const m = err?.message ?? "";
  const s = settings();
  if (status === 404 || /not found/i.test(m)) return `The render job "${s.job}" wasn't found in ${s.region}. Run the "Deploy video renderer" action on GitHub first.`;
  if (status === 403 || /permission|denied/i.test(m)) return "The Google Cloud service account can't start the render job. Give it the Cloud Run Developer role (see docs/gcp/SETUP.md).";
  if (status === 401 || /invalid_grant|invalid jwt|unauthorized/i.test(m)) return "Google Cloud rejected the service-account key. Re-paste GCP_SERVICE_ACCOUNT_KEY in Vercel.";
  if (status === 429) return "Google Cloud is busy. Try again in a minute.";
  return "We couldn't start the export. Please try again.";
}
