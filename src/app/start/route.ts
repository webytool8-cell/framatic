import { after, NextResponse, type NextRequest } from "next/server";
import { briefToPreferences } from "@/lib/brief";
import { clearDraft, readDraft } from "@/lib/draft";
import { runAutopilot } from "@/lib/jobs/autopilot";
import { log } from "@/lib/log";
import { consumeRateLimit, RateLimitError } from "@/lib/rate-limit";
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

  try {
    const admin = createServiceClient();
    await consumeRateLimit(admin, user.id, "analyze");
    after(() => runAutopilot(admin, user.id, project.id));
  } catch (e) {
    const message = e instanceof RateLimitError ? e.message : "We couldn't start the analysis. Try again from the project page.";
    await supabase.from("projects").update({ status: "analysis_failed", status_message: message }).eq("id", project.id);
  }
  return to(`/projects/${project.id}`);
}
