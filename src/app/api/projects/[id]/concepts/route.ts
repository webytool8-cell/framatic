import { after, NextResponse } from "next/server";
import { handleRouteError, jsonError, routeUser } from "@/lib/api";
import { isLLMConfigured } from "@/lib/ai/llm";
import { getProject, setProjectStatus } from "@/lib/db/repo";
import { runGenerate } from "@/lib/jobs/autopilot";
import { reserveCredits } from "@/lib/credits";
import { createServiceClient } from "@/lib/supabase/server";
import { effectiveStatus } from "@/lib/types";

export const maxDuration = 300;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, user } = await routeUser();
    if (!user) return jsonError("Please sign in.", 401);
    const project = await getProject(supabase, user.id, id);
    if (!project) return jsonError("Project not found.", 404);
    if (!project.brand_profile_id) return jsonError("Complete the brand profile first.", 400);
    if (!isLLMConfigured()) return jsonError("AI generation isn't configured on this server yet (missing ANTHROPIC_API_KEY).", 503);
    const s = effectiveStatus(project).status;
    if (s === "generating" || s === "analyzing") return jsonError("Another job is already running for this project.", 409);

    const admin = createServiceClient();
    const hold = await reserveCredits(admin, user.id, "generate", { ref: id, idempotencyKey: req.headers.get("idempotency-key") });
    if (!hold.created) return NextResponse.json({ status: "generating" }, { status: 202 });
    await setProjectStatus(admin, user.id, id, "generating", "Developing three creative directions…");
    after(() => runGenerate(admin, user.id, id, hold.reservationId));
    return NextResponse.json({ status: "generating" }, { status: 202 });
  } catch (e) {
    return handleRouteError(e, "generate");
  }
}
