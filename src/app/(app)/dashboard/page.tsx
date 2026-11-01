import { Composer } from "@/components/app/composer";
import { ProjectTable, type ProjectListItem } from "@/components/app/project-table";
import { requireUser } from "@/lib/supabase/server";
import { effectiveStatus, type ProjectRow } from "@/lib/types";

export const metadata = { title: "Projects" };

type Identity = { primaryColor?: string; secondaryColors?: string[]; accentColors?: string[] };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error: startError } = await searchParams;
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("projects")
    .select("*, brand_profiles(profile), creative_concepts(content, is_preferred)")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  type Row = ProjectRow & { brand_profiles: { profile: { identity?: Identity } } | null; creative_concepts: Array<{ content: { title: string }; is_preferred: boolean }> };
  const rows = (data ?? []) as Row[];
  const items: ProjectListItem[] = rows.map((p) => {
    const id = p.brand_profiles?.profile?.identity;
    return {
      id: p.id,
      name: p.name,
      website_url: p.website_url,
      status: effectiveStatus(p).status,
      updated_at: p.updated_at,
      primary: id?.primaryColor ?? null,
      palette: [id?.primaryColor, ...(id?.secondaryColors ?? []), ...(id?.accentColors ?? [])].filter((c): c is string => !!c),
      concepts: p.creative_concepts?.length ?? 0,
      preferred: p.creative_concepts?.find((c) => c.is_preferred)?.content?.title ?? null,
    };
  });
  const running = items.filter((i) => i.status === "analyzing" || i.status === "generating").length;
  const ready = items.filter((i) => i.concepts > 0).length;
  const concepts = items.reduce((n, i) => n + i.concepts, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-heading text-2xl">Projects</h1>
          <p className="text-sm text-slate">Paste a website to make a new ad, or pick up where you left off.</p>
        </div>
        <dl className="flex divide-x divide-line overflow-hidden rounded-lg border border-line bg-white text-sm">
          {[
            ["Projects", items.length, "bg-violet"],
            ["With concepts", ready, "bg-lime-deep"],
            ["Concepts", concepts, "bg-coral"],
            ["Working", running, "bg-cyan"],
          ].map(([k, v, c]) => (
            <div key={k as string} className="px-3.5 py-2">
              <dt className="flex items-center gap-1.5 text-xs text-slate"><span className={`h-1.5 w-1.5 rounded-full ${c}`} />{k}</dt>
              <dd className="text-lg font-semibold tabular-nums">{v as number}</dd>
            </div>
          ))}
        </dl>
      </div>

      <section className="rounded-xl border border-line bg-white p-4 sm:p-5" aria-label="New ad">
        <Composer size="md" />
      </section>
      {startError === "start" && <p className="text-sm text-coral-deep">We couldn&apos;t start that project. Please try again.</p>}
      {error && <p className="text-sm text-coral-deep">Couldn&apos;t load your projects. Refresh to try again.</p>}

      <ProjectTable projects={items} />
    </div>
  );
}
