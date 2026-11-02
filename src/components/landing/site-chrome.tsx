import Link from "next/link";
import { Logo } from "@/components/ui/shapes";

const NAV: [string, string][] = [
  ["/#examples", "Examples"],
  ["/#how", "How it works"],
  ["/#features", "Features"],
  ["/pricing", "Pricing"],
];

/** Public site header (landing + pricing). */
export function SiteHeader({ signedIn = false, active }: { signedIn?: boolean; active?: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-black/5 bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-5 sm:px-8">
        <div className="flex items-center gap-8">
          <Link href="/" aria-label="Framatic home"><Logo /></Link>
          <nav className="hidden items-center gap-1 text-sm text-slate md:flex">
            {NAV.map(([href, label]) => (
              <Link key={href} href={href} aria-current={active === href ? "page" : undefined} className={`rounded-md px-3 py-1.5 hover:bg-lavender hover:text-ink ${active === href ? "font-semibold text-ink" : ""}`}>
                {label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2 text-sm font-semibold">
          {signedIn ? (
            <Link href="/dashboard" className="rounded-lg bg-ink px-4 py-2 text-white hover:bg-black">Open Framatic</Link>
          ) : (
            <>
              <Link href="/pricing" className="rounded-lg px-3 py-2 hover:bg-lavender md:hidden">Pricing</Link>
              <Link href="/login" className="rounded-lg px-3 py-2 hover:bg-lavender">Sign in</Link>
              <Link href="/signup" className="hidden rounded-lg bg-ink px-4 py-2 text-white hover:bg-black sm:inline-block">Create account</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-white">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-5 py-10 text-sm text-slate sm:px-8">
        <Logo mono />
        <nav className="flex gap-5">
          <Link href="/pricing" className="hover:text-ink">Pricing</Link>
          <Link href="/login" className="hover:text-ink">Sign in</Link>
        </nav>
        <p>© {new Date().getFullYear()} Framatic</p>
      </div>
    </footer>
  );
}
