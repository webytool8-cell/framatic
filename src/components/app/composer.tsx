"use client";
import { useState, type FormEvent } from "react";
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

/** The one input that starts everything: store/product/app link + optional direction + starter ideas. */
export function Composer({ autoFocus = false, size = "lg" }: { autoFocus?: boolean; size?: "lg" | "md" }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/brief", { method: "POST", body: new FormData(e.currentTarget) });
      const body = (await res.json().catch(() => ({}))) as { redirect?: string; error?: string };
      if (body.redirect) {
        window.location.assign(body.redirect);
        return;
      }
      setError(body.error ?? "Something went wrong. Please try again.");
    } catch {
      setError("Couldn't reach Framatic. Check your connection and try again.");
    }
    setPending(false);
  }
  const [picked, setPicked] = useState<string[]>([]);
  const [url, setUrl] = useState("");

  return (
    <form onSubmit={submit} className="w-full">
      <div
        className={cn(
          "bg-white p-2 transition-[box-shadow,border-color] duration-200",
          size === "lg"
            ? "rounded-[22px] border-2 border-ink shadow-[6px_6px_0_0_#7957FF] focus-within:shadow-[8px_8px_0_0_#7957FF]"
            : "rounded-xl border-[1.5px] border-line-strong focus-within:border-violet focus-within:ring-4 focus-within:ring-lavender",
        )}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label htmlFor="composer-url" className="sr-only">Store, product or app link</label>
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
            placeholder="Paste a product link"
            className={cn("min-w-0 flex-1 rounded-2xl bg-transparent px-4 font-medium text-ink placeholder:text-slate/70 focus:outline-none focus-visible:outline-none", size === "lg" ? "h-16 text-xl" : "h-11 text-base")}
          />
          <button
            type="submit"
            disabled={pending || !url.trim()}
            className={cn(
              "shrink-0 bg-violet px-5 font-semibold text-white transition-[background-color,transform] duration-200 hover:-translate-y-px hover:bg-violet-deep disabled:opacity-50 disabled:hover:translate-y-0",
              size === "lg" ? "h-14 rounded-2xl text-lg" : "h-10 rounded-lg text-sm",
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
          placeholder="An offer, a launch, a vibe? (optional)"
          className="block w-full resize-none rounded-xl border-t border-line bg-transparent px-4 py-3 text-[15px] text-ink placeholder:text-slate/70 focus:outline-none focus-visible:outline-none"
        />
      </div>

      <fieldset className={size === "lg" ? "mt-5" : "mt-3"}>
        <legend className={cn("text-slate", size === "lg" ? "mb-3 text-sm" : "mb-2 text-xs")}>{size === "lg" ? "Or start from an idea" : "Starting ideas"}</legend>
        <div className={cn("flex flex-wrap", size === "lg" ? "gap-2" : "gap-1.5")}>
          {STARTER_IDEAS.map((idea, i) => {
            const on = picked.includes(idea.id);
            return (
              <label
                key={idea.id}
                className={cn(
                  "cursor-pointer select-none rounded-full border-[1.5px] font-medium",
                  size === "lg" ? "px-4 py-2 text-sm" : "px-3 py-1 text-xs",
                  " transition-[background-color,border-color,transform] duration-150 hover:-translate-y-px has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-violet",
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
      {error && <Alert className="mt-4">{error}</Alert>}
    </form>
  );
}
