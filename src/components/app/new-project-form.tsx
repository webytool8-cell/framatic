"use client";
import { useActionState, useState } from "react";
import { createProject } from "@/app/actions/projects";
import { Button } from "@/components/ui/button";
import { Alert, Field, Input, Select } from "@/components/ui/form";
import { cn } from "@/lib/cn";

export function NewProjectForm({ brands }: { brands: Array<{ id: string; name: string; source_url: string | null }> }) {
  const [state, action, pending] = useActionState(createProject, undefined);
  const [mode, setMode] = useState<"url" | "manual">("url");
  const [reuse, setReuse] = useState("");

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="mode" value={mode} />
      <div role="tablist" aria-label="How to start" className="inline-flex rounded-full border-[1.5px] border-line p-1">
        {(["url", "manual"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={cn("rounded-full px-4 py-1.5 text-sm font-semibold transition-colors", mode === m ? "bg-ink text-white" : "text-slate hover:text-ink")}
          >
            {m === "url" ? "Analyze a store or product" : "Enter brand manually"}
          </button>
        ))}
      </div>

      {mode === "url" && (
        <Field label="Store, product or app link" htmlFor="url" hint="We read a handful of public pages: home, product, pricing, about. Nothing behind a login.">
          <div className="relative">
            <span aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-sm text-slate">https://</span>
            <Input id="url" name="url" required={mode === "url"} placeholder="yourproduct.com" className="h-14 pl-[4.6rem] text-lg" autoFocus inputMode="url" autoComplete="url" />
          </div>
        </Field>
      )}

      <Field label="Project name" htmlFor="name" hint={mode === "url" ? "Optional — defaults to the domain." : undefined}>
        <Input id="name" name="name" required={mode === "manual"} placeholder="Spring launch campaign" />
      </Field>

      {brands.length > 0 && (
        <Field label="Start from a saved brand profile" htmlFor="reuse_brand" hint={reuse ? "This project will share that brand profile — edits apply to every project using it." : "Optional."}>
          <Select id="reuse_brand" name="reuse_brand" value={reuse} onChange={(e) => setReuse(e.target.value)}>
            <option value="">— None, create a new profile —</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>{b.name}{b.source_url ? ` (${new URL(b.source_url).hostname})` : ""}</option>
            ))}
          </Select>
        </Field>
      )}

      {state?.error && <Alert>{state.error}</Alert>}
      <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Creating…" : mode === "url" && !reuse ? "Analyze link" : "Create project"}
      </Button>
    </form>
  );
}
