import { NextResponse } from "next/server";
import { handleRouteError, jsonError, routeUser } from "@/lib/api";
import { getBrandProfile, getConcept, getProject } from "@/lib/db/repo";
import { log } from "@/lib/log";
import { RateLimitError, chargeCredits, refundLatestCharge, setChargeRef } from "@/lib/rate-limit";
import { describeRenderError, isRenderConfigured, startCloudRunRender } from "@/lib/render/cloudrun";
import { createServiceClient } from "@/lib/supabase/server";

export const maxDuration = 60;

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "ad";
}

const COLUMNS = "id, status, progress, aspect_ratio, duration_sec, scene_plan_version, out_size_bytes, error, created_at";

/** Start an MP4 export of the concept's saved scene plan. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, user } = await routeUser();
    if (!user) return jsonError("Please sign in.", 401);
    if (!isRenderConfigured()) return jsonError("Video export isn't set up on this server yet.", 503);
    const concept = await getConcept(supabase, user.id, id);
    if (!concept?.scenePlan) return jsonError("Concept not found.", 404);
    const project = await getProject(supabase, user.id, concept.project_id);
    const brand = project?.brand_profile_id ? await getBrandProfile(supabase, user.id, project.brand_profile_id) : null;

    const admin = createServiceClient();
    const chargeId = await chargeCredits(admin, user.id, "render", id);
    const plan = concept.scenePlan;
    const fileName = `${slug(concept.content.title)}-${plan.aspectRatio.replace(":", "x")}.mp4`;
    const { data: row, error } = await supabase
      .from("renders")
      .insert({ user_id: user.id, project_id: concept.project_id, concept_id: id, scene_plan_version: concept.current_version, aspect_ratio: plan.aspectRatio, duration_sec: plan.durationSec, file_name: fileName })
      .select(COLUMNS)
      .single();
    if (error) {
      await refundLatestCharge(admin, user.id, id, "render row insert failed");
      throw error;
    }
    if (chargeId !== null) await setChargeRef(admin, chargeId, `render:${row.id}`);

    try {
      const execution = await startCloudRunRender({
        renderId: row.id,
        userId: user.id,
        fileName,
        props: { plan, logoUrl: brand?.profile.identity.logoUrl ?? null, productName: brand?.profile.product.name.value || project?.name || "" },
      });
      if (execution) await supabase.from("renders").update({ execution }).eq("id", row.id).eq("user_id", user.id);
    } catch (e) {
      log.error("render start failed", { conceptId: id, error: (e as Error).message });
      const message = describeRenderError(e);
      await supabase.from("renders").update({ status: "failed", error: message }).eq("id", row.id).eq("user_id", user.id);
      await refundLatestCharge(admin, user.id, `render:${row.id}`, "render start failed");
      return jsonError(message, 502);
    }
    return NextResponse.json(row, { status: 202 });
  } catch (e) {
    if (e instanceof RateLimitError) return jsonError(e.message, 429);
    return handleRouteError(e, "render start");
  }
}
