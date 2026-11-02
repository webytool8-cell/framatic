import { NextResponse } from "next/server";
import { handleRouteError, jsonError, routeUser } from "@/lib/api";
import { getProject } from "@/lib/db/repo";
import { effectiveStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, user } = await routeUser();
    if (!user) return jsonError("Please sign in.", 401);
    const project = await getProject(supabase, user.id, id);
    if (!project) return jsonError("Project not found.", 404);
    // A cheap fingerprint of the concepts, so the page can show each one as soon as it lands.
    const { data: rows } = await supabase.from("creative_concepts").select("current_version").eq("project_id", id).eq("user_id", user.id);
    const concepts = `${rows?.length ?? 0}:${(rows ?? []).reduce((a, r) => a + Number(r.current_version ?? 0), 0)}`;
    return NextResponse.json({ ...effectiveStatus(project), concepts }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return handleRouteError(e, "status");
  }
}
