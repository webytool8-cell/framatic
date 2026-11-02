import { ConceptCard } from "@/components/app/concept-card";
import { Tag } from "@/components/ui/status";
import { SAMPLE_CONCEPTS, SAMPLE_PROJECT } from "@/lib/sample-project";

export default function SampleProject() {
  return (
    <div className="space-y-8">
      <section aria-label="Brand" className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-2xl bg-[linear-gradient(120deg,#E6F9ED_0%,#E7F8FD_100%)] px-5 py-4 text-sm ring-1 ring-black/5">
        <span className="flex items-center gap-3">
          <span className="flex h-9 w-9 overflow-hidden rounded-lg">{SAMPLE_PROJECT.colors.map((c) => <span key={c} className="flex-1" style={{ background: c }} />)}</span>
          <span>
            <span className="block font-semibold">{SAMPLE_PROJECT.product}</span>
            <span className="text-slate">{SAMPLE_PROJECT.price} · for {SAMPLE_PROJECT.audience.toLowerCase()}</span>
          </span>
        </span>
        {SAMPLE_PROJECT.facts.map((f) => (
          <span key={f} className="flex items-center gap-2">{f}<Tag tone="verified">From site</Tag></span>
        ))}
      </section>

      <div>
        <h2 className="text-heading text-lg">3 concepts</h2>
        <p className="text-sm text-slate">Three different angles in three formats. Open one to see the full ad and try editing it.</p>
      </div>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {SAMPLE_CONCEPTS.map((c, i) => (
          <ConceptCard key={c.id} href={`/sample/${c.slug}`} kind={c.kind} content={c.content} plan={c.plan} preferred={i === 0} edited={0} logoUrl={null} />
        ))}
      </div>
    </div>
  );
}
