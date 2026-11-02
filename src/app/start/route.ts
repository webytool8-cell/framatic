import { after, NextResponse, type NextRequest } from "next/server";
import { briefToPreferences } from "@/lib/brief";
import { clearDraft, readDraft } from "@/lib/draft";
import { runAutopilot } from "@/lib/jobs/autopilot";
import { log } from "@/lib/log";
import { OutOfCreditsError, RateLimitError, chargeCredits, refundLatestCharge, setChargeRef } from "@/lib/rate-limit";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** After sign-in: turn the saved brief into a project and run everything automatically. */
export async function GET(request: NextRequest) {
  const to = (path: string) => NextResponse.redirect(new URL(path, request.nextUrl.origin));
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return to("/login?next=/start");
  const user = data.user;

  const brief = await readDraft();
  if (!brief) return to("/dashboard");

  // Charge first, so an empty account goes to Pricing instead of a failed project.
  const admin = createServiceClient();
  let chargeId: number | null = null;
  try {
    chargeId = await chargeCredits(admin, user.id, "analyze");
  } catch (e) {
    if (e instanceof OutOfCreditsError) return to("/pricing?reason=credits");
    if (e instanceof RateLimitError) return to(`/dashboard?error=${encodeURIComponent(e.message)}`);
    log.error("start: charge failed", { error: (e as Error).message });
    return to("/dashboard?error=start");
  }
  await clearDraft();

  const host = new URL(brief.url).hostname.replace(/^www\./, "");
  const { data: project, error } = await supabase
    .from("projects")
    .insert({ user_id: user.id, name: host, website_url: brief.url, status: "analyzing", status_message: "Queued…", creative_preferences: briefToPreferences(brief) })
    .select("id")
    .single();
  if (error || !project) {
    log.error("start: project insert failed", { error: error?.message });
    if (chargeId !== null) {
      await setChargeRef(admin, chargeId, `start:${chargeId}`);
      await refundLatestCharge(admin, user.id, `start:${chargeId}`, "project insert failed");
    }
    return to("/dashboard?error=start");
  }
  if (chargeId !== null) await setChargeRef(admin, chargeId, project.id);
  after(() => runAutopilot(admin, user.id, project.id));
  return to(`/projects/${project.id}`);
}
