export const dynamic = "force-dynamic";

import { Sidebar, type SidebarProject } from "@/components/app/sidebar";
import { createServiceClient, requireUser } from "@/lib/supabase/server";
import { getBalance } from "@/lib/credits";
import { effectiveStatus, type ProjectRow } from "@/lib/types";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("projects")
    .select("id, name, status, status_message, status_updated_at, brand_profiles(profile)")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(15);
  type Row = Pick<ProjectRow, "id" | "name" | "status" | "status_message" | "status_updated_at"> & { brand_profiles: { profile: { identity?: { primaryColor?: string } } } | null };
  const projects: SidebarProject[] = ((data ?? []) as unknown as Row[]).map((p) => ({
    id: p.id,
    name: p.name,
    status: effectiveStatus(p).status,
    color: p.brand_profiles?.profile?.identity?.primaryColor ?? null,
  }));

  // Ledger functions are server-only, so balances are read with the service client.
  const balance = await getBalance(createServiceClient(), user.id).catch(() => null);
  const credits = balance ? { left: balance.unlimited ? 0 : balance.left, allowance: balance.unlimited ? 0 : balance.allowance, unlimited: balance.unlimited } : null;

  return (
    <div className="min-h-dvh bg-[#FAFAFC]">
      <Sidebar projects={projects} email={user.email ?? null} credits={credits} />
      <main className="px-4 pb-24 pt-8 sm:px-8 lg:ml-60 lg:px-12 lg:pt-10">
        <div className="mx-auto max-w-[1400px]">{children}</div>
      </main>
    </div>
  );
}
