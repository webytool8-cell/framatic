"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, Field, Input } from "@/components/ui/form";
import type { FormState } from "@/app/actions/auth";

export interface SimpleField {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  hint?: string;
  defaultValue?: string;
}

/** Small form for single-purpose account actions. */
export function SimpleForm({
  action,
  fields,
  submit,
  pendingLabel = "One moment…",
  variant = "primary",
  hideOnSuccess = false,
}: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  fields: SimpleField[];
  submit: string;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "danger";
  hideOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  if (hideOnSuccess && state?.message) return <Alert tone="success">{state.message}</Alert>;
  return (
    <form action={formAction} className="space-y-4">
      {fields.map((f) => (
        <Field key={f.name} label={f.label} htmlFor={`f-${f.name}`} hint={f.hint}>
          <Input id={`f-${f.name}`} name={f.name} type={f.type ?? "text"} autoComplete={f.autoComplete} placeholder={f.placeholder} defaultValue={f.defaultValue} required />
        </Field>
      ))}
      {state?.error && <Alert>{state.error}</Alert>}
      {state?.message && <Alert tone="success">{state.message}</Alert>}
      <Button type="submit" variant={variant} disabled={pending}>{pending ? pendingLabel : submit}</Button>
    </form>
  );
}
