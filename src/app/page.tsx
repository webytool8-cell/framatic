import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Circle, HalfDisc, Logo, Ring } from "@/components/ui/shapes";
import { Tag } from "@/components/ui/status";
import { SampleReel } from "@/components/landing/sample-reel";
import { Composer } from "@/components/app/composer";

const STEPS = [
  { name: "Paste your website", body: "That's the only thing we need. Add a goal if you have one.", color: "#39C6E8", live: true },
  { name: "AI does the heavy lifting", body: "It reads your brand and product, then writes three ad concepts with full storyboards.", color: "#7957FF", live: true },
  { name: "Tweak in plain words", body: "“Make it punchier.” “15 seconds, vertical.” Or edit any line yourself.", color: "#FF6B6B", live: true },
  { name: "Render & export", body: "Turn the storyboard into a finished video in every format.", color: "#C5F467", live: false },
];

const CONCEPTS = [
  { slot: "A", name: "Problem → Solution", color: "bg-coral text-white", border: "border-coral", line: "200 unread. Then, none.", body: "Opens on a pain your audience knows, then shows your product as the way out." },
  { slot: "B", name: "Product in Motion", color: "bg-cyan text-ink", border: "border-cyan", line: "Route. Draft. Send.", body: "Your real interface, front and centre, with your best features called out." },
  { slot: "C", name: "Brand Manifesto", color: "bg-violet text-white", border: "border-violet", line: "Support should feel human.", body: "Bold type and geometry set to music, building to a logo reveal." },
];

export default function Landing() {
  return (
    <div className="overflow-x-clip">
      <header className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Logo />
        <nav className="flex items-center gap-1 text-sm font-semibold">
          <a href="#how" className="hidden rounded-lg px-3 py-2 hover:bg-lavender sm:block">How it works</a>
          <Link href="/login" className="rounded-lg px-3 py-2 hover:bg-lavender">Sign in</Link>
        </nav>
      </header>

      {/* Hero: the input is the product */}
      <section id="start" className="relative mx-auto max-w-4xl scroll-mt-10 px-5 pb-24 pt-12 sm:px-8 sm:pt-20">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <Circle className="absolute -left-40 top-4 h-72 w-72 animate-drift" color="#F0EBFF" />
          <Ring className="absolute -right-24 top-24 hidden h-28 w-28 animate-drift-slow md:block" color="#39C6E8" stroke={14} />
          <HalfDisc className="absolute -right-10 bottom-4 hidden h-16 w-32 md:block" color="#FFD166" />
          <Circle className="absolute -left-6 bottom-24 hidden h-6 w-6 md:block" color="#FF6B6B" />
        </div>
        <h1 className="text-display text-[clamp(2.9rem,7.6vw,5.6rem)]">
          <span className="hero-line">Your website.</span>
          <span className="hero-line [animation-delay:160ms]">
            A whole new{" "}
            <span className="relative inline-block whitespace-nowrap">
              motion.
              <span aria-hidden className="absolute -bottom-[0.06em] left-[0.04em] h-[0.11em] w-[calc(100%-0.4em)] origin-left animate-[grow_700ms_var(--ease-snap)_650ms_both] rounded-full bg-coral" />
            </span>
          </span>
        </h1>
        <p className="mt-6 max-w-2xl animate-rise text-lg leading-relaxed text-slate [animation-delay:380ms] sm:text-xl">
          Paste a link. Framatic reads your brand and product, then pitches three video ad concepts with kinetic typography, motion graphics and scene-by-scene storyboards.
        </p>
        <div className="mt-10 animate-rise [animation-delay:480ms]">
          <Composer autoFocus />
        </div>
        <p className="mt-6 text-sm text-slate">You&apos;ll sign in next so we can save your work. Video rendering is coming soon; today you get concepts and storyboards.</p>
      </section>

      {/* How it works */}
      <section id="how" className="border-y border-line bg-white py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <h2 className="text-display mb-14 max-w-3xl text-[clamp(2.2rem,5vw,3.6rem)]">One link in. Three ads out.</h2>
          <ol className="grid gap-px overflow-hidden rounded-[var(--radius-card)] border-[1.5px] border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.name} className="bg-white p-7">
                <div className="mb-6 flex items-center justify-between">
                  <span className="grid h-10 w-10 place-items-center rounded-full text-sm font-bold" style={{ background: s.color, color: s.color === "#7957FF" ? "#fff" : "#202124" }}>{i + 1}</span>
                  {!s.live && <Tag>Coming soon</Tag>}
                </div>
                <h3 className={`text-heading mb-2 text-xl ${s.live ? "" : "text-slate"}`}>{s.name}</h3>
                <p className="text-slate">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Concepts + sample */}
      <section className="bg-lavender py-24">
        <div className="mx-auto grid max-w-7xl items-start gap-12 px-5 sm:px-8 lg:grid-cols-[1.5fr_1fr]">
          <div>
            <h2 className="text-display mb-4 text-[clamp(2.2rem,5vw,3.6rem)]">Three pitches, not one guess</h2>
            <p className="mb-10 max-w-xl text-lg text-slate">
              Every concept is built from what&apos;s actually on your site. Facts are linked to where we found them, and nothing gets invented: no fake features, no made-up testimonials.
            </p>
            <div className="grid gap-4">
              {CONCEPTS.map((c) => (
                <article key={c.slot} className={`flex gap-5 rounded-[var(--radius-card)] border-2 ${c.border} bg-white p-5`}>
                  <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-lg font-bold ${c.color}`}>{c.slot}</span>
                  <div>
                    <h3 className="text-heading text-xl">{c.name}</h3>
                    <p className="mb-2 text-slate">{c.body}</p>
                    <p className="font-bold">“{c.line}”</p>
                  </div>
                </article>
              ))}
            </div>
            <p className="mt-4 text-sm text-slate">Sample headlines for a fictional brand.</p>
          </div>
          <div className="mx-auto w-full max-w-sm">
            <SampleReel />
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-5 py-24 sm:px-8">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[28px] bg-violet px-8 py-20 text-white sm:px-16">
          <Circle aria-hidden className="absolute -right-16 -top-16 h-64 w-64" color="#FF6B6B" />
          <Ring aria-hidden className="absolute bottom-10 right-1/3 h-16 w-16" color="#C5F467" stroke={16} />
          <HalfDisc aria-hidden className="absolute -bottom-1 right-12 h-20 w-40" color="#FFD166" />
          <div className="relative max-w-2xl">
            <h2 className="text-display mb-5 text-[clamp(2.4rem,6vw,4.4rem)]">What would your ad say?</h2>
            <p className="mb-9 text-lg text-white/85">Find out in about a minute. All it takes is your website.</p>
            <ButtonLink href="#start" size="lg" variant="ink">Paste your website</ButtonLink>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 border-t border-line px-5 py-8 text-sm text-slate sm:px-8">
        <Logo mono />
        <p>© {new Date().getFullYear()} Framatic</p>
      </footer>
    </div>
  );
}
