"use client";
import { useActionState } from "react";
import { saveBillingConfig } from "@/app/actions/billing";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/form";
import type { BillingConfig } from "@/lib/billing-config";

function NumberField({ name, label, value, step = "1", suffix }: { name: string; label: string; value: number; step?: string; suffix?: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-slate">{label}</span>
      <span className="flex items-center gap-1.5">
        <input name={name} type="number" step={step} min={0} defaultValue={value} required className="h-9 w-full rounded-lg border border-line-strong px-2.5 font-mono text-sm focus:border-violet focus:outline-none focus:ring-2 focus:ring-lavender" />
        {suffix && <span className="shrink-0 text-xs text-slate">{suffix}</span>}
      </span>
    </label>
  );
}

/** Edit credit costs, cost ceilings and cost assumptions without a deploy. */
export function BillingConfigForm({ config }: { config: BillingConfig }) {
  const [state, action, pending] = useActionState(saveBillingConfig, undefined);
  const c = config;
  return (
    <form action={action} className="space-y-6">
      <fieldset>
        <legend className="mb-2 font-semibold">Credits per operation</legend>
        <div className="grid gap-3 sm:grid-cols-4">
          <NumberField name="c.analyze" label="New project" value={c.creditCosts.analyze} />
          <NumberField name="c.generate" label="Three fresh concepts" value={c.creditCosts.generate} />
          <NumberField name="c.regenerate" label="AI rework" value={c.creditCosts.regenerate} />
          <NumberField name="c.render" label="MP4 export" value={c.creditCosts.render} />
        </div>
        <p className="mt-2 text-xs text-slate">Re-reading a product page costs new project − three concepts ({Math.max(1, c.creditCosts.analyze - c.creditCosts.generate)} now). Partial results are charged per concept delivered.</p>
      </fieldset>
      <fieldset>
        <legend className="mb-2 font-semibold">Cost ceilings (USD per operation)</legend>
        <div className="grid gap-3 sm:grid-cols-5">
          <NumberField name="x.analyze" label="New project" value={c.costCeilings.analyze} step="0.01" />
          <NumberField name="x.analyze_only" label="Re-read page" value={c.costCeilings.analyze_only} step="0.01" />
          <NumberField name="x.generate" label="Fresh concepts" value={c.costCeilings.generate} step="0.01" />
          <NumberField name="x.regenerate" label="AI rework" value={c.costCeilings.regenerate} step="0.01" />
          <NumberField name="x.render" label="MP4 export" value={c.costCeilings.render} step="0.001" />
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 font-semibold">Cost assumptions</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <NumberField name="p.computePerSecond" label="Server time" value={c.prices.computePerSecond} step="0.000001" suffix="$/s" />
          <NumberField name="p.storageGbMonth" label="Storage" value={c.prices.storageGbMonth} step="0.001" suffix="$/GB·mo" />
          <NumberField name="p.egressGb" label="Bandwidth" value={c.prices.egressGb} step="0.001" suffix="$/GB" />
          <NumberField name="p.downloadsPerVideo" label="Downloads per video" value={c.prices.downloadsPerVideo} step="0.1" />
          <NumberField name="p.stripePercent" label="Payment fee" value={c.prices.stripePercent} step="0.1" suffix="%" />
          <NumberField name="p.stripeFixed" label="Payment fee (fixed)" value={c.prices.stripeFixed} step="0.01" suffix="$" />
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 font-semibold">Margin targets</legend>
        <div className="grid gap-3 sm:grid-cols-4">
          <NumberField name="t.targetMargin" label="Target" value={Math.round(c.targets.targetMargin * 100)} suffix="%" />
          <NumberField name="t.minMargin" label="Minimum" value={Math.round(c.targets.minMargin * 100)} suffix="%" />
        </div>
      </fieldset>
      {state?.error && <Alert>{state.error}</Alert>}
      {state?.message && <Alert tone="success">{state.message}</Alert>}
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save billing settings"}</Button>
    </form>
  );
}
