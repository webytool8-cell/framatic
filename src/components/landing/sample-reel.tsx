"use client";
import { useEffect, useState } from "react";

/**
 * Illustrative motion sketch for a fictional brand. Built with CSS, clearly
 * labeled — Framatic does not render video yet.
 */
const SCENES = [
  { t: "200 unread.", sub: "Monday, 9:02am", bg: "#FFFFFF", ink: "#202124", shape: "burst" },
  { t: "Sorting by hand?", sub: "Every. Single. Ticket.", bg: "#FF6B6B", ink: "#202124", shape: "split" },
  { t: "Meet Tidyflow", sub: "Your inbox, routed and drafted.", bg: "#7957FF", ink: "#FFFFFF", shape: "ring" },
  { t: "Inbox zero, daily.", sub: "Start free trial", bg: "#C5F467", ink: "#202124", shape: "cta" },
] as const;

export function SampleReel({ compact = false }: { compact?: boolean }) {
  const [i, setI] = useState(0);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const iv = setInterval(() => setI((n) => (n + 1) % SCENES.length), 2200);
    return () => clearInterval(iv);
  }, []);
  const s = SCENES[i];

  return (
    <figure className="relative">
      <div className={`relative overflow-hidden border-2 border-ink transition-colors duration-500 ${compact ? "aspect-[9/16] rounded-xl" : "aspect-[4/5] rounded-[22px]"}`} style={{ background: s.bg, color: s.ink }}>
        {s.shape === "burst" && (
          <div key={`b${i}`} aria-hidden>
            <span className="absolute -right-10 -top-10 h-44 w-44 animate-pop rounded-full bg-violet" />
            <span className="absolute left-8 top-16 h-16 w-16 animate-pop rounded-full border-[10px] border-cyan [animation-delay:120ms]" />
          </div>
        )}
        {s.shape === "split" && <span key={`s${i}`} aria-hidden className="absolute inset-y-0 right-0 w-2/5 origin-right animate-[rise_400ms_var(--ease-snap)_both] bg-yellow" />}
        {s.shape === "ring" && <span key={`r${i}`} aria-hidden className="absolute left-1/2 top-[18%] h-28 w-28 -translate-x-1/2 animate-pop rounded-full border-[14px] border-lime" />}
        {s.shape === "cta" && <span key={`c${i}`} aria-hidden className="absolute -bottom-20 -left-16 h-56 w-56 animate-pop rounded-full bg-violet" />}

        <div className={`absolute ${compact ? "inset-x-4 bottom-6" : "inset-x-7 bottom-10"}`}>
          <p key={`t${i}`} className={`text-display ${compact ? "text-[2rem]" : "text-[clamp(2.4rem,6vw,3.6rem)]"}`}>
            {s.t.split(" ").map((w, k) => (
              <span key={k} className="mr-[0.22em] inline-block animate-rise" style={{ animationDelay: reduced ? "0ms" : `${k * 90}ms` }}>{w}</span>
            ))}
          </p>
          {s.shape === "cta" ? (
            <span key={`cta${i}`} className="mt-4 inline-block animate-pop rounded-full bg-ink px-5 py-2.5 font-semibold text-white [animation-delay:250ms]">{s.sub}</span>
          ) : (
            <p key={`sub${i}`} className="mt-3 animate-rise text-lg opacity-80 [animation-delay:250ms]">{s.sub}</p>
          )}
        </div>
        <div className={`absolute flex gap-1.5 ${compact ? "inset-x-4 top-4" : "inset-x-7 top-6"}`} aria-hidden>
          {SCENES.map((_, k) => (
            <span key={k} className="h-1 flex-1 overflow-hidden rounded-full bg-black/15">
              <span className={`block h-full rounded-full bg-current ${k < i ? "w-full" : k === i ? "w-full origin-left animate-[grow_2200ms_linear_both]" : "w-0"}`} />
            </span>
          ))}
        </div>
      </div>
      {!compact && <figcaption className="mt-3 text-sm text-slate">Illustrative motion sketch for a fictional brand. Video rendering is in development.</figcaption>}
    </figure>
  );
}
