"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient, createServiceClient, requireUser } from "@/lib/supabase/server";
import { log } from "@/lib/log";
import type { FormState } from "./auth";

async function siteOrigin() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
}

const Email = z.string().trim().email("Enter a valid email address.");
const Password = z.string().min(8, "Use at least 8 characters.").max(72, "Use at most 72 characters.");

/** Always reports success so the form can't be used to discover accounts. */
export async function requestPasswordReset(_: FormState, form: FormData): Promise<FormState> {
  const email = Email.safeParse(form.get("email"));
  if (!email.success) return { error: email.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.data, { redirectTo: `${await siteOrigin()}/auth/callback?next=/reset-password` });
  if (error) log.warn("password reset request failed", { error: error.message });
  return { message: "If there's an account for that email, a reset link is on its way. Check your inbox (and spam)." };
}

export async function setNewPassword(_: FormState, form: FormData): Promise<FormState> {
  const pw = Password.safeParse(form.get("password"));
  if (!pw.success) return { error: pw.error.issues[0].message };
  if (form.get("password") !== form.get("confirm")) return { error: "The two passwords don't match." };
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "This reset link has expired. Request a new one." };
  const { error } = await supabase.auth.updateUser({ password: pw.data });
  if (error) return { error: error.message.includes("different") ? "Choose a password you haven't used before." : "Couldn't update your password. Please try again." };
  redirect("/dashboard?password=updated");
}

export async function changePassword(_: FormState, form: FormData): Promise<FormState> {
  const { supabase } = await requireUser();
  const pw = Password.safeParse(form.get("password"));
  if (!pw.success) return { error: pw.error.issues[0].message };
  if (form.get("password") !== form.get("confirm")) return { error: "The two passwords don't match." };
  const { error } = await supabase.auth.updateUser({ password: pw.data });
  if (error) return { error: error.message.includes("different") ? "Choose a password you haven't used before." : "Couldn't update your password." };
  return { message: "Password updated." };
}

export async function changeEmail(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, user } = await requireUser();
  const email = Email.safeParse(form.get("email"));
  if (!email.success) return { error: email.error.issues[0].message };
  if (email.data.toLowerCase() === user.email?.toLowerCase()) return { error: "That's already your email." };
  const { error } = await supabase.auth.updateUser({ email: email.data }, { emailRedirectTo: `${await siteOrigin()}/auth/callback?next=/settings` });
  if (error) return { error: error.message.includes("registered") ? "That email is already used by another account." : "Couldn't change your email." };
  return { message: `Almost done: click the confirmation link sent to ${email.data}. Until then, keep signing in with your current email.` };
}

/** Permanently delete the account, its files and (via cascades) all its data. */
export async function deleteAccount(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, user } = await requireUser();
  if (String(form.get("confirm") ?? "").trim().toUpperCase() !== "DELETE") return { error: "Type DELETE to confirm." };
  const admin = createServiceClient();
  for (const bucket of ["brand-assets", "renders"]) {
    try {
      const paths: string[] = [];
      const walk = async (prefix: string) => {
        const { data } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
        for (const item of data ?? []) {
          const p = `${prefix}/${item.name}`;
          if (item.id === null) await walk(p);
          else paths.push(p);
        }
      };
      await walk(user.id);
      for (let i = 0; i < paths.length; i += 100) await admin.storage.from(bucket).remove(paths.slice(i, i + 100));
    } catch (e) {
      log.warn("account delete: storage cleanup failed", { bucket, error: (e as Error).message });
    }
  }
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    log.error("account delete failed", { error: error.message });
    return { error: "Couldn't delete your account. Please try again." };
  }
  await supabase.auth.signOut();
  redirect("/?account=deleted");
}
