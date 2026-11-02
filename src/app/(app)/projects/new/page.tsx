import { Composer } from "@/components/app/composer";
import { ManualStart } from "@/components/app/manual-start";
import { getCreditCosts } from "@/lib/billing-config";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "New ad" };

export default async function NewProject() {
  const { supabase } = await requireUser();
  const costs = await getCreditCosts(supabase);
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-heading mb-1 text-2xl">New ad</h1>
      <p className="mb-5 text-sm text-slate">Paste a link to your store, a product page or your app. Framatic reads it and writes three ad concepts, usually in 1–2 minutes. Uses {costs.analyze} credits.</p>
      <section className="rounded-xl border border-line bg-white p-4 sm:p-5">
        <Composer size="md" autoFocus />
        <ManualStart />
      </section>
    </div>
  );
}
