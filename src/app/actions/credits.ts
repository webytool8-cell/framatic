"use server";
import { createHash, timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createServiceClient, requireUser } from "@/lib/supabase/server";
import { RateLimitError, consumeAttempt } from "@/lib/rate-limit";
import { log } from "@/lib/log";
import type { FormState } from "./auth";

/** The admin access token is only valid when it's long enough to be unguessable. */
export async function adminTokenConfigured(): Promise<boolean> {
  return (process.env.FRAMATIC_ADMIN_TOKEN ?? "").trim().length >= 24;
}

function sameSecret(a: string, b: string): boolean {
  // Compare fixed-length digests in constant time, so length and content don't leak.
  const da = createHash("sha256").update(a).digest();
  const db = createHash("sha256").update(b).digest();
  return timingSafeEqual(da, db);
}

/**
 * Redeem an access code. The admin token (FRAMATIC_ADMIN_TOKEN) moves the
 * signed-in account to the Unlimited plan. Attempts are limited to 5 an hour.
 */
export async function redeemAccessCode(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireUser();
  const code = String(form.get("code") ?? "").trim();
  if (!code) return { error: "Enter a code." };
  const admin = createServiceClient();
  try {
    await consumeAttempt(admin, user.id, "redeem");
  } catch (e) {
    if (e instanceof RateLimitError) return { error: e.message };
    throw e;
  }
  const token = (process.env.FRAMATIC_ADMIN_TOKEN ?? "").trim();
  if (!(await adminTokenConfigured()) || !sameSecret(code, token)) {
    log.warn("access code rejected", { userId: user.id });
    return { error: "That code isn't valid." };
  }
  const { error } = await admin.from("user_plans").upsert({ user_id: user.id, plan: "unlimited", note: "admin token" }, { onConflict: "user_id" });
  if (error) {
    log.error("access code: plan update failed", { error: error.message });
    return { error: "Couldn't apply the code. Please try again." };
  }
  log.info("admin token redeemed", { userId: user.id });
  revalidatePath("/", "layout");
  return { message: "Done. This account now has unlimited credits." };
}

/** Leave Unlimited and go back to the Free plan (for testing what users see). */
export async function leaveUnlimited(_: FormState, _form: FormData): Promise<FormState> {
  void _form;
  const { user } = await requireUser();
  const admin = createServiceClient();
  const { data } = await admin.from("user_plans").select("plan").eq("user_id", user.id).maybeSingle();
  if (data?.plan !== "unlimited") return { error: "This account isn't on Unlimited." };
  const { error } = await admin.from("user_plans").update({ plan: "free", note: "left unlimited" }).eq("user_id", user.id);
  if (error) return { error: "Couldn't change the plan. Please try again." };
  revalidatePath("/", "layout");
  return { message: "Back on the Free plan." };
}
