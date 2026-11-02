import { NextResponse } from "next/server";
import { handleRouteError, jsonError, routeUser } from "@/lib/api";
import { getBrandProfile, getConcept, getProject } from "@/lib/db/repo";
import { log } from "@/lib/log";
import { consumeRateLimit, RateLimitError } from "@/lib/rate-limit";
import { describeRenderError, isRenderConfigured, startLambdaRender } from "@/lib/render/lambda";
import { createServiceClient } from "@/lib/supabase/server";

export const maxDuration = 60;

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "ad";
}

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
    await consumeRateLimit(admin, user.id, "render");
    const plan = concept.scenePlan;
    let started: { renderId: string; bucketName: string };
    try {
      started = await startLambdaRender(
        { plan, logoUrl: brand?.profile.identity.logoUrl ?? null, productName: brand?.profile.product.name.value || project?.name || "" },
        `${slug(concept.content.title)}-${plan.aspectRatio.replace(":", "x")}.mp4`,
      );
    } catch (e) {
      log.error("render start failed", { conceptId: id, error: (e as Error).message });
      return jsonError(describeRenderError(e), 502);
    }
    const { data, error } = await supabase
      .from("renders")
      .insert({
        user_id: user.id,
        project_id: concept.project_id,
        concept_id: id,
        scene_plan_version: concept.current_version,
        aspect_ratio: plan.aspectRatio,
        duration_sec: plan.durationSec,
        render_id: started.renderId,
        bucket_name: started.bucketName,
      })
      .select("id, status, progress, aspect_ratio, duration_sec, scene_plan_version, created_at")
      .single();
    if (error) throw error;
    return NextResponse.json(data, { status: 202 });
  } catch (e) {
    if (e instanceof RateLimitError) return jsonError(e.message, 429);
    return handleRouteError(e, "render start");
  }
}
