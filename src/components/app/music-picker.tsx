"use client";
import { useState } from "react";
import { MUSIC_LIBRARY, trackById } from "@/video/music";
import { cn } from "@/lib/cn";

/** Pick the soundtrack. Changing it re-cuts scenes on the new track's beat. */
export function MusicPicker({
  track,
  volume,
  disabled,
  onChange,
}: {
  track: string | undefined;
  volume: number;
  disabled?: boolean;
  onChange: (track: string, volume: number) => void;
}) {
  const [vol, setVol] = useState(volume);
  const current = trackById(track);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-line bg-[#FAFAFC] px-3 py-2 text-sm">
      <span className="flex items-center gap-1.5 font-semibold">
        <svg aria-hidden viewBox="0 0 16 16" className="h-4 w-4"><path d="M6 12.5V3.5l7-1.5v9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><circle cx="4.5" cy="12.5" r="1.8" fill="currentColor" /><circle cx="11.5" cy="11" r="1.8" fill="currentColor" /></svg>
        Music
      </span>
      <label className="sr-only" htmlFor="music-track">Track</label>
      <select
        id="music-track"
        value={current ? current.id : "none"}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value, vol)}
        className="h-8 rounded-md border border-line bg-white px-2 text-sm focus:border-violet focus:outline-none disabled:opacity-50"
      >
        {MUSIC_LIBRARY.map((t) => (
          <option key={t.id} value={t.id}>{t.title} · {t.bpm} bpm</option>
        ))}
        <option value="none">No music</option>
      </select>
      {current && (
        <label className="flex items-center gap-2 text-xs text-slate">
          Volume
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={vol}
            disabled={disabled}
            onChange={(e) => setVol(+e.target.value)}
            onPointerUp={() => vol !== volume && onChange(current.id, vol)}
            onKeyUp={() => vol !== volume && onChange(current.id, vol)}
            className="w-24 accent-violet"
          />
        </label>
      )}
      <span className={cn("ml-auto text-xs text-slate")}>{current ? "Scenes cut on the beat" : "Silent"}</span>
    </div>
  );
}
