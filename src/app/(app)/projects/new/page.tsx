import { Composer } from "@/components/app/composer";
import { ManualStart } from "@/components/app/manual-start";

export const metadata = { title: "New ad" };

export default function NewProject() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-heading mb-1 text-2xl">New ad</h1>
      <p className="mb-5 text-sm text-slate">Paste the website. Framatic reads it and writes three concepts, usually in about a minute.</p>
      <section className="rounded-xl border border-line bg-white p-4 sm:p-5">
        <Composer size="md" autoFocus />
        <ManualStart />
      </section>
    </div>
  );
}
