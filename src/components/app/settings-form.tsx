"use client";
import { useActionState } from "react";
import { savePreferences } from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { Alert, Field, Select, Textarea, Input } from "@/components/ui/form";

export function SettingsForm({ initial }: { initial: { default_aspect_ratio: string; default_duration_sec: number; default_pacing: string | null; brand_voice_notes: string } }) {
  const [state, action, pending] = useActionState(savePreferences, undefined);
  return (
    <form action={action} className="grid gap-5 sm:grid-cols-2">
      <Field label="Default format" htmlFor="ar">
        <Select id="ar" name="default_aspect_ratio" defaultValue={initial.default_aspect_ratio}>
          <option value="16:9">16:9 · landscape</option><option value="9:16">9:16 · vertical</option><option value="1:1">1:1 · square</option><option value="4:5">4:5 · portrait</option>
        </Select>
      </Field>
      <Field label="Default length (seconds)" htmlFor="dur">
        <Input id="dur" name="default_duration_sec" type="number" min={6} max={60} defaultValue={initial.default_duration_sec} />
      </Field>
      <Field label="Default pacing" htmlFor="pace">
        <Select id="pace" name="default_pacing" defaultValue={initial.default_pacing ?? ""}>
          <option value="">Let the director decide</option><option value="calm">Calm</option><option value="steady">Steady</option><option value="punchy">Punchy</option><option value="rapid">Rapid</option>
        </Select>
      </Field>
      <Field label="Voice notes for every concept" htmlFor="voice" className="sm:col-span-2" hint="Applied to all new concepts, e.g. “No exclamation marks. Prefer plain words.”">
        <Textarea id="voice" name="brand_voice_notes" maxLength={1000} defaultValue={initial.brand_voice_notes} />
      </Field>
      <div className="sm:col-span-2 space-y-3">
        {state?.error && <Alert>{state.error}</Alert>}
        {state?.message && <Alert tone="success">{state.message}</Alert>}
        <Button disabled={pending}>{pending ? "Saving…" : "Save preferences"}</Button>
      </div>
    </form>
  );
}
