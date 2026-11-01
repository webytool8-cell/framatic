export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app/app-header";
import { BrandEditor } from "@/components/app/brand-editor";
import { ConceptCard } from "@/components/app/concept-card";
import { ConceptWorkspace } from "@/components/app/concept-workspace";
import { WorkflowTabs } from "@/components/app/workflow-tabs";
import { ProjectCard } from "@/components/app/project-card";
import { BrandSummary } from "@/components/app/brand-summary";
import { JobRunner } from "@/components/app/job-runner";
import { Composer } from "@/components/app/composer";
import { AIBrandAnalysis, assembleProfile } from "@/lib/brand/intelligence";
import { AIConcept, CONCEPT_KINDS, CreativePreferences } from "@/lib/creative/concept";
import { finalizeConcept } from "@/lib/creative/director";
import type { SiteAnalysis } from "@/lib/analyzer/crawl";
import { aiBrandFixture, aiConceptFixture, HOME } from "@/lib/dev/sample-data";

/**
 * Development-only visual preview of authenticated screens using fictional
 * sample data. Returns 404 in production.
 */
export default async function Preview({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { view = "concepts" } = await searchParams;
  const site: SiteAnalysis = {
    rootUrl: HOME,
    pages: [{ url: HOME, pageType: "home", title: "Tidyflow", description: "routes, tags and drafts replies to customer emails", headings: ["Inbox zero for support teams", "Stop drowning in tickets", "Answer customers 3x faster"], text: "Support teams lose hours every day sorting and tagging email by hand. AI-drafted replies you approve in one click. Tidyflow", ctas: ["Start free trial"], featureLists: [], og: {}, themeColor: null, logoCandidates: [], images: [], favicon: null, internalLinks: [], stylesheetUrls: [], inlineCss: [], googleFontFamilies: [], looksClientRendered: false, fetchedVia: "http", status: 200 },
      { url: "https://tidyflow.example/features", pageType: "features", title: "Features", description: null, headings: [], text: "Automatic routing by topic and urgency", ctas: [], featureLists: [], og: {}, themeColor: null, logoCandidates: [], images: [], favicon: null, internalLinks: [], stylesheetUrls: [], inlineCss: [], googleFontFamilies: [], looksClientRendered: false, fetchedVia: "http", status: 200 }],
    palette: { primary: "#14B88A", secondary: ["#FF7A1A"], accents: ["#1B1B1F"], neutrals: [] },
    fonts: ["Sora", "Inter"],
    theme: "light",
    logo: null,
    favicon: null,
    siteName: "Tidyflow",
    warnings: [],
  };
  const brand = assembleProfile(site, AIBrandAnalysis.parse(aiBrandFixture()));
  const prefs = CreativePreferences.parse({});
  const titles = ["Inbox, sorted.", "Route. Draft. Send.", "Support should feel human"];
  const concepts = CONCEPT_KINDS.map((k, i) => {
    const raw = aiConceptFixture(titles[i]);
    if (i === 1) {
      raw.scenePlan.scenes[1].visualElements = [{ type: "screenshot_reveal", text: "Routing" } as never];
      raw.scenePlan.scenes[0].background = { type: "split", color: "paper", secondaryColor: "primary" } as never;
    }
    if (i === 2) raw.scenePlan.scenes[0].background = { type: "shape_field", color: "primary" } as never;
    return finalizeConcept(AIConcept.parse(raw), brand, prefs);
  });

  return (
    <div>
      <AppHeader email="preview@framatic.dev" />
      <main className="mx-auto max-w-7xl px-5 pb-24 pt-8 sm:px-8">
        <p className="mb-6 rounded-lg bg-butter px-3 py-2 text-sm">Dev preview with fictional sample data — actions are not wired here.</p>
        {view === "running" && <div className="mx-auto max-w-2xl"><JobRunner projectId="demo" kind="autopilot" status="analyzing" message="Reading your website…" label="" /></div>}
        {view === "dashboard" && <section className="mb-14 max-w-3xl"><h1 className="text-display mb-6 text-5xl">Make a new ad</h1><Composer size="md" /></section>}
        {view === "dashboard" && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {(["concepts_ready", "analyzing", "analysis_failed"] as const).map((s, i) => (
              <ProjectCard key={s} p={{ id: String(i), name: ["Tidyflow launch", "Brightmug store", "Agency pitch"][i], website_url: ["https://tidyflow.example", "https://brightmug.example", "https://studio.example"][i], status: s, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), primary: ["#14B88A", "#FF6B6B", null][i], preferred: i === 0 ? "Inbox, sorted." : null }} />
            ))}
          </div>
        )}
        {view !== "dashboard" && view !== "running" && (
          <div className="mb-8 border-b border-line pb-6">
            <h1 className="text-display mb-5 text-4xl">Tidyflow launch</h1>
            <WorkflowTabs projectId="demo" hasBrand />
          </div>
        )}
        {view === "brand" && <BrandEditor projectId="demo" initial={brand} />}
        {view === "concepts" && (
          <div className="grid gap-8 xl:grid-cols-[1fr_300px]"><div><h2 className="text-heading mb-5 text-3xl">Pick a direction</h2><div className="grid gap-6 md:grid-cols-2 2xl:grid-cols-3">
            {concepts.map((c, i) => {
              const { scenePlan, ...content } = c;
              return <ConceptCard key={i} href="#" kind={CONCEPT_KINDS[i]} content={content} plan={scenePlan} preferred={i === 0} edited={i === 0 ? 2 : 0} />;
            })}
          </div></div><BrandSummary projectId="demo" profile={brand} /></div>
        )}
        {view === "concept" && (() => {
          const { scenePlan, ...content } = concepts[1];
          return <ConceptWorkspace concept={{ id: "demo", kind: "product_in_motion", content, preferences: prefs, editedFields: ["headline"], isPreferred: false, version: 2, plan: scenePlan }} versions={[{ version: 2, source: "user", created_at: new Date().toISOString() }, { version: 1, source: "ai", created_at: new Date().toISOString() }]} logoUrl={null} aiReady />;
        })()}
      </main>
    </div>
  );
}
