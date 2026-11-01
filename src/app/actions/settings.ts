"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import type { FormState } from "./auth";

const Prefs = z.object({
  default_aspect_ratio: z.enum(["16:9", "9:16", "1:1", "4:5"]),
  default_duration_sec: z.coerce.number().int().min(6).max(60),
  default_pacing: z.enum(["calm", "steady", "punchy", "rapid", ""]).transform((v) => v || null),
  brand_voice_notes: z.string().max(1000),
});

export async function savePreferences(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, user } = await requireUser();
  const parsed = Prefs.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { error } = await supabase.from("user_preferences").upsert({ user_id: user.id, ...parsed.data });
  if (error) return { error: "Couldn't save preferences." };
  revalidatePath("/settings");
  return { message: "Preferences saved." };
}
