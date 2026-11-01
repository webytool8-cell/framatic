import { AuthForm } from "@/components/app/auth-form";
import { DraftBanner } from "@/components/app/draft-banner";
import { login } from "@/app/actions/auth";
import { readDraft } from "@/lib/draft";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const draft = next === "/start" ? await readDraft() : null;
  return (
    <>
      {draft && <DraftBanner brief={draft} />}
      <h1 className="text-heading mb-8 text-4xl">{draft ? "Sign in to start" : "Welcome back"}</h1>
      <AuthForm mode="login" action={login} next={next} initialError={error === "confirm" ? "That confirmation link is invalid or expired." : undefined} />
    </>
  );
}
