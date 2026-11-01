export const PROJECT_STATUSES = [
  "draft",
  "analyzing",
  "analyzed",
  "analysis_failed",
  "generating",
  "concepts_ready",
  "generation_failed",
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export interface ProjectRow {
  id: string;
  user_id: string;
  name: string;
  website_url: string | null;
  status: ProjectStatus;
  status_message: string | null;
  status_updated_at: string;
  creative_preferences: Record<string, unknown>;
  analysis_warnings: string[];
  brand_profile_id: string | null;
  analyzed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnalyzedPageRow {
  id: string;
  project_id: string;
  url: string;
  page_type: string;
  title: string | null;
  description: string | null;
  headings: string[];
  text_excerpt: string | null;
  ctas: string[];
  fetched_via: "http" | "browser";
  http_status: number | null;
  created_at: string;
}

export interface AssetRow {
  id: string;
  project_id: string;
  kind: "logo" | "image" | "og_image" | "favicon" | "uploaded_logo";
  url: string | null;
  storage_path: string | null;
  alt: string | null;
  source_page_url: string | null;
  created_at: string;
}

/** Jobs that stop updating for this long are treated as failed so users can retry. */
export const STALE_JOB_MS = 10 * 60_000;

export function effectiveStatus(p: Pick<ProjectRow, "status" | "status_message"> & { status_updated_at?: string | null }): {
  status: ProjectStatus;
  message: string | null;
} {
  if ((p.status === "analyzing" || p.status === "generating") && p.status_updated_at) {
    if (Date.now() - new Date(p.status_updated_at).getTime() > STALE_JOB_MS) {
      return {
        status: p.status === "analyzing" ? "analysis_failed" : "generation_failed",
        message: "This job stopped responding. Please try again.",
      };
    }
  }
  return { status: p.status, message: p.status_message };
}
