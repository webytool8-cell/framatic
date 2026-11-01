import Link from "next/link";
import { Arc, Circle, Dots, HalfDisc, Logo, Ring } from "@/components/ui/shapes";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Link href="/" aria-label="Framatic home"><Logo /></Link>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">{children}</div>
      </div>
      <aside aria-hidden className="relative hidden overflow-hidden border-l border-line bg-lavender lg:block">
        <Circle className="absolute -left-16 top-24 h-64 w-64 animate-drift" color="#7957FF" />
        <Ring className="absolute right-16 top-16 h-40 w-40 animate-drift-slow" color="#39C6E8" stroke={14} />
        <HalfDisc className="absolute bottom-0 right-1/4 h-36 w-72" color="#FFD166" />
        <Arc className="absolute bottom-40 left-24 h-24 w-48 animate-drift-slow" color="#FF6B6B" stroke={16} />
        <Dots className="absolute right-24 bottom-56 h-12 w-20" />
        <div className="absolute inset-x-16 top-1/2 -translate-y-1/2">
          <p className="text-display text-6xl xl:text-7xl">Your website.<br /><span className="text-violet-deep">A whole new</span> motion.</p>
        </div>
      </aside>
    </div>
  );
}
