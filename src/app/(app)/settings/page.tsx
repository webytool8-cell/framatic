import { SectionCard } from "@/components/ui/card";
import { SettingsForm } from "@/components/app/settings-form";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "Settings" };

export default async function Settings() {
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from("user_preferences").select("*").eq("user_id", user.id).maybeSingle();
  return (
    <div className="max-w-3xl">
      <h1 className="text-heading mb-1 text-2xl">Creative defaults</h1>
      <p className="mb-5 text-sm text-slate">Every new ad starts with these. You can still change any concept afterwards.</p>
      <SectionCard accent="violet" eyebrow="Preferences" title="New concepts start with">
        <SettingsForm initial={{ default_aspect_ratio: data?.default_aspect_ratio ?? "16:9", default_duration_sec: data?.default_duration_sec ?? 30, default_pacing: data?.default_pacing ?? null, brand_voice_notes: data?.brand_voice_notes ?? "" }} />
      </SectionCard>
      <p className="mt-6 text-sm text-slate">Signed in as {user.email}</p>
    </div>
  );
}
