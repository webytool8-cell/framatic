"use server";
import { redirect } from "next/navigation";
import { Brief, STARTER_IDEAS } from "@/lib/brief";
import { normalizeUserUrl, UnsafeUrlError } from "@/lib/analyzer/url-safety";
import { saveDraft } from "@/lib/draft";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "./auth";

/** Landing / dashboard composer: validate, remember the brief, then sign in (if needed) and start. */
export async function startFromBrief(_: FormState, form: FormData): Promise<FormState> {
  let url: string;
  try {
    url = normalizeUserUrl(String(form.get("url") ?? "")).toString();
  } catch (e) {
    return { error: e instanceof UnsafeUrlError ? e.message : "Enter your website address, like yourproduct.com." };
  }
  const ideas = form.getAll("idea").map(String).filter((id) => STARTER_IDEAS.some((i) => i.id === id));
  const brief = Brief.parse({ url, notes: String(form.get("notes") ?? "").slice(0, 600), ideas });
  await saveDraft(brief);

  if (!isSupabaseConfigured()) redirect("/setup");
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  redirect(data.user ? "/start" : "/signup?next=/start");
}
