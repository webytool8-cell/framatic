import { SectionCard } from "@/components/ui/card";
import { SettingsForm } from "@/components/app/settings-form";
import { SimpleForm } from "@/components/app/simple-form";
import { changeEmail, changePassword, deleteAccount } from "@/app/actions/account";
import { requireUser } from "@/lib/supabase/server";
import { CreditsCard, toActivity, type LedgerRow } from "@/components/app/credits-card";
import { getBalance } from "@/lib/credits";
import { createServiceClient } from "@/lib/supabase/server";
import { leaveUnlimited, redeemAccessCode } from "@/app/actions/credits";
import { isAdminEmail } from "@/lib/admin";
import Link from "next/link";

export const metadata = { title: "Settings" };

export default async function Settings() {
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from("user_preferences").select("*").eq("user_id", user.id).maybeSingle();
  const viaGoogle = user.app_metadata?.provider === "google";
  const balance = await getBalance(createServiceClient(), user.id).catch(() => null);
  // Ledger rows the user can read (RLS): charges, failed operations (not charged) and allocations.
  const { data: ledger } = balance
    ? await supabase
        .from("credit_transactions")
        .select("id, type, operation, amount, list_credits, reason, created_at")
        .eq("user_id", user.id)
        .in("type", ["capture", "release", "allocation", "expiry", "purchase", "adjustment", "refund"])
        .gte("created_at", balance.periodStart.toISOString())
        .order("created_at", { ascending: false })
        .limit(30)
    : { data: [] };
  const activity = toActivity((ledger ?? []) as LedgerRow[]).slice(0, 8);
  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-heading text-2xl">Settings</h1>
        <p className="text-sm text-slate">Your plan, creative defaults for new ads, and your account.</p>
      </div>

      {balance && (
        <div id="credits" className="scroll-mt-20">
          <SectionCard
            accent="cyan"
            eyebrow="This month"
            title="Plan & credits"
            action={isAdminEmail(user.email) ? <Link href="/admin/usage" className="text-sm font-semibold text-violet-deep hover:underline">Usage & cost for all users →</Link> : undefined}
          >
            <CreditsCard balance={balance} activity={activity} />
            <div className="mt-8 border-t border-line pt-6">
              {balance.unlimited ? (
                <div className="max-w-sm">
                  <h3 className="mb-1 font-semibold">Admin access</h3>
                  <p className="mb-3 text-sm text-slate">Unlimited credits are on for this account. Switch back to Free to see what users see.</p>
                  <SimpleForm action={leaveUnlimited} submit="Switch to Free plan" pendingLabel="Switching…" variant="secondary" fields={[]} />
                </div>
              ) : (
                <div className="max-w-sm">
                  <h3 className="mb-1 font-semibold">Have an access code?</h3>
                  <SimpleForm action={redeemAccessCode} submit="Apply code" pendingLabel="Checking…" variant="secondary" fields={[{ name: "code", label: "Access code", type: "password", autoComplete: "off" }]} />
                </div>
              )}
            </div>
          </SectionCard>
        </div>
      )}

      <SectionCard accent="violet" eyebrow="Every new ad starts with" title="Creative defaults">
        <SettingsForm initial={{ default_aspect_ratio: data?.default_aspect_ratio ?? "16:9", default_duration_sec: data?.default_duration_sec ?? 30, default_pacing: data?.default_pacing ?? null, brand_voice_notes: data?.brand_voice_notes ?? "" }} />
      </SectionCard>

      <SectionCard accent="none" eyebrow={viaGoogle ? "Signed in with Google" : "Signed in with email"} title="Account">
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <h3 className="mb-1 font-semibold">Email</h3>
            <p className="mb-3 text-sm text-slate">Currently {user.email}</p>
            <SimpleForm action={changeEmail} submit="Change email" pendingLabel="Sending…" variant="secondary" fields={[{ name: "email", label: "New email", type: "email", autoComplete: "email" }]} />
          </div>
          <div>
            <h3 className="mb-1 font-semibold">Password</h3>
            <p className="mb-3 text-sm text-slate">{viaGoogle ? "Add a password to also sign in with email." : "Choose a new password."}</p>
            <SimpleForm
              action={changePassword}
              submit={viaGoogle ? "Set password" : "Change password"}
              pendingLabel="Saving…"
              variant="secondary"
              fields={[
                { name: "password", label: "New password", type: "password", autoComplete: "new-password", hint: "At least 8 characters." },
                { name: "confirm", label: "Repeat new password", type: "password", autoComplete: "new-password" },
              ]}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard accent="coral" eyebrow="Danger zone" title="Delete account">
        <p className="mb-4 max-w-xl text-sm text-slate">This permanently deletes your account, every project, brand profile, concept and exported video. It can&apos;t be undone.</p>
        <div className="max-w-sm">
          <SimpleForm action={deleteAccount} submit="Delete my account" pendingLabel="Deleting…" variant="danger" fields={[{ name: "confirm", label: "Type DELETE to confirm", autoComplete: "off", placeholder: "DELETE" }]} />
        </div>
      </SectionCard>
    </div>
  );
}
