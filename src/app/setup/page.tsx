import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/ui/shapes";

export const metadata = { title: "Setup required" };

export default function SetupPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link href="/"><Logo /></Link>
      <Card accent="yellow" className="mt-10 p-8">
        <p className="label-tech mb-2">Configuration</p>
        <h1 className="text-heading mb-4 text-3xl">Connect Supabase to continue</h1>
        <p className="mb-4 leading-relaxed text-slate">
          Accounts and projects are stored in Supabase, which isn&apos;t configured on this server yet. Copy <code className="font-mono text-sm">.env.example</code> to <code className="font-mono text-sm">.env.local</code>, add your Supabase URL and keys, run the migration in <code className="font-mono text-sm">supabase/migrations</code>, and restart.
        </p>
        <p className="text-sm text-slate">See the README for step-by-step instructions.</p>
      </Card>
    </main>
  );
}
