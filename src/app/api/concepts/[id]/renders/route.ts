import { NextResponse } from "next/server";
import { handleRouteError, jsonError, routeUser } from "@/lib/api";
import { getBrandProfile, getConcept, getProject } from "@/lib/db/repo";
import { log } from "@/lib/log";
import { reserveCredits, settleOperation } from "@/lib/credits";
import { recordRenderCosts } from "@/lib/metering";
import { OperationInProgressError } from "@/lib/rate-limit";
import { describeRenderError, isRenderConfigured, startCloudRunRender } from "@/lib/render/cloudrun";
import { createServiceClient } from "@/lib/supabase/server";

export const maxDuration = 60;

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "ad";
}

const COLUMNS = "id, status, progress, aspect_ratio, duration_sec, scene_plan_version, out_size_bytes, error, created_at";

/** Start an MP4 export of the concept's saved scene plan. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
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
    // One export of a given saved version at a time; a repeated click reuses the hold.
    const hold = await reserveCredits(admin, user.id, "render", { ref: `${id}:v${concept.current_version}`, idempotencyKey: req.headers.get("idempotency-key") });
    if (!hold.created) throw new OperationInProgressError("render");
    const plan = concept.scenePlan;
    const fileName = `${slug(concept.content.title)}-${plan.aspectRatio.replace(":", "x")}.mp4`;
    const { data: row, error } = await supabase
      .from("renders")
      .insert({ user_id: user.id, project_id: concept.project_id, concept_id: id, scene_plan_version: concept.current_version, aspect_ratio: plan.aspectRatio, duration_sec: plan.durationSec, file_name: fileName, operation_id: hold.reservationId })
      .select(COLUMNS)
      .single();
    if (error) {
      await settleOperation(admin, hold.reservationId, "render", { kind: "failed" }, { conceptId: id });
      throw error;
    }

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
      const settled = await settleOperation(admin, hold.reservationId, "render", { kind: "failed" }, { renderId: row.id });
      if (!settled.alreadySettled) await recordRenderCosts(admin, { userId: user.id, operationId: hold.reservationId, renderId: row.id, seconds: 0, sizeBytes: null, done: false });
      return jsonError(message, 502);
    }
    return NextResponse.json(row, { status: 202 });
  } catch (e) {
    return handleRouteError(e, "render start");
  }
}
