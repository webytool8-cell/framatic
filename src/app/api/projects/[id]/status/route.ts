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
    return NextResponse.json(effectiveStatus(project), { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return handleRouteError(e, "status");
  }
}
