import Link from "next/link";
import { Logo } from "@/components/ui/shapes";
import { signOut } from "@/app/actions/auth";

export function AppHeader({ email }: { email?: string | null }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link href="/dashboard" aria-label="Framatic dashboard">
          <Logo />
        </Link>
        <nav className="flex items-center gap-1 text-sm font-medium">
          <Link href="/dashboard" className="rounded-lg px-3 py-2 hover:bg-lavender">Projects</Link>
          <Link href="/settings" className="rounded-lg px-3 py-2 hover:bg-lavender">Settings</Link>
          {email && <span className="ml-2 hidden max-w-48 truncate text-slate md:inline">{email}</span>}
          <form action={signOut}>
            <button className="ml-1 rounded-lg px-3 py-2 text-slate hover:bg-peach hover:text-ink">Sign out</button>
          </form>
        </nav>
      </div>
    </header>
  );
}
