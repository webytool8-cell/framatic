import { Composer } from "@/components/app/composer";
import { ManualStart } from "@/components/app/manual-start";

export const metadata = { title: "New ad" };

export default function NewProject() {
  return (
    <div className="mx-auto max-w-3xl pt-6">
      <h1 className="text-display mb-3 text-5xl">What are we advertising?</h1>
      <p className="mb-10 text-lg text-slate">Paste the website. We&apos;ll take it from there.</p>
      <Composer autoFocus />
      <ManualStart />
    </div>
  );
}
