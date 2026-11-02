import { NextResponse } from "next/server";
import { Brief, STARTER_IDEAS } from "@/lib/brief";
import { normalizeUserUrl, UnsafeUrlError } from "@/lib/analyzer/url-safety";
import { saveDraft } from "@/lib/draft";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

/**
 * Composer submit. A plain route (not a Server Action) so a page left open
 * across a redeploy still works.
 */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 400 });
  let url: string;
  try {
    url = normalizeUserUrl(String(form.get("url") ?? "")).toString();
  } catch (e) {
    return NextResponse.json({ error: e instanceof UnsafeUrlError ? e.message : "Paste a link to your store, product page or app, like yourstore.com." }, { status: 400 });
  }
  const ideas = form.getAll("idea").map(String).filter((id) => STARTER_IDEAS.some((i) => i.id === id));
  await saveDraft(Brief.parse({ url, notes: String(form.get("notes") ?? "").slice(0, 600), ideas }));

  if (!isSupabaseConfigured()) return NextResponse.json({ redirect: "/setup" });
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return NextResponse.json({ redirect: data.user ? "/start" : "/signup?next=/start" });
}
