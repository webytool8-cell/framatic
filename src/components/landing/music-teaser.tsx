"use client";
import { AudioPreviewProvider, PlayButton } from "@/components/app/audio-preview";
import { MUSIC_LIBRARY, SOUND_SETS, musicPath, transitionPath } from "@/video/music";

const PICKS = ["bright-pop", "lofi-chill", "tech-pulse", "cinematic-rise", "synthwave", "soft-piano"];

/** Listenable sample of the built-in music on the landing page. */
export function MusicTeaser() {
  const tracks = MUSIC_LIBRARY.filter((t) => PICKS.includes(t.id));
  return (
    <AudioPreviewProvider>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <ul className="divide-y divide-white/60 overflow-hidden rounded-2xl bg-white/80 shadow-[0_20px_40px_-28px_rgba(32,33,36,0.35)] ring-1 ring-black/5 backdrop-blur">
          {tracks.map((t) => (
            <li key={t.id} className="flex items-center gap-4 px-5 py-3.5">
              <PlayButton id={`l-${t.id}`} srcs={[`/${musicPath(t.id)}`]} startAt={t.startAtSec} maxSec={20} label={t.title} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{t.title}</p>
                <p className="truncate text-sm text-slate">{t.moods.slice(0, 3).join(", ")}</p>
              </div>
              <span className="font-mono text-xs text-slate">{t.bpm} bpm</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-3">
          {SOUND_SETS.slice(0, 4).map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-2xl bg-white/80 px-4 py-3 ring-1 ring-black/5">
              <PlayButton id={`ls-${s.id}`} srcs={s.sounds.map((id) => `/${transitionPath(id)}`)} label={`${s.title} transition sounds`} size="sm" />
              <div>
                <p className="font-semibold">{s.title} transitions</p>
                <p className="text-xs text-slate">{s.sounds.map((x) => x.replace("-", " ")).join(" + ")}</p>
              </div>
            </div>
          ))}
          <p className="px-1 text-sm text-slate">10 tracks and 8 transition sets in the app. All original and free to use in your ads.</p>
        </div>
      </div>
    </AudioPreviewProvider>
  );
}
