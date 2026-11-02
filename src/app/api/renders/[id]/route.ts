import { NextResponse } from "next/server";
import { handleRouteError, jsonError, routeUser } from "@/lib/api";
import { RENDER_BUCKET } from "@/lib/render/cloudrun";
import { refundLatestCharge } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const STALE_MS = 20 * 60_000;

/**
 * Poll a render. The render job writes progress to the row itself; this
 * returns it plus a short-lived signed download link when the MP4 is ready.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, user } = await routeUser();
    if (!user) return jsonError("Please sign in.", 401);
    const { data: r, error } = await supabase.from("renders").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
    if (error) throw error;
    if (!r) return jsonError("Render not found.", 404);

    let row = r;
    if (r.status === "rendering" && Date.now() - new Date(r.updated_at).getTime() > STALE_MS) {
      const { data } = await supabase.from("renders").update({ status: "failed", error: "The render stopped responding. Please try again." }).eq("id", id).eq("user_id", user.id).select("*").single();
      if (data) row = data;
    }

    // A failed export gives its credit back (once: refunds are idempotent per charge).
    if (row.status === "failed") await refundLatestCharge(createServiceClient(), user.id, `render:${id}`, "render failed");

    let downloadUrl: string | null = null;
    if (row.status === "done" && row.out_key) {
      const { data } = await supabase.storage.from(RENDER_BUCKET).createSignedUrl(row.out_key, 60 * 60, { download: row.file_name || true });
      downloadUrl = data?.signedUrl ?? null;
    }
    const { status, progress, aspect_ratio, duration_sec, scene_plan_version, out_size_bytes, error: err, created_at } = row;
    return NextResponse.json(
      { id, status, progress, aspect_ratio, duration_sec, scene_plan_version, out_size_bytes, error: err, created_at, downloadUrl },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    return handleRouteError(e, "render status");
  }
}
