import { MusicLibrary } from "@/components/app/music-library";

export const metadata = { title: "Music library" };

export default function MusicPage() {
  return (
    <div className="max-w-5xl space-y-5">
      <div>
        <h1 className="text-heading text-2xl">Music library</h1>
        <p className="text-sm text-slate">Listen to every track and sound. Pick one for a concept from its preview, under the player.</p>
      </div>
      <MusicLibrary />
    </div>
  );
}
