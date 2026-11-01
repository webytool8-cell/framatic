"use client";
import { useActionState, useState } from "react";
import { startFromBrief } from "@/app/actions/start";
import { Alert } from "@/components/ui/form";
import { STARTER_IDEAS } from "@/lib/brief";
import { cn } from "@/lib/cn";

const CHIP_ON = [
  "border-coral bg-peach",
  "border-cyan bg-ice",
  "border-violet bg-lavender",
  "border-lime bg-mint",
  "border-yellow bg-butter",
  "border-coral bg-peach",
];

/** The one input that starts everything: website + optional direction + starter ideas. */
export function Composer({ autoFocus = false, size = "lg" }: { autoFocus?: boolean; size?: "lg" | "md" }) {
  const [state, action, pending] = useActionState(startFromBrief, undefined);
  const [picked, setPicked] = useState<string[]>([]);
  const [url, setUrl] = useState("");

  return (
    <form action={action} className="w-full">
      <div className="rounded-[22px] border-2 border-ink bg-white p-2 shadow-[6px_6px_0_0_#7957FF] transition-shadow duration-200 focus-within:shadow-[8px_8px_0_0_#7957FF]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label htmlFor="composer-url" className="sr-only">Your website</label>
          <input
            id="composer-url"
            name="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            autoFocus={autoFocus}
            inputMode="url"
            autoComplete="url"
            spellCheck={false}
            placeholder="Paste your website URL"
            className={cn("min-w-0 flex-1 rounded-2xl bg-transparent px-4 font-medium text-ink placeholder:text-slate/70 focus:outline-none focus-visible:outline-none", size === "lg" ? "h-16 text-xl" : "h-14 text-lg")}
          />
          <button
            type="submit"
            disabled={pending || !url.trim()}
            className={cn(
              "shrink-0 rounded-2xl bg-violet px-6 font-semibold text-white transition-[background-color,transform] duration-200 hover:-translate-y-px hover:bg-violet-deep disabled:opacity-50 disabled:hover:translate-y-0",
              size === "lg" ? "h-14 text-lg" : "h-12",
            )}
          >
            {pending ? "Starting…" : "Make my ad"}
          </button>
        </div>
        <label htmlFor="composer-notes" className="sr-only">Anything we should know</label>
        <textarea
          id="composer-notes"
          name="notes"
          rows={1}
          maxLength={600}
          placeholder="Anything we should know? (optional)"
          className="block w-full resize-none rounded-xl border-t border-line bg-transparent px-4 py-3 text-[15px] text-ink placeholder:text-slate/70 focus:outline-none focus-visible:outline-none"
        />
      </div>

      <fieldset className="mt-5">
        <legend className="mb-3 text-sm text-slate">Or start from an idea</legend>
        <div className="flex flex-wrap gap-2">
          {STARTER_IDEAS.map((idea, i) => {
            const on = picked.includes(idea.id);
            return (
              <label
                key={idea.id}
                className={cn(
                  "cursor-pointer select-none rounded-full border-[1.5px] px-4 py-2 text-sm font-medium transition-[background-color,border-color,transform] duration-150 hover:-translate-y-px has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-violet",
                  on ? CHIP_ON[i % CHIP_ON.length] : "border-line bg-white text-ink hover:border-ink",
                )}
              >
                <input
                  type="checkbox"
                  name="idea"
                  value={idea.id}
                  checked={on}
                  onChange={() => setPicked((p) => (on ? p.filter((x) => x !== idea.id) : [...p, idea.id]))}
                  className="sr-only"
                />
                {on && <span aria-hidden className="mr-1.5">✓</span>}
                {idea.label}
              </label>
            );
          })}
        </div>
      </fieldset>
      {state?.error && <Alert className="mt-4">{state.error}</Alert>}
    </form>
  );
}
