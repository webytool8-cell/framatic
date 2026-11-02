import Link from "next/link";
import { notFound } from "next/navigation";
import { ConceptWorkspace } from "@/components/app/concept-workspace";
import { SAMPLE_CONCEPTS, SAMPLE_PROJECT, sampleConcept } from "@/lib/sample-project";

export function generateStaticParams() {
  return SAMPLE_CONCEPTS.map((c) => ({ slug: c.slug }));
}

/** One sample concept in the real editor, in view-only mode (no saving, no exports, no AI). */
export default async function SampleConceptPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = sampleConcept(slug);
  if (!c) notFound();
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm">
        <Link href="/sample" className="font-semibold text-slate hover:text-ink">← All concepts</Link>
        <nav aria-label="Sample concepts" className="flex gap-1">
          {SAMPLE_CONCEPTS.map((x) => (
            <Link key={x.slug} href={`/sample/${x.slug}`} aria-current={x.slug === slug ? "page" : undefined} className={x.slug === slug ? "rounded-md bg-ink px-2.5 py-1 font-semibold text-white" : "rounded-md px-2.5 py-1 text-slate hover:bg-lavender hover:text-ink"}>
              {x.content.title}
            </Link>
          ))}
        </nav>
      </div>
      <ConceptWorkspace
        sample
        concept={{ id: c.id, kind: c.kind, content: c.content, preferences: c.preferences, editedFields: [], isPreferred: false, version: 1, plan: c.plan }}
        versions={[{ version: 1, source: "ai", created_at: "2026-11-01T12:00:00Z" }]}
        logoUrl={null}
        productName={SAMPLE_PROJECT.mark}
        aiReady={false}
        renderReady={false}
      />
    </div>
  );
}
