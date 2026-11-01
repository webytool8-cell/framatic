import { ButtonLink } from "@/components/ui/button";
import { Circle, Ring } from "@/components/ui/shapes";

export default function NotFound() {
  return (
    <main className="relative mx-auto grid min-h-dvh max-w-xl place-items-center px-6 text-center">
      <div>
        <div aria-hidden className="relative mx-auto mb-8 h-28 w-28">
          <Ring className="absolute inset-0" color="#39C6E8" stroke={12} />
          <Circle className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2" color="#FF6B6B" />
        </div>
        <h1 className="text-display mb-3 text-5xl">Nothing in frame</h1>
        <p className="mb-8 text-slate">That page doesn&apos;t exist, or you don&apos;t have access to it.</p>
        <ButtonLink href="/dashboard">Back to projects</ButtonLink>
      </div>
    </main>
  );
}
