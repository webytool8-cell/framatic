"use client";
import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, Field, Input } from "@/components/ui/form";
import type { FormState } from "@/app/actions/auth";
import { GoogleButton } from "./google-button";

export function AuthForm({
  mode,
  action,
  next,
  initialError,
}: {
  mode: "login" | "signup";
  action: (s: FormState, f: FormData) => Promise<FormState>;
  next?: string;
  initialError?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialError ? { error: initialError } : undefined);
  return (
    <>
    <GoogleButton next={next} />
    <form action={formAction} className="space-y-5">
      {next && <input type="hidden" name="next" value={next} />}
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@company.com" />
      </Field>
      <Field
        label="Password"
        htmlFor="password"
        hint={mode === "signup" ? "At least 8 characters." : <Link href="/forgot-password" className="font-semibold text-violet-deep hover:underline">Forgot your password?</Link>}
      >
        <Input id="password" name="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} required minLength={8} />
      </Field>
      {state?.error && <Alert>{state.error}</Alert>}
      {state?.message && <Alert tone="success">{state.message}</Alert>}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "One moment…" : next === "/start" ? (mode === "login" ? "Sign in and start" : "Create account and start") : mode === "login" ? "Sign in" : "Create account"}
      </Button>
      <p className="text-center text-sm text-slate">
        {mode === "login" ? (
          <>New to Framatic? <Link href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"} className="font-semibold text-violet-deep underline-offset-4 hover:underline">Create an account</Link></>
        ) : (
          <>Already have an account? <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-semibold text-violet-deep underline-offset-4 hover:underline">Sign in</Link></>
        )}
      </p>
    </form>
    </>
  );
}
