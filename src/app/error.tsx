"use client";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * App-wide error screen. If the page was loaded from an older deployment
 * (common right after a redeploy), reload once to pick up the new version.
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const stale = /Failed to find Server Action|older or newer deployment/i.test(error.message);
  useEffect(() => {
    if (!stale) return;
    const key = "framatic-reloaded-for-deploy";
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, "1");
      window.location.reload();
    }
  }, [stale]);

  return (
    <main className="mx-auto grid min-h-[60dvh] max-w-lg place-items-center px-6 text-center">
      <div>
        <h1 className="text-heading mb-3 text-3xl">{stale ? "Framatic was just updated" : "Something went wrong"}</h1>
        <p className="mb-6 text-slate">{stale ? "Reload the page to get the latest version, then try again." : "Please try again. If it keeps happening, reload the page."}</p>
        <Button onClick={() => (stale ? window.location.reload() : reset())}>{stale ? "Reload" : "Try again"}</Button>
      </div>
    </main>
  );
}
