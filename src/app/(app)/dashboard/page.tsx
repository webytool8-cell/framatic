import { Card } from "@/components/ui/card";
import { Circle, HalfDisc, Ring } from "@/components/ui/shapes";
import { Composer } from "@/components/app/composer";
import { ProjectCard } from "@/components/app/project-card";
import { requireUser } from "@/lib/supabase/server";
import { effectiveStatus, type ProjectRow } from "@/lib/types";

export const metadata = { title: "Projects" };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error: start } = await searchParams;
  const { supabase, user } = await requireUser();
  const { data: projects, error } = await supabase
    .from("projects")
    .select("*, brand_profiles(profile), creative_concepts(content, is_preferred)")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  type Row = ProjectRow & { brand_profiles: { profile: { identity?: { primaryColor?: string } } } | null; creative_concepts: Array<{ content: { title: string }; is_preferred: boolean }> };
  const rows = (projects ?? []) as Row[];

  return (
    <div>
      <section className="mb-14 max-w-3xl">
        <h1 className="text-display mb-6 text-5xl">Make a new ad</h1>
        <Composer size="md" />
      </section>
      {start === "start" && <p className="mb-6 text-coral-deep">We couldn&apos;t start that project. Please try again.</p>}
      {rows.length > 0 && <h2 className="text-heading mb-5 text-2xl">Your projects</h2>}

      {error && <p className="text-coral-deep">Couldn&apos;t load your projects. Refresh to try again.</p>}

      {rows.length === 0 ? (
        <Card accent="violet" className="relative overflow-hidden px-8 py-10">
          <Circle className="absolute -right-10 -top-10 h-32 w-32" color="#F0EBFF" />
          <Ring className="absolute right-16 bottom-4 h-12 w-12" color="#39C6E8" />
          <HalfDisc className="absolute bottom-0 left-1/2 h-10 w-20" color="#FFD166" />
          <p className="relative max-w-md text-slate">Your projects will show up here. Paste a website above to make your first one — it takes about a minute.</p>
        </Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((p) => (
            <ProjectCard
              key={p.id}
              p={{
                id: p.id,
                name: p.name,
                website_url: p.website_url,
                status: effectiveStatus(p).status,
                created_at: p.created_at,
                updated_at: p.updated_at,
                primary: p.brand_profiles?.profile?.identity?.primaryColor ?? null,
                preferred: p.creative_concepts?.find((c) => c.is_preferred)?.content?.title ?? null,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
