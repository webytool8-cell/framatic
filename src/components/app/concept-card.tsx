import Link from "next/link";
import { accentBorder } from "@/components/ui/card";
import { SceneStrip, StoryboardFrame } from "@/components/app/storyboard";
import { CONCEPT_META, type ConceptContent, type ConceptKind } from "@/lib/creative/concept";
import type { ScenePlan } from "@/lib/creative/scene-plan";
import { cn } from "@/lib/cn";

const SLOT_BG = { coral: "bg-coral", cyan: "bg-cyan", violet: "bg-violet" } as const;

export function ConceptCard({
  href,
  kind,
  content,
  plan,
  preferred,
  edited,
  logoUrl,
}: {
  href: string;
  kind: ConceptKind;
  content: ConceptContent;
  plan: ScenePlan | null;
  preferred: boolean;
  edited: number;
  logoUrl?: string | null;
}) {
  const meta = CONCEPT_META[kind];
  return (
    <article
      style={{ ["--ring" as string]: `var(--color-${meta.accent})` }}
      className={cn("lift group relative flex flex-col rounded-xl border-[1.5px] bg-white p-4", preferred ? cn(accentBorder[meta.accent], "selected-ring") : "border-line hover:border-ink")}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-2">
          <span className={cn("grid h-7 w-7 place-items-center rounded-md text-sm font-bold", SLOT_BG[meta.accent], meta.accent === "violet" || meta.accent === "coral" ? "text-white" : "text-ink")}>{meta.slot}</span>
          <span className="text-sm font-medium text-slate">{meta.label}</span>
        </span>
        {preferred && <span className="rounded-full bg-ink px-2.5 py-0.5 text-xs font-semibold text-white">★ Preferred</span>}
      </div>
      {plan && (
        <div className="mb-3 [container-type:inline-size]">
          <StoryboardFrame scene={plan.scenes[0]} plan={{ ...plan, aspectRatio: "16:9" }} index={0} logoUrl={logoUrl} />
        </div>
      )}
      <h3 className="text-heading mb-1 text-lg">
        <Link href={href} className="after:absolute after:inset-0 focus:outline-none">{content.title}</Link>
      </h3>
      <p className="mb-1.5 text-sm font-semibold text-violet-deep">“{content.headline}”</p>
      <p className="mb-3 line-clamp-2 text-sm text-slate">{content.description}</p>
      {plan && <SceneStrip plan={plan} className="mb-3" />}
      <dl className="mt-auto grid grid-cols-4 gap-2 border-t border-line pt-3 text-xs">
        <div><dt className="label-tech">Length</dt><dd className="font-semibold">{Math.round(content.estimatedDurationSec)}s</dd></div>
        <div><dt className="label-tech">Pacing</dt><dd className="font-semibold capitalize">{content.pacing}</dd></div>
        <div><dt className="label-tech">Scenes</dt><dd className="font-semibold">{plan?.scenes.length ?? "—"}</dd></div>
        <div><dt className="label-tech">Format</dt><dd className="font-semibold">{plan?.aspectRatio ?? "—"}</dd></div>
      </dl>
      {edited > 0 && <p className="mt-2 text-xs text-slate">{edited} field{edited === 1 ? "" : "s"} edited by you</p>}
    </article>
  );
}
