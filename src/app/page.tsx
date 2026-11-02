import { HeroStage, PlatformStrip } from "@/components/landing/hero-stage";
import { AdGallery } from "@/components/landing/ad-gallery";
import { ScenePreview } from "@/components/app/scene-preview";
import { SiteFooter, SiteHeader } from "@/components/landing/site-chrome";
import { Tag } from "@/components/ui/status";
import { sampleVerticalPlan } from "@/lib/samples";
import { MusicTeaser } from "@/components/landing/music-teaser";

function Tile({ title, body, children, className = "", soon = false }: { title: string; body: string; children: React.ReactNode; className?: string; soon?: boolean }) {
  return (
    <article className={`flex flex-col rounded-2xl bg-white p-5 shadow-[0_18px_36px_-28px_rgba(32,33,36,0.4)] ring-1 ring-black/5 ${soon ? "ring-dashed" : ""} ${className}`}>
      <div className="mb-4 min-h-0 flex-1">{children}</div>
      <h3 className="flex items-center gap-2 font-semibold">{title}{soon && <span className="rounded bg-butter px-1.5 py-0.5 text-[10px] font-semibold text-yellow-deep">Coming soon</span>}</h3>
      <p className="text-sm text-slate">{body}</p>
    </article>
  );
}

/** A full-width band with its own colour, so sections are clearly separated. */
function Band({ id, tone, children, className = "" }: { id?: string; tone: "hero" | "blush" | "violet" | "warm" | "fresh" | "night"; children: React.ReactNode; className?: string }) {
  const tones = {
    hero: "bg-[radial-gradient(1200px_600px_at_0%_0%,#F0EBFF_0%,transparent_60%),radial-gradient(900px_500px_at_100%_20%,#E7F8FD_0%,transparent_55%),linear-gradient(180deg,#FFFFFF_0%,#FFFFFF_100%)]",
    blush: "bg-[radial-gradient(900px_420px_at_100%_0%,#FFE3EC_0%,transparent_60%),linear-gradient(180deg,#F7F3FF_0%,#FFF4F0_100%)]",
    violet: "bg-[linear-gradient(135deg,#7957FF_0%,#5A3AE6_55%,#4326C2_100%)] text-white",
    warm: "bg-[linear-gradient(180deg,#FFF0E8_0%,#FFF8E1_100%)]",
    fresh: "bg-[linear-gradient(160deg,#E6F9ED_0%,#E7F8FD_100%)]",
    night: "bg-[radial-gradient(800px_400px_at_85%_0%,rgba(121,87,255,0.55)_0%,transparent_60%),linear-gradient(180deg,#1B1A24_0%,#202124_100%)] text-white",
  } as const;
  return (
    <section id={id} className={`relative scroll-mt-16 ${tones[tone]} ${className}`}>
      <div className="mx-auto max-w-[1200px] px-5 py-24 sm:px-8 md:py-32">{children}</div>
    </section>
  );
}

function SectionHead({ kicker, title, body, light = false }: { kicker: string; title: string; body?: string; light?: boolean }) {
  return (
    <div className="mb-14 max-w-2xl">
      <p className={`mb-3 text-sm font-semibold ${light ? "text-lime" : "text-violet-deep"}`}>{kicker}</p>
      <h2 className="text-display text-[clamp(2.2rem,4.6vw,3.6rem)]">{title}</h2>
      {body && <p className={`mt-4 text-lg leading-relaxed ${light ? "text-white/80" : "text-slate"}`}>{body}</p>}
    </div>
  );
}

