export const dynamic = "force-dynamic";

import { AppHeader } from "@/components/app/app-header";
import { requireUser } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireUser();
  return (
    <div className="min-h-dvh">
      <AppHeader email={user.email} />
      <main className="mx-auto max-w-7xl px-5 pb-24 pt-8 sm:px-8">{children}</main>
    </div>
  );
}
