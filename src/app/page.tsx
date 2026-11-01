import Link from "next/link";
import { Composer } from "@/components/app/composer";
import { WorkspacePreview } from "@/components/landing/workspace-preview";
import { SampleReel } from "@/components/landing/sample-reel";
import { Logo } from "@/components/ui/shapes";
import { Tag } from "@/components/ui/status";
import { samplePlan } from "@/lib/samples";

function Tile({ title, body, children, className = "", soon = false }: { title: string; body: string; children: React.ReactNode; className?: string; soon?: boolean }) {
  return (
    <article className={`flex flex-col rounded-xl border border-line bg-white p-4 ${soon ? "border-dashed" : ""} ${className}`}>
      <div className="mb-3 min-h-0 flex-1">{children}</div>
      <h3 className="flex items-center gap-2 font-semibold">{title}{soon && <span className="rounded bg-butter px-1.5 py-0.5 text-[10px] font-semibold text-yellow-deep">Coming soon</span>}</h3>
      <p className="text-sm text-slate">{body}</p>
    </article>
  );
}

export default function Landing() {
  return (
    <div className="min-h-dvh overflow-x-clip bg-[#FAFAFC]">
      <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Logo />
            <nav className="hidden items-center gap-1 text-sm text-slate md:flex">
              <a href="#features" className="rounded-md px-2.5 py-1.5 hover:bg-lavender hover:text-ink">Features</a>
              <a href="#how" className="rounded-md px-2.5 py-1.5 hover:bg-lavender hover:text-ink">How it works</a>
            </nav>
          </div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Link href="/login" className="rounded-md px-3 py-1.5 hover:bg-lavender">Sign in</Link>
            <Link href="/signup" className="rounded-md bg-ink px-3 py-1.5 text-white hover:bg-black">Create account</Link>
          </div>
        </div>
      </header>

      {/* Hero: input + live example */}
      <section id="start" className="mx-auto grid max-w-[1280px] scroll-mt-20 items-center gap-8 px-4 pb-14 pt-10 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10 lg:pt-14">
        <div>
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1 text-xs font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-lime-deep" />
            AI creative director for video ads
          </p>
          <h1 className="text-display text-[clamp(2.4rem,4.4vw,3.6rem)]">
            Your website.
            <br />
            A whole new{" "}
            <span className="relative inline-block whitespace-nowrap">
              motion.
              <span aria-hidden className="absolute -bottom-[0.05em] left-[0.04em] h-[0.1em] w-[calc(100%-0.4em)] origin-left animate-[grow_700ms_var(--ease-snap)_400ms_both] rounded-full bg-coral" />
            </span>
          </h1>
          <p className="mt-4 max-w-lg text-[17px] leading-relaxed text-slate">
            Paste a link. Framatic reads your brand and product, then writes three video ad concepts with scene-by-scene storyboards you can edit in plain words.
          </p>
          <div className="mt-6">
            <Composer />
          </div>
          <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-slate">
            {["About a minute", "3 concepts per site", "Every format: 16:9, 9:16, 1:1"].map((t) => (
              <li key={t} className="flex items-center gap-1.5"><span aria-hidden className="text-lime-deep">✓</span>{t}</li>
            ))}
          </ul>
        </div>
        <WorkspacePreview plan={samplePlan} />
      </section>

      {/* How it works — a real sequence */}
      <section id="how" className="border-y border-line bg-white">
        <ol className="mx-auto grid max-w-[1280px] divide-y divide-line px-4 sm:px-6 md:grid-cols-4 md:divide-x md:divide-y-0">
          {[
            ["Paste a link", "Add a goal or pick a starting idea if you like.", "bg-cyan"],
            ["Sign in", "So we can save your brand and your concepts.", "bg-violet"],
            ["Get 3 concepts", "Brand read, scripts and storyboards in about a minute.", "bg-coral"],
            ["Tweak & pick", "Edit any line or ask for changes in plain words.", "bg-lime"],
          ].map(([t, b, c], i) => (
            <li key={t} className="flex gap-3 py-5 md:px-5 md:first:pl-0">
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${c} ${c === "bg-violet" || c === "bg-coral" ? "text-white" : "text-ink"}`}>{i + 1}</span>
              <div><p className="font-semibold">{t}</p><p className="text-sm text-slate">{b}</p></div>
            </li>
          ))}
        </ol>
      </section>

      {/* Features as working UI */}
      <section id="features" className="mx-auto max-w-[1280px] scroll-mt-20 px-4 py-14 sm:px-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-heading text-3xl">Everything happens in one workspace</h2>
          <p className="max-w-md text-sm text-slate">Examples below use a fictional brand.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Tile title="Reads your site" body="Homepage, features, pricing and about pages. Colors, fonts and logo come straight from your CSS.">
            <ul className="space-y-1.5 font-mono text-xs">
              {["/", "/features", "/pricing", "/about"].map((p, i) => (
                <li key={p} className="flex items-center justify-between rounded-md bg-[#FAFAFC] px-2 py-1.5">
                  <span>tidyflow.example{p === "/" ? "" : p}</span>
                  <span className={i < 3 ? "text-lime-deep" : "text-slate"}>{i < 3 ? "read" : "skipped"}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex gap-1.5">
              {["#14B88A", "#FF7A1A", "#1B1B1F", "#F4F4F6"].map((c) => <span key={c} className="h-6 flex-1 rounded" style={{ background: c }} title={c} />)}
            </div>
          </Tile>

          <Tile title="Facts, not guesses" body="Every claim shows where it came from. Features we can't find on your site are left out.">
            <ul className="space-y-1.5 text-xs">
              {[
                ["AI-drafted replies", "verified"],
                ["Automatic routing by topic", "verified"],
                ["Support leads at SaaS teams", "inferred"],
                ["Voice transcription", "dropped"],
              ].map(([v, t]) => (
                <li key={v} className="flex items-center justify-between gap-2 rounded-md border border-line px-2 py-1.5">
                  <span className={t === "dropped" ? "text-slate line-through" : ""}>{v}</span>
                  {t === "dropped" ? <Tag>Not on site</Tag> : <Tag tone={t as "verified" | "inferred"}>{t === "verified" ? "From site" : "AI read"}</Tag>}
                </li>
              ))}
            </ul>
          </Tile>

          <Tile title="Edit in plain words" body="Ask for a change and the concept is rewritten. Format and length requests are applied exactly.">
            <div className="space-y-2 text-xs">
              <p className="ml-auto w-fit max-w-[85%] rounded-lg rounded-br-sm bg-violet px-2.5 py-1.5 text-white">Shorter: 15 seconds, vertical. Open on the dashboard.</p>
              <p className="w-fit max-w-[85%] rounded-lg rounded-bl-sm bg-[#F2F2F6] px-2.5 py-1.5">Done: 9:16, 4 scenes, 15s. Scene 1 now opens on the product.</p>
              <div className="flex flex-wrap gap-1">
                {["Punchier", "More playful", "Stronger CTA"].map((q) => <span key={q} className="rounded-full border border-line px-2 py-0.5">{q}</span>)}
              </div>
            </div>
          </Tile>

          <Tile title="Every format" body="Pick a format up front or switch any time. The storyboard re-lays out to match.">
            <div className="flex h-full items-center justify-around gap-2 py-3">
              {[["16:9", "w-20 h-[45px]"], ["1:1", "w-12 h-12"], ["4:5", "w-11 h-[55px]"], ["9:16", "w-9 h-16"]].map(([r, cls], i) => (
                <div key={r} className="text-center">
                  <div className={`${cls} rounded-md border-2 ${["border-violet", "border-coral", "border-cyan", "border-lime-deep"][i]} bg-[#FAFAFC]`} />
                  <p className="mt-1 font-mono text-[11px] text-slate">{r}</p>
                </div>
              ))}
            </div>
          </Tile>

          <Tile title="Scene-by-scene plan" body="Timing, kinetic-type style, transitions and audio cues, all in your brand colors." className="sm:col-span-2">
            <div className="overflow-hidden rounded-md border border-line">
              <table className="w-full text-left font-mono text-[11px]">
                <thead className="bg-[#FAFAFC] text-slate"><tr><th className="px-2 py-1.5 font-medium">at</th><th className="font-medium">on screen</th><th className="font-medium">motion</th><th className="hidden font-medium sm:table-cell">transition</th><th className="hidden font-medium sm:table-cell">audio</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {[["0.0s", "“200 unread.”", "word stagger", "wipe left", "music in"], ["4.0s", "“Sorting by hand?”", "screenshot reveal", "wipe left", "—"], ["8.0s", "Meet Tidyflow", "logo reveal", "circle reveal", "beat drop"], ["12.0s", "Start free trial", "CTA end card", "cut", "hit"]].map((r) => (
                    <tr key={r[0]}>{r.map((c, i) => <td key={i} className={`px-2 py-1.5 ${i >= 3 ? "hidden sm:table-cell" : ""} ${i === 1 ? "font-sans text-xs font-semibold" : ""}`}>{c}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Tile>

          <Tile title="Three directions, every time" body="Problem → Solution, Product in Motion and Brand Manifesto. Pick one, or ask for three new ones.">
            <ul className="space-y-1.5 text-xs">
              {[["A", "bg-coral text-white", "200 unread. Then, none."], ["B", "bg-cyan", "Route. Draft. Send."], ["C", "bg-violet text-white", "Support should feel human."]].map(([s, c, t]) => (
                <li key={s} className="flex items-center gap-2 rounded-md border border-line px-2 py-1.5"><span className={`grid h-5 w-5 place-items-center rounded text-[10px] font-bold ${c}`}>{s}</span><span className="truncate font-semibold">{t}</span></li>
              ))}
            </ul>
          </Tile>

          <Tile title="Kinetic type, built in" body="Bold typography, geometric motion and music. Rendering to finished video is coming next." className="lg:row-span-2" soon>
            <div className="mx-auto max-w-[220px]"><SampleReel compact /></div>
          </Tile>

          <Tile title="Your brand, saved" body="Fix a color or star a feature once. Every future ad uses it.">
            <div className="space-y-1.5 text-xs">
              {[["Automatic routing", true], ["AI-drafted replies", true], ["Shared inbox", false]].map(([f, on]) => (
                <div key={f as string} className="flex items-center gap-2 rounded-md border border-line px-2 py-1.5">
                  <span className={on ? "text-yellow-deep" : "text-line-strong"}>★</span><span>{f as string}</span>
                </div>
              ))}
            </div>
          </Tile>

          <Tile title="Everything saved" body="Projects, brands and every storyboard version, ready when you come back." className="sm:col-span-2">
            <ul className="divide-y divide-line overflow-hidden rounded-md border border-line text-xs">
              {[
                ["Tidyflow launch", "tidyflow.example", "Concepts ready", "border-lime text-lime-deep", ["#14B88A", "#FF7A1A"]],
                ["Brightmug store", "brightmug.example", "Writing concepts", "border-yellow text-yellow-deep", ["#FF6B6B", "#FFD166"]],
                ["Spring sale teaser", "northwind.example", "Reading site", "border-cyan text-cyan-deep", ["#39C6E8", "#202124"]],
              ].map(([n, h, st, cls, pal]) => (
                <li key={n as string} className="flex items-center gap-2.5 px-2.5 py-2">
                  <span className="flex h-6 w-6 overflow-hidden rounded">{(pal as string[]).map((c) => <span key={c} className="flex-1" style={{ background: c }} />)}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{n as string}</span>
                  <span className="hidden font-mono text-slate sm:inline">{h as string}</span>
                  <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 font-semibold ${cls}`}>{st as string}</span>
                </li>
              ))}
            </ul>
          </Tile>
        </div>
      </section>

      {/* Closing */}
      <section className="mx-auto max-w-[1280px] px-4 pb-14 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-violet px-6 py-6 text-white sm:px-8">
          <div>
            <h2 className="text-heading text-2xl">What would your ad say?</h2>
            <p className="text-white/85">Find out in about a minute. All it takes is your website.</p>
          </div>
          <a href="#start" className="rounded-lg bg-white px-4 py-2.5 font-semibold text-ink hover:bg-lavender">Paste your website</a>
        </div>
      </section>

      <footer className="border-t border-line bg-white">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-3 px-4 py-5 text-sm text-slate sm:px-6">
          <Logo mono />
          <p>© {new Date().getFullYear()} Framatic</p>
        </div>
      </footer>
    </div>
  );
}
