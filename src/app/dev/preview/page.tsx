export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { Sidebar } from "@/components/app/sidebar";
import { ProjectTable } from "@/components/app/project-table";
import { StatusPill } from "@/components/ui/status";
import { BrandEditor } from "@/components/app/brand-editor";
import { ConceptCard } from "@/components/app/concept-card";
import { ConceptWorkspace } from "@/components/app/concept-workspace";
import { WorkflowTabs } from "@/components/app/workflow-tabs";
import { BrandStrip } from "@/components/app/brand-summary";
import { JobRunner } from "@/components/app/job-runner";
import { Composer } from "@/components/app/composer";
import { AIBrandAnalysis, assembleProfile } from "@/lib/brand/intelligence";
import { AIConcept, CONCEPT_KINDS, CreativePreferences } from "@/lib/creative/concept";
import { finalizeConcept } from "@/lib/creative/director";
import type { SiteAnalysis } from "@/lib/analyzer/crawl";
import { aiBrandFixture, aiConceptFixture, HOME } from "@/lib/dev/sample-data";
import { samplePlan } from "@/lib/samples";

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
    <div className="min-h-dvh bg-[#FAFAFC]">
      <Sidebar email="preview@framatic.dev" projects={[{ id: "demo", name: "Tidyflow launch", status: "concepts_ready", color: "#14B88A" }, { id: "b", name: "Brightmug store", status: "generating", color: "#FF6B6B" }, { id: "c", name: "Agency pitch", status: "analysis_failed", color: null }]} />
      <main className="px-4 pb-20 pt-5 sm:px-6 lg:ml-60 lg:px-8 lg:pt-6"><div className="mx-auto max-w-[1400px]">
        
        {view === "running" && <div className="mx-auto max-w-2xl"><JobRunner projectId="demo" kind="autopilot" status="analyzing" message="Reading your website…" label="" /></div>}
        {view === "dashboard" && (
          <div className="space-y-5">
            <div><h1 className="text-heading text-2xl">Projects</h1><p className="text-sm text-slate">Paste a website to make a new ad, or pick up where you left off.</p></div>
            <section className="rounded-xl border border-line bg-white p-4 sm:p-5"><Composer size="md" /></section>
            <ProjectTable projects={[
              { id: "demo", name: "Tidyflow launch", website_url: "https://tidyflow.example", status: "concepts_ready", updated_at: new Date(Date.now() - 36e5).toISOString(), primary: "#14B88A", palette: ["#14B88A", "#FF7A1A", "#1B1B1F"], concepts: 3, preferred: "Inbox, sorted." },
              { id: "b", name: "Brightmug store", website_url: "https://brightmug.example", status: "generating", updated_at: new Date().toISOString(), primary: "#FF6B6B", palette: ["#FF6B6B", "#FFD166"], concepts: 0, preferred: null },
              { id: "c", name: "Agency pitch", website_url: "https://studio.example", status: "analysis_failed", updated_at: new Date(Date.now() - 864e5 * 2).toISOString(), primary: null, palette: [], concepts: 0, preferred: null },
            ]} />
          </div>
        )}
        {view !== "dashboard" && view !== "running" && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
            <div><p className="mb-0.5 text-xs text-slate">Projects /</p><div className="flex items-center gap-2.5"><h1 className="text-heading text-2xl">Tidyflow launch</h1><StatusPill status="concepts_ready" /><span className="font-mono text-xs text-slate">tidyflow.example ↗</span></div></div>
            <WorkflowTabs projectId="demo" hasBrand />
          </div>
        )}
        {view === "brand" && <BrandEditor projectId="demo" initial={brand} />}
        {view === "concepts" && (
          <div className="space-y-4"><BrandStrip projectId="demo" profile={brand} /><div><h2 className="text-heading text-lg">3 concepts</h2><p className="mb-4 text-sm text-slate">Open one to tweak it.</p><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {concepts.map((c, i) => {
              const { scenePlan, ...content } = c;
              return <ConceptCard key={i} href="#" kind={CONCEPT_KINDS[i]} content={content} plan={scenePlan} preferred={i === 0} edited={i === 0 ? 2 : 0} />;
            })}
          </div></div></div>
        )}
        {view === "concept" && (() => {
          const { scenePlan, ...content } = concepts[1];
          return <ConceptWorkspace concept={{ id: "demo", kind: "product_in_motion", content, preferences: prefs, editedFields: ["headline"], isPreferred: false, version: 2, plan: { ...samplePlan, palette: scenePlan.palette } }} versions={[{ version: 2, source: "user", created_at: new Date().toISOString() }, { version: 1, source: "ai", created_at: new Date().toISOString() }]} logoUrl={null} productName="Tidyflow" aiReady renderReady renders={[{ id: "r1", status: "rendering", progress: 0.42, aspect_ratio: "16:9", duration_sec: 11.6, scene_plan_version: 2, created_at: new Date().toISOString() }, { id: "r0", status: "done", progress: 1, aspect_ratio: "16:9", duration_sec: 11.6, scene_plan_version: 1, out_size_bytes: 767369, created_at: new Date(Date.now() - 36e5).toISOString() }]} />;
        })()}
      </div></main>
    </div>
  );
}
