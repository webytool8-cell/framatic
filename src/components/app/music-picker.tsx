"use client";
import Link from "next/link";
import { useState } from "react";
import { MUSIC_LIBRARY, SOUND_SETS, musicPath, trackById, transitionPath } from "@/video/music";
import { AudioPreviewProvider, PlayButton } from "./audio-preview";

const src = (p: string) => `/${p}`;

/** Soundtrack controls under the preview: track, volume and transition sounds, each with a listen button. */
export function MusicPicker({
  track,
  volume,
  soundSet,
  disabled,
  onChange,
  stacked = false,
}: {
  track: string | undefined;
  volume: number;
  soundSet: string | undefined;
  disabled?: boolean;
  onChange: (track: string, volume: number, soundSet: string) => void;
  /** Labels above the controls, for narrow side panels. */
  stacked?: boolean;
}) {
  const labelCls = stacked ? "w-full text-xs" : "w-24 shrink-0";
  const [vol, setVol] = useState(volume);
  const current = trackById(track);
  const set = SOUND_SETS.find((s) => s.id === soundSet);
  const setId = soundSet === "off" ? "off" : (set?.id ?? "airy");
  const commitVol = () => vol !== volume && current && onChange(current.id, vol, setId);

  return (
    <AudioPreviewProvider>
      <div className="space-y-2 rounded-lg border border-line bg-[#FAFAFC] p-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`${labelCls} font-semibold`}>Music</span>
          <label className="sr-only" htmlFor="music-track">Track</label>
          <select
            id="music-track"
            value={current ? current.id : "none"}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value, vol, setId)}
            className="h-8 min-w-0 flex-1 rounded-md border border-line bg-white px-2 text-sm focus:border-violet focus:outline-none disabled:opacity-50 sm:max-w-64"
          >
            {MUSIC_LIBRARY.map((t) => (
              <option key={t.id} value={t.id}>{t.title} · {t.bpm} bpm</option>
            ))}
            <option value="none">No music</option>
          </select>
          {current && <PlayButton id={`track-${current.id}`} srcs={[src(musicPath(current.id))]} startAt={current.startAtSec} maxSec={20} label={current.title} size="sm" />}
          {current && (
            <label className="ml-auto flex items-center gap-2 text-xs text-slate">
              Volume
              <input type="range" min={0} max={1} step={0.05} value={vol} disabled={disabled} onChange={(e) => setVol(+e.target.value)} onPointerUp={commitVol} onKeyUp={commitVol} className="w-24 accent-violet" />
            </label>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`${labelCls} font-semibold`}>Transitions</span>
          <label className="sr-only" htmlFor="sound-set">Transition sounds</label>
          <select
            id="sound-set"
            value={setId}
            disabled={disabled}
            onChange={(e) => onChange(current ? current.id : "none", vol, e.target.value)}
            className="h-8 min-w-0 flex-1 rounded-md border border-line bg-white px-2 text-sm focus:border-violet focus:outline-none disabled:opacity-50 sm:max-w-64"
          >
            {SOUND_SETS.map((s) => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
            <option value="off">No transition sounds</option>
          </select>
          {setId !== "off" && (
            <PlayButton id={`set-${setId}`} srcs={SOUND_SETS.find((s) => s.id === setId)!.sounds.map((id) => src(transitionPath(id)))} label={`${setId} transition sounds`} size="sm" />
          )}
          <Link href="/music" className="ml-auto text-xs font-semibold text-violet-deep hover:underline">Browse all music</Link>
        </div>
        <p className="text-xs text-slate">{current ? `Cuts and transitions land on the beat of ${current.title} (${current.bpm} bpm). Music sits under the visuals.` : "No music. Transitions keep their own timing."}</p>
      </div>
    </AudioPreviewProvider>
  );
}
