import Link from "next/link";
import type { BrandProfile } from "@/lib/brand/schema";

/** Compact read-only view of what the ads are built from, with a way in to edit. */
export function BrandSummary({ projectId, profile }: { projectId: string; profile: BrandProfile }) {
  const colors = [profile.identity.primaryColor, ...profile.identity.secondaryColors, ...profile.identity.accentColors].slice(0, 5);
  const features = [...profile.product.features].sort((a, b) => Number(b.emphasized) - Number(a.emphasized)).slice(0, 3);
  return (
    <aside className="rounded-[var(--radius-card)] border-[1.5px] border-line bg-white p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-heading text-lg">Built from your brand</h2>
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
