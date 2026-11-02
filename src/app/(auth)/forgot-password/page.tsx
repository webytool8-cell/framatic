import Link from "next/link";
import { SimpleForm } from "@/components/app/simple-form";
import { requestPasswordReset } from "@/app/actions/account";

export const metadata = { title: "Reset your password" };

export default function ForgotPassword() {
  return (
    <>
      <h1 className="text-heading mb-2 text-4xl">Reset your password</h1>
      <p className="mb-8 text-slate">Enter your account email and we&apos;ll send you a link to choose a new password.</p>
      <SimpleForm action={requestPasswordReset} submit="Send reset link" pendingLabel="Sending…" hideOnSuccess fields={[{ name: "email", label: "Email", type: "email", autoComplete: "email", placeholder: "you@company.com" }]} />
      <p className="mt-6 text-sm text-slate"><Link href="/login" className="font-semibold text-violet-deep hover:underline">Back to sign in</Link></p>
    </>
  );
}
