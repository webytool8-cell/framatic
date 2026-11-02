"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/** One shared audio element so only one preview plays at a time. */
type Ctx = { playing: string | null; progress: number; play: (key: string, srcs: string[], startAt?: number, maxSec?: number) => void; stop: () => void };
const AudioCtx = createContext<Ctx | null>(null);

export function AudioPreviewProvider({ children }: { children: React.ReactNode }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const queue = useRef<string[]>([]);
  const limit = useRef<{ start: number; max: number }>({ start: 0, max: 0 });

  const stop = useCallback(() => {
    audio.current?.pause();
    queue.current = [];
    setPlaying(null);
    setProgress(0);
  }, []);

  useEffect(() => {
    const a = new Audio();
    a.preload = "auto";
    audio.current = a;
    const onTime = () => {
      const { start, max } = limit.current;
      if (max) {
        setProgress(Math.min(1, (a.currentTime - start) / max));
        if (a.currentTime - start >= max) {
          // Fade out the last bit of long previews.
          a.pause();
          setPlaying(null);
          setProgress(0);
        }
      }
    };
    const onEnded = () => {
      const next = queue.current.shift();
      if (next) {
        a.src = next;
        a.currentTime = 0;
        void a.play();
      } else {
        setPlaying(null);
        setProgress(0);
      }
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnded);
    return () => {
      a.pause();
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnded);
    };
  }, []);

  const play = useCallback((key: string, srcs: string[], startAt = 0, maxSec = 0) => {
    const a = audio.current;
    if (!a || !srcs.length) return;
    a.pause();
    const [first, ...rest] = srcs;
    queue.current = rest.slice();
    limit.current = { start: startAt, max: maxSec };
    a.src = first;
    a.currentTime = startAt;
    a.volume = 0.9;
    setPlaying(key);
    setProgress(0);
    void a.play().catch(() => setPlaying(null));
  }, []);

  return <AudioCtx.Provider value={{ playing, progress, play, stop }}>{children}</AudioCtx.Provider>;
}

export function usePreview() {
  const ctx = useContext(AudioCtx);
  if (!ctx) throw new Error("AudioPreviewProvider missing");
  return ctx;
}

/** Round play/stop button. `srcs` play one after another. */
export function PlayButton({ id, srcs, startAt, maxSec, label, size = "md" }: { id: string; srcs: string[]; startAt?: number; maxSec?: number; label: string; size?: "sm" | "md" }) {
  const { playing, play, stop, progress } = usePreview();
  const on = playing === id;
  const d = size === "sm" ? 28 : 36;
  return (
    <button
      type="button"
      aria-label={on ? `Stop ${label}` : `Play ${label}`}
      aria-pressed={on}
      onClick={() => (on ? stop() : play(id, srcs, startAt, maxSec))}
      className={cn("relative grid shrink-0 place-items-center rounded-full transition-colors", on ? "bg-ink text-white" : "bg-violet text-white hover:bg-violet-deep")}
      style={{ width: d, height: d }}
    >
      {on && maxSec ? (
        <svg aria-hidden viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
          <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(255,255,255,.3)" strokeWidth="3" />
          <circle cx="18" cy="18" r="16" fill="none" stroke="#C5F467" strokeWidth="3" strokeDasharray={`${progress * 100.5} 100.5`} />
        </svg>
      ) : null}
      {on ? (
        <svg aria-hidden viewBox="0 0 16 16" className="relative h-3 w-3"><rect x="3" y="3" width="10" height="10" rx="1.5" fill="currentColor" /></svg>
      ) : (
        <svg aria-hidden viewBox="0 0 16 16" className="relative ml-0.5 h-3.5 w-3.5"><path d="M4 2.5v11l9-5.5-9-5.5z" fill="currentColor" /></svg>
      )}
    </button>
  );
}
