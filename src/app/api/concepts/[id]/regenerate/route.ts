import { NextResponse } from "next/server";
import { z } from "zod";
import { handleRouteError, jsonError, routeUser } from "@/lib/api";
import { REGENERATABLE_FIELDS } from "@/lib/creative/concept";
import { getConcept } from "@/lib/db/repo";
import { regenerateConcept } from "@/lib/jobs/concepts";
import { consumeRateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/server";

export const maxDuration = 180;

const Body = z.object({
  fields: z.array(z.enum(REGENERATABLE_FIELDS)).min(1).max(REGENERATABLE_FIELDS.length).optional(),
  instruction: z.string().trim().min(2).max(600).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, user } = await routeUser();
    if (!user) return jsonError("Please sign in.", 401);
    const body = Body.safeParse(await req.json().catch(() => ({})));
    if (!body.success) return jsonError("Describe the change in a few words (up to 600 characters).", 400);
    const concept = await getConcept(supabase, user.id, id);
    if (!concept) return jsonError("Concept not found.", 404);
    if (concept.status === "regenerating") return jsonError("This concept is already regenerating.", 409);

    const admin = createServiceClient();
    await consumeRateLimit(admin, user.id, "regenerate");
    const changed = await regenerateConcept(admin, user.id, id, { only: body.data.fields, instruction: body.data.instruction });
    return NextResponse.json({ changed });
  } catch (e) {
    return handleRouteError(e, "regenerate");
  }
}
