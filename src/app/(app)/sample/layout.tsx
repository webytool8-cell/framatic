import Link from "next/link";
import { SAMPLE_PROJECT } from "@/lib/sample-project";

export const metadata = { title: "Sample project" };

/** Header for the read-only sample project. */
export default function SampleLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-line pb-6">
        <div className="min-w-0">
          <nav aria-label="Breadcrumb" className="mb-0.5 text-xs text-slate">
            <Link href="/dashboard" className="hover:text-ink">Projects</Link> <span aria-hidden>/</span>
          </nav>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-heading truncate text-3xl">{SAMPLE_PROJECT.name}</h1>
            <span className="rounded-full bg-butter px-2.5 py-0.5 text-xs font-semibold text-yellow-deep">Sample</span>
            <span className="font-mono text-xs text-slate">{SAMPLE_PROJECT.host}</span>
          </div>
        </div>
        <Link href="/projects/new" className="rounded-lg bg-violet px-4 py-2 text-sm font-semibold text-white hover:bg-violet-deep">Start your own project</Link>
      </div>
      <p className="mb-8 rounded-xl border border-yellow/60 bg-butter/50 px-4 py-3 text-sm">
        <span className="font-semibold">This is a sample project for a fictional store.</span> Look around, play the ads and try the editor. Nothing here is saved, and exports are turned off.
      </p>
      {children}
    </div>
  );
}
