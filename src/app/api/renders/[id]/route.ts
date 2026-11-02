import { NextResponse } from "next/server";
import { handleRouteError, jsonError, routeUser } from "@/lib/api";
import { log } from "@/lib/log";
import { describeRenderError, downloadUrl, lambdaRenderStatus } from "@/lib/render/lambda";

export const dynamic = "force-dynamic";

/** Poll a render; refreshes progress from Lambda and returns a short-lived download link when done. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, user } = await routeUser();
    if (!user) return jsonError("Please sign in.", 401);
    const { data: r, error } = await supabase.from("renders").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
    if (error) throw error;
    if (!r) return jsonError("Render not found.", 404);

    let row = r;
    if (r.status === "rendering" && r.render_id && r.bucket_name) {
      try {
        const s = await lambdaRenderStatus(r.render_id, r.bucket_name);
        const update = {
          progress: s.done ? 1 : s.progress,
          status: s.failed ? "failed" : s.done ? "done" : "rendering",
          out_key: s.outKey,
          out_size_bytes: s.sizeBytes,
          cost_usd: s.costUsd,
          error: s.error,
        };
        const stale = !s.done && !s.failed && Date.now() - new Date(r.created_at).getTime() > 15 * 60_000;
        if (stale) Object.assign(update, { status: "failed", error: "The render timed out. Please try again." });
        const { data: updated } = await supabase.from("renders").update(update).eq("id", id).eq("user_id", user.id).select("*").single();
        if (updated) row = updated;
      } catch (e) {
        log.warn("render progress failed", { id, error: (e as Error).message });
        return NextResponse.json({ ...publicRow(r), error: describeRenderError(e) });
      }
    }
    const url = row.status === "done" && row.bucket_name && row.out_key ? await downloadUrl(row.bucket_name, row.out_key) : null;
    return NextResponse.json({ ...publicRow(row), downloadUrl: url }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return handleRouteError(e, "render status");
  }
}

function publicRow(r: Record<string, unknown>) {
  const { id, status, progress, aspect_ratio, duration_sec, scene_plan_version, out_size_bytes, error, created_at } = r;
  return { id, status, progress, aspect_ratio, duration_sec, scene_plan_version, out_size_bytes, error, created_at };
}
