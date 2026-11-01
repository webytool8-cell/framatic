import { after, NextResponse } from "next/server";
import { handleRouteError, jsonError, routeUser } from "@/lib/api";
import { getProject, setProjectStatus } from "@/lib/db/repo";
import { runAutopilot } from "@/lib/jobs/autopilot";
import { consumeRateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/server";
import { effectiveStatus } from "@/lib/types";

export const maxDuration = 300;

/** Analyze the website and go straight on to concepts. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, user } = await routeUser();
    if (!user) return jsonError("Please sign in.", 401);
    const project = await getProject(supabase, user.id, id);
    if (!project) return jsonError("Project not found.", 404);
    if (!project.website_url) return jsonError("Add a website URL to this project first.", 400);
    const s = effectiveStatus(project).status;
    if (s === "analyzing" || s === "generating") return jsonError("This project is already being worked on.", 409);

    const admin = createServiceClient();
    await consumeRateLimit(admin, user.id, "analyze");
    await setProjectStatus(admin, user.id, id, "analyzing", "Queued…");
    after(() => runAutopilot(admin, user.id, id));
    return NextResponse.json({ status: "analyzing" }, { status: 202 });
  } catch (e) {
    return handleRouteError(e, "autopilot");
  }
}
