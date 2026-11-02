"use client";
import { MUSIC_LIBRARY, SFX, SOUND_SETS, TRANSITION_SOUNDS, musicPath, sfxPath, transitionPath } from "@/video/music";
import { AudioPreviewProvider, PlayButton } from "./audio-preview";

const src = (p: string) => `/${p}`;
const SFX_TITLES: Record<string, string> = { whoosh: "Whoosh", riser: "Riser", hit: "Hit", beat_drop: "Impact", click: "Click", swell: "Swell" };
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

/** Browse and listen to every built-in track and sound. */
export function MusicLibrary() {
  return (
    <AudioPreviewProvider>
      <div className="space-y-5">
        <section className="overflow-hidden rounded-xl border border-line bg-white">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <h2 className="text-sm font-semibold">Tracks <span className="ml-1 font-normal text-slate">{MUSIC_LIBRARY.length}</span></h2>
            <p className="text-xs text-slate">Original music made for Framatic. Free to use in your ads.</p>
          </div>
          <ul className="divide-y divide-line">
            {MUSIC_LIBRARY.map((t) => {
              const set = SOUND_SETS.find((s) => s.id === t.soundSet);
              return (
                <li key={t.id} className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1.5 px-4 py-3 md:grid-cols-[auto_minmax(0,1.2fr)_minmax(0,2fr)_90px_120px]">
                  <PlayButton id={`t-${t.id}`} srcs={[src(musicPath(t.id))]} startAt={t.startAtSec} maxSec={30} label={t.title} />
                  <div className="min-w-0">
                    <p className="font-semibold">{t.title}</p>
                    <p className="font-mono text-xs text-slate">{t.bpm} bpm · {fmt(t.durationSec)}</p>
                  </div>
                  <ul className="col-span-full flex flex-wrap gap-1 md:col-span-1">
                    {t.moods.slice(0, 6).map((m) => <li key={m} className="rounded-full bg-[#F2F2F6] px-2 py-0.5 text-xs">{m}</li>)}
                  </ul>
                  <p className="hidden text-xs text-slate md:block">Pairs with</p>
                  <p className="hidden text-sm font-medium md:block">{set?.title ?? "—"} sounds</p>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-xl border border-line bg-white p-4">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <h2 className="text-sm font-semibold">Transition sound sets</h2>
            <p className="text-xs text-slate">Each video uses one set: a sound for movement (wipes, pans) and one for reveals (circle, zoom). Both land on the beat.</p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SOUND_SETS.map((s) => (
              <li key={s.id} className="rounded-lg border border-line p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-semibold">{s.title}</p>
                  <PlayButton id={`set-${s.id}`} srcs={s.sounds.map((id) => src(transitionPath(id)))} label={`${s.title} set`} size="sm" />
                </div>
                <ul className="space-y-1.5 text-sm">
                  {s.sounds.map((id, i) => {
                    const snd = TRANSITION_SOUNDS.find((x) => x.id === id)!;
                    return (
                      <li key={id} className="flex items-center gap-2">
                        <PlayButton id={`${s.id}-${id}`} srcs={[src(transitionPath(id))]} label={snd.title} size="sm" />
                        <span>{snd.title}</span>
                        <span className="ml-auto text-xs text-slate">{i === 0 ? "movement" : "reveals"}</span>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-line bg-white p-4">
          <h2 className="mb-1 text-sm font-semibold">Accent effects</h2>
          <p className="mb-3 text-xs text-slate">Used sparingly when a scene calls for a moment, like a logo reveal or a big number.</p>
          <ul className="flex flex-wrap gap-2">
            {SFX.map((s) => (
              <li key={s} className="flex items-center gap-2 rounded-full border border-line py-1 pl-1 pr-3 text-sm">
                <PlayButton id={`sfx-${s}`} srcs={[src(sfxPath(s))]} label={SFX_TITLES[s]} size="sm" />
                {SFX_TITLES[s]}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </AudioPreviewProvider>
  );
}
