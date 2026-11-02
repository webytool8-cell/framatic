import Link from "next/link";
import { SimpleForm } from "@/components/app/simple-form";
import { setNewPassword } from "@/app/actions/account";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata = { title: "Choose a new password" };
export const dynamic = "force-dynamic";

export default async function ResetPassword() {
  const user = isSupabaseConfigured() ? (await (await createClient()).auth.getUser()).data.user : null;
  if (!user) {
    return (
      <>
        <h1 className="text-heading mb-2 text-4xl">This link has expired</h1>
        <p className="mb-6 text-slate">Reset links work once and expire after a while. Request a new one.</p>
        <Link href="/forgot-password" className="font-semibold text-violet-deep hover:underline">Send a new reset link</Link>
      </>
    );
  }
  return (
    <>
      <h1 className="text-heading mb-2 text-4xl">Choose a new password</h1>
      <p className="mb-8 text-slate">For {user.email}</p>
      <SimpleForm
        action={setNewPassword}
        submit="Save new password"
        pendingLabel="Saving…"
        fields={[
          { name: "password", label: "New password", type: "password", autoComplete: "new-password", hint: "At least 8 characters." },
          { name: "confirm", label: "Repeat new password", type: "password", autoComplete: "new-password" },
        ]}
      />
    </>
  );
}
