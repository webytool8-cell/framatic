"use server";
import { revalidatePath } from "next/cache";
import { isAdminEmail } from "@/lib/admin";
import { BillingConfig, clearBillingConfigCache } from "@/lib/billing-config";
import { createServiceClient, requireUser } from "@/lib/supabase/server";
import { log } from "@/lib/log";
import type { FormState } from "./auth";

const n = (f: FormData, k: string) => Number(String(f.get(k) ?? "").trim());

/** Save credit costs, cost ceilings and cost assumptions (admins only). */
export async function saveBillingConfig(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireUser();
  if (!isAdminEmail(user.email)) return { error: "Only admins can change billing settings." };
  const parsed = BillingConfig.safeParse({
    creditCosts: { analyze: n(form, "c.analyze"), generate: n(form, "c.generate"), regenerate: n(form, "c.regenerate"), render: n(form, "c.render") },
    costCeilings: { analyze: n(form, "x.analyze"), analyze_only: n(form, "x.analyze_only"), generate: n(form, "x.generate"), regenerate: n(form, "x.regenerate"), render: n(form, "x.render") },
    prices: {
      computePerSecond: n(form, "p.computePerSecond"),
      storageGbMonth: n(form, "p.storageGbMonth"),
      egressGb: n(form, "p.egressGb"),
      downloadsPerVideo: n(form, "p.downloadsPerVideo"),
      stripePercent: n(form, "p.stripePercent"),
      stripeFixed: n(form, "p.stripeFixed"),
    },
    targets: { targetMargin: n(form, "t.targetMargin") / 100, minMargin: n(form, "t.minMargin") / 100 },
  });
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { error: `Check ${i.path.join(" → ")}: ${i.message}` };
  }
  if (parsed.data.creditCosts.generate > parsed.data.creditCosts.analyze) return { error: "A new project must cost at least as much as three fresh concepts." };
  const admin = createServiceClient();
  const { error } = await admin.from("billing_config").upsert({ id: 1, data: parsed.data, updated_by: user.email, updated_at: new Date().toISOString() });
  if (error) return { error: `Couldn't save: ${error.message}` };
  clearBillingConfigCache();
  log.info("billing config updated", { by: user.email, creditCosts: parsed.data.creditCosts });
  revalidatePath("/", "layout");
  return { message: "Saved. New credit costs apply to operations started from now on (other servers pick them up within 30 seconds)." };
}
