"use client";
import { useActionState } from "react";
import { createProject } from "@/app/actions/projects";
import { Button } from "@/components/ui/button";
import { Alert, Input } from "@/components/ui/form";

/** Secondary path for products without a page to read. */
export function ManualStart() {
  const [state, action, pending] = useActionState(createProject, undefined);
  return (
    <details className="group mt-6 text-sm">
      <summary className="cursor-pointer select-none text-slate hover:text-ink">No store or product page yet? Describe your product yourself</summary>
      <form action={action} className="mt-3 flex flex-wrap gap-2">
        <input type="hidden" name="mode" value="manual" />
        <label htmlFor="manual-name" className="sr-only">Product name</label>
        <Input id="manual-name" name="name" required placeholder="Product name" className="h-10 max-w-xs" />
        <Button size="sm" variant="secondary" className="h-10" disabled={pending}>{pending ? "Creating…" : "Start blank"}</Button>
        {state?.error && <Alert className="w-full">{state.error}</Alert>}
      </form>
    </details>
  );
}