export default function Landing() {
  return (
    <div className="min-h-dvh overflow-x-clip bg-white">
      <SiteHeader />

      {/* 1 · Hero */}
      <Band id="start" tone="hero">
        <HeroStage>
          <p className="mb-6 inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-sm font-medium shadow-sm ring-1 ring-black/5">
            <span className="h-2 w-2 rounded-full bg-lime-deep" />
            AI video ads for online stores and digital products
          </p>
          <h1 className="text-display text-[clamp(2.4rem,4.2vw,3.6rem)]">
            Your product.
            <br />
            A whole new{" "}
            <span className="relative inline-block whitespace-nowrap">
              motion.
              <span aria-hidden className="absolute -bottom-[0.05em] left-[0.04em] h-[0.1em] w-[calc(100%-0.4em)] origin-left animate-[grow_700ms_var(--ease-snap)_400ms_both] rounded-full bg-coral" />
            </span>
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-slate">
            Paste a link to your store, a product page or your app. Framatic turns what you sell into three scroll-stopping video ads: scripted, storyboarded, set to music and ready to post.
          </p>
        </HeroStage>
        <PlatformStrip />
      </Band>

      {/* 2 · Gallery */}
      <Band id="examples" tone="blush">
        <SectionHead kicker="Made with Framatic" title="Real output, playing live" body="Four sample products, four placements. These aren't screen recordings: each ad is rendered right now by the same engine that exports your MP4. Brands are fictional." />
        <AdGallery />
      </Band>

      {/* 3 · How it works */}
      <Band id="how" tone="violet">
        <SectionHead light kicker="How it works" title="One product link in. Three ads out." body="You bring what you sell. The AI does the reading, the copywriting and the storyboarding." />
        <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Paste a product link", "A store, a product page or your app. Add an offer or goal if you have one.", "bg-cyan text-ink"],
            ["Sign in", "So we can save your brand, products, concepts and videos.", "bg-yellow text-ink"],
            ["Get 3 ad concepts", "Hooks, scripts, storyboards and music in a minute or two.", "bg-coral text-white"],
            ["Tweak & post", "Ask for changes in plain words, export the MP4 and run it.", "bg-lime text-ink"],
          ].map(([t, b, c], i) => (
            <li key={t} className="rounded-2xl bg-white/10 p-6 ring-1 ring-white/20 backdrop-blur">
              <span className={`mb-8 grid h-10 w-10 place-items-center rounded-full text-sm font-bold ${c}`}>{i + 1}</span>
              <p className="text-heading text-xl">{t}</p>
              <p className="mt-2 text-white/75">{b}</p>
            </li>
          ))}
        </ol>
      </Band>

      {/* 4 · Features */}
      <Band id="features" tone="warm">
        <SectionHead kicker="Features" title="From product page to ready-to-run ad" body="Everything happens in one workspace. Examples use a fictional store." />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Tile title="Reads your store" body="Product, collection, pricing and about pages. Your colors, fonts and logo come straight from the site.">
            <ul className="space-y-1.5 font-mono text-xs">
              {["/", "/products/lumen-mug", "/collections/bestsellers", "/account"].map((p, i) => (
                <li key={p} className="flex items-center justify-between rounded-md bg-[#FAFAFC] px-2 py-1.5">
                  <span className="truncate">lumenmug.example{p === "/" ? "" : p}</span>
                  <span className={i < 3 ? "text-lime-deep" : "text-slate"}>{i < 3 ? "read" : "skipped"}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex gap-1.5">
              {["#E8572A", "#2B2D42", "#F2C14E", "#F7F3EE"].map((c) => <span key={c} className="h-6 flex-1 rounded" style={{ background: c }} title={c} />)}
            </div>
          </Tile>

          <Tile title="Facts, not guesses" body="Every claim links to where it came from. Features, prices or offers we can't find on your page are left out.">
            <ul className="space-y-1.5 text-xs">
              {[
                ["Keeps coffee hot for 3 hours", "verified"],
                ["Free shipping over $50", "verified"],
                ["Busy remote workers", "inferred"],
                ["Wireless charging", "dropped"],
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
              <p className="ml-auto w-fit max-w-[85%] rounded-lg rounded-br-sm bg-violet px-2.5 py-1.5 text-white">15 seconds, vertical. Open on the product, mention free shipping.</p>
              <p className="w-fit max-w-[85%] rounded-lg rounded-bl-sm bg-[#F2F2F6] px-2.5 py-1.5">Done: 9:16, 4 scenes, 15s. Opens on the mug, free shipping in the end card.</p>
              <div className="flex flex-wrap gap-1">
                {["More urgency", "Feature the bestseller", "Stronger CTA"].map((q) => <span key={q} className="rounded-full border border-line px-2 py-0.5">{q}</span>)}
              </div>
            </div>
          </Tile>

          <Tile title="Every placement" body="Reels, TikTok, Stories, YouTube and feeds. Switch format any time and the storyboard re-lays out.">
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
                  {[["0.0s", "“Cold coffee. Again.”", "word stagger", "wipe left", "swipe up"], ["2.5s", "“Hot for 3 hours.”", "product reveal", "circle reveal", "pop"], ["6.0s", "3 hours of perfect sips", "stat counter", "zoom through", "impact"], ["8.5s", "Shop now", "CTA end card", "cut", "hit"]].map((r) => (
                    <tr key={r[0]}>{r.map((c, i) => <td key={i} className={`px-2 py-1.5 ${i >= 3 ? "hidden sm:table-cell" : ""} ${i === 1 ? "font-sans text-xs font-semibold" : ""}`}>{c}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Tile>

          <Tile title="Three angles to test" body="Problem → Solution, Product in Motion and Brand Manifesto. Run them side by side and keep the winner.">
            <ul className="space-y-1.5 text-xs">
              {[["A", "bg-coral text-white", "Cold coffee? Never again."], ["B", "bg-cyan", "Sip. Set. Stay hot."], ["C", "bg-violet text-white", "Good mornings deserve better."]].map(([s, c, t]) => (
                <li key={s} className="flex items-center gap-2 rounded-md border border-line px-2 py-1.5"><span className={`grid h-5 w-5 place-items-center rounded text-[10px] font-bold ${c}`}>{s}</span><span className="truncate font-semibold">{t}</span></li>
              ))}
            </ul>
          </Tile>

          <Tile title="Live motion preview" body="Kinetic type, geometric motion and transitions, set to original music with cuts on the beat, then exported to MP4." className="lg:row-span-2">
            <div className="mx-auto max-w-[220px]"><ScenePreview plan={sampleVerticalPlan} productName="Lumen" autoPlay controls={false} compact /></div>
          </Tile>

          <Tile title="Your brand, saved" body="Star your best products and selling points once. Every future ad uses them.">
            <div className="space-y-1.5 text-xs">
              {[["3-hour heat", true], ["Dishwasher-safe lid", true], ["Gift box", false]].map(([f, on]) => (
                <div key={f as string} className="flex items-center gap-2 rounded-md border border-line px-2 py-1.5">
                  <span className={on ? "text-yellow-deep" : "text-line-strong"}>★</span><span>{f as string}</span>
                </div>
              ))}
            </div>
          </Tile>

          <Tile title="Every product, every campaign" body="Launches, promos and evergreen ads for each product, with every version saved." className="sm:col-span-2">
            <ul className="divide-y divide-line overflow-hidden rounded-md border border-line text-xs">
              {[
                ["Lumen Mug launch", "lumenmug.example", "Concepts ready", "border-lime text-lime-deep", ["#E8572A", "#2B2D42"]],
                ["Black Friday promo", "northwind.example", "Writing concepts", "border-yellow text-yellow-deep", ["#FF6B6B", "#FFD166"]],
                ["Course launch teaser", "learnloop.example", "Reading page", "border-cyan text-cyan-deep", ["#39C6E8", "#202124"]],
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
      </Band>

      {/* 5 · Sound */}
      <Band id="sound" tone="fresh">
        <SectionHead kicker="Music & sound" title="Sounds as good as it looks" body="Every ad gets a track that fits the product. Cuts and transitions land on the beat, and the music sits under your message. Press play." />
        <MusicTeaser />
      </Band>

      {/* 6 · Closing */}
      <Band tone="night">
        <div className="flex flex-col items-start gap-8 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="mb-3 text-sm font-semibold text-lime">Ready when you are</p>
            <h2 className="text-display text-[clamp(2.4rem,5vw,4rem)]">What would your product&apos;s ad look like?</h2>
            <p className="mt-4 text-lg text-white/75">Find out in a couple of minutes. All it takes is a link to what you sell.</p>
          </div>
          <a href="#start" className="rounded-xl bg-lime px-6 py-4 text-lg font-semibold text-ink transition-transform hover:-translate-y-0.5">Paste a product link</a>
        </div>
      </Band>

      <SiteFooter />
    </div>
  );
}
