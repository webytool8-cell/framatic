import { STARTER_IDEAS, type Brief } from "@/lib/brief";

/** Reminds the user what they asked for while they sign in. */
export function DraftBanner({ brief }: { brief: Brief }) {
  const host = new URL(brief.url).hostname.replace(/^www\./, "");
  const ideas = STARTER_IDEAS.filter((i) => brief.ideas.includes(i.id));
  return (
    <div className="mb-8 rounded-[var(--radius-card)] border-[1.5px] border-violet bg-lavender p-4">
      <p className="text-sm text-slate">Your ad brief</p>
      <p className="text-heading truncate text-lg">{host}</p>
      {(ideas.length > 0 || brief.notes) && (
        <p className="mt-1 line-clamp-2 text-sm">{[...ideas.map((i) => i.label), brief.notes].filter(Boolean).join(" · ")}</p>
      )}
      <p className="mt-2 text-sm text-slate">As soon as you&apos;re in, we&apos;ll read the site and write three concepts.</p>
    </div>
  );
}
