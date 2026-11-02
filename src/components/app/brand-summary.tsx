import Link from "next/link";
import type { BrandProfile } from "@/lib/brand/schema";

/** Compact read-only view of what the ads are built from, with a way in to edit. */
export function BrandSummary({ projectId, profile }: { projectId: string; profile: BrandProfile }) {
  const colors = [profile.identity.primaryColor, ...profile.identity.secondaryColors, ...profile.identity.accentColors].slice(0, 5);
  const features = [...profile.product.features].sort((a, b) => Number(b.emphasized) - Number(a.emphasized)).slice(0, 3);
  return (
    <aside className="rounded-xl border border-line bg-white p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Built from your brand</h2>
        <Link href={`/projects/${projectId}/brand`} className="text-sm font-semibold text-violet-deep hover:underline">Edit</Link>
      </div>
      <div className="mb-4 flex items-center gap-3">
        {profile.identity.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.identity.logoUrl} alt="" referrerPolicy="no-referrer" className="h-10 w-10 rounded-lg border border-line object-contain p-1" />
        ) : (
          <span aria-hidden className="h-10 w-10 rounded-lg" style={{ background: profile.identity.primaryColor }} />
        )}
        <div className="min-w-0">
          <p className="truncate font-semibold">{profile.product.name.value || "Unnamed product"}</p>
          <p className="truncate text-sm text-slate">{profile.product.category.value || "Category not set"}</p>
        </div>
      </div>
      <div className="mb-4 flex h-6 overflow-hidden rounded-md" aria-label="Brand colors">
        {colors.map((c, i) => <span key={i} className="flex-1" style={{ background: c }} />)}
      </div>
      {profile.product.valueProposition.value && <p className="mb-4 text-sm">“{profile.product.valueProposition.value}”</p>}
      {features.length > 0 && (
        <ul className="space-y-1.5 text-sm">
          {features.map((f) => (
            <li key={f.id} className="flex gap-2"><span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-cyan" />{f.value}</li>
          ))}
        </ul>
      )}
      {profile.missing.length > 0 && (
        <p className="mt-4 rounded-lg bg-butter px-3 py-2 text-xs text-ink">
          {profile.missing.length} thing{profile.missing.length === 1 ? "" : "s"} we couldn&apos;t find. <Link href={`/projects/${projectId}/brand`} className="font-semibold underline">Fill in</Link>
        </p>
      )}
    </aside>
  );
}

/** One-line horizontal version for the top of the results page. */
export function BrandStrip({ projectId, profile }: { projectId: string; profile: BrandProfile }) {
  const colors = [profile.identity.primaryColor, ...profile.identity.secondaryColors, ...profile.identity.accentColors].slice(0, 5);
  const features = [...profile.product.features].sort((a, b) => Number(b.emphasized) - Number(a.emphasized)).slice(0, 3);
  return (
    <section aria-label="Brand" className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl bg-[linear-gradient(135deg,#E6F9ED_0%,#E7F8FD_100%)] px-5 py-4 text-sm ring-1 ring-black/5">
      <div className="flex min-w-0 items-center gap-2.5">
        {profile.identity.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.identity.logoUrl} alt="" referrerPolicy="no-referrer" className="h-8 w-8 rounded-md border border-line object-contain p-0.5" />
        ) : (
          <span aria-hidden className="h-8 w-8 rounded-md" style={{ background: profile.identity.primaryColor }} />
        )}
        <div className="min-w-0">
          <p className="truncate font-semibold leading-tight">{profile.product.name.value || "Unnamed product"}</p>
          <p className="truncate text-xs text-slate">{profile.product.category.value || "Category not set"}</p>
        </div>
      </div>
      <div className="flex h-5 w-28 overflow-hidden rounded" aria-label="Brand colors">{colors.map((c, i) => <span key={i} className="flex-1" style={{ background: c }} />)}</div>
      {profile.identity.typography.heading && <p className="text-xs text-slate">{profile.identity.typography.heading}</p>}
      <ul className="hidden min-w-0 flex-1 flex-wrap gap-1.5 md:flex">
        {features.map((f) => <li key={f.id} className="truncate rounded-full bg-ice px-2.5 py-0.5 text-xs">{f.value}</li>)}
      </ul>
      <div className="ml-auto flex items-center gap-3">
        {profile.missing.length > 0 && <span className="rounded-full bg-butter px-2.5 py-0.5 text-xs">{profile.missing.length} to fill in</span>}
        <Link href={`/projects/${projectId}/brand`} className="rounded-md border border-line px-2.5 py-1 text-xs font-semibold hover:border-ink">Edit brand</Link>
      </div>
    </section>
  );
}
