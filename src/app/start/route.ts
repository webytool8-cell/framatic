import { after, NextResponse, type NextRequest } from "next/server";
import { briefToPreferences } from "@/lib/brief";
import { clearDraft, readDraft } from "@/lib/draft";
import { runAutopilot } from "@/lib/jobs/autopilot";
import { log } from "@/lib/log";
import { reserveCredits } from "@/lib/credits";
import { OutOfCreditsError, RateLimitError } from "@/lib/rate-limit";
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

  await clearDraft();
  const admin = createServiceClient();
  const host = new URL(brief.url).hostname.replace(/^www\./, "");
  const { data: project, error } = await supabase
    .from("projects")
    .insert({ user_id: user.id, name: host, website_url: brief.url, status: "analyzing", status_message: "Queued…", creative_preferences: briefToPreferences(brief) })
    .select("id")
    .single();
  if (error || !project) {
    log.error("start: project insert failed", { error: error?.message });
    return to("/dashboard?error=start");
  }

  // Hold the credits before any work starts. If there aren't enough, drop the
  // empty project and show the plans instead of a failed project.
  try {
    const hold = await reserveCredits(admin, user.id, "analyze", { ref: project.id });
    after(() => runAutopilot(admin, user.id, project.id, undefined, hold.reservationId));
  } catch (e) {
    await admin.from("projects").delete().eq("id", project.id).eq("user_id", user.id);
    if (e instanceof OutOfCreditsError) return to("/pricing?reason=credits");
    if (e instanceof RateLimitError) return to(`/dashboard?error=${encodeURIComponent(e.message)}`);
    log.error("start: reserve failed", { error: (e as Error).message });
    return to("/dashboard?error=start");
  }
  return to(`/projects/${project.id}`);
}
