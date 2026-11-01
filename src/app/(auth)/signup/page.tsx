import { AuthForm } from "@/components/app/auth-form";
import { DraftBanner } from "@/components/app/draft-banner";
import { signup } from "@/app/actions/auth";
import { readDraft } from "@/lib/draft";

export const metadata = { title: "Create account" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const draft = next === "/start" ? await readDraft() : null;
  return (
    <>
      {draft && <DraftBanner brief={draft} />}
      <h1 className="text-heading mb-8 text-4xl">{draft ? "Create an account to see your concepts" : "Create your Framatic account"}</h1>
      <AuthForm mode="signup" action={signup} next={next} />
    </>
  );
}
