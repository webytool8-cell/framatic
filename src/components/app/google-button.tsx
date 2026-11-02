"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** "Continue with Google" — shown when NEXT_PUBLIC_AUTH_GOOGLE=true and the provider is enabled in Supabase. */
export function GoogleButton({ next }: { next?: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (process.env.NEXT_PUBLIC_AUTH_GOOGLE !== "true") return null;
  return (
    <div className="mb-6">
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
          const { error } = await createClient().auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext)}` },
          });
          if (error) {
            setPending(false);
            setError("Google sign-in isn't available right now. Use your email instead.");
          }
        }}
        className="flex h-12 w-full items-center justify-center gap-2.5 rounded-[var(--radius-control)] border-[1.5px] border-line-strong bg-white font-semibold transition-colors hover:border-ink disabled:opacity-60"
      >
        <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5">
          <path fill="#4285F4" d="M22.6 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8.1z" />
          <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z" />
          <path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.1a11 11 0 0 0 0 9.9l3.7-2.8z" />
          <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z" />
        </svg>
        {pending ? "Opening Google…" : "Continue with Google"}
      </button>
      {error && <p className="mt-2 text-sm text-coral-deep">{error}</p>}
      <div className="mt-6 flex items-center gap-3 text-xs text-slate"><span className="h-px flex-1 bg-line" />or with email<span className="h-px flex-1 bg-line" /></div>
    </div>
  );
}
