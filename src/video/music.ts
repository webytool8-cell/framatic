/**
 * Built-in music library — original tracks synthesized by scripts/music/generate.py,
 * free to use in any ad. Files live in public/audio (served to the browser and
 * bundled into the renderer image).
 */
export interface MusicTrack {
  id: string;
  title: string;
  bpm: number;
  durationSec: number;
  moods: string[];
  /** Skip a slow intro so the ad starts with energy (seconds into the file). */
  startAtSec?: number;
}

export const MUSIC_LIBRARY: MusicTrack[] = [
  {
    "id": "bright-pop",
    "startAtSec": 2.0,
    "title": "Bright Pop",
    "bpm": 120,
    "durationSec": 56,
    "moods": [
      "upbeat",
      "energetic",
      "happy",
      "pop",
      "bright",
      "positive",
      "fun",
      "optimistic",
      "punchy"
    ]
  },
  {
    "id": "lofi-chill",
    "startAtSec": 1.4,
    "title": "Lo-fi Chill",
    "bpm": 86,
    "durationSec": 69.77,
    "moods": [
      "lofi",
      "lo-fi",
      "chill",
      "calm",
      "relaxed",
      "warm",
      "mellow",
      "soft",
      "cozy",
      "laid-back",
      "gentle"
    ]
  },
  {
    "id": "tech-pulse",
    "startAtSec": 0,
    "title": "Tech Pulse",
    "bpm": 124,
    "durationSec": 54.19,
    "moods": [
      "tech",
      "modern",
      "driving",
      "confident",
      "corporate",
      "product",
      "sleek",
      "innovative",
      "professional",
      "saas",
      "electronic",
      "futuristic"
    ]
  },
  {
    "id": "cinematic-rise",
    "startAtSec": 0,
    "title": "Cinematic Rise",
    "bpm": 96,
    "durationSec": 50,
    "moods": [
      "cinematic",
      "epic",
      "inspiring",
      "bold",
      "manifesto",
      "emotional",
      "dramatic",
      "uplifting",
      "anthemic",
      "grand",
      "heroic"
    ]
  },
  {
    "id": "playful-bounce",
    "startAtSec": 2.222,
    "title": "Playful Bounce",
    "bpm": 108,
    "durationSec": 62.22,
    "moods": [
      "playful",
      "quirky",
      "bouncy",
      "cheeky",
      "friendly",
      "light",
      "whimsical",
      "cute",
      "lighthearted"
    ]
  }
];

export const SFX = ["whoosh", "riser", "hit", "beat_drop", "click", "swell"] as const;
export type SfxName = (typeof SFX)[number];

export function trackById(id: string | null | undefined): MusicTrack | null {
  return MUSIC_LIBRARY.find((t) => t.id === id) ?? null;
}

export const musicPath = (id: string) => `audio/music/${id}.mp3`;
export const sfxPath = (name: string) => `audio/sfx/${name}.mp3`;

/**
 * Choose the track whose moods best match the concept's music direction.
 * Ties go to the track whose tempo is closest to the requested BPM.
 */
export function pickTrack(mood: string | string[], bpm?: number): MusicTrack {
  // Several descriptions can be given in priority order; the first that
  // matches any track's moods decides.
  const candidates = (Array.isArray(mood) ? mood : [mood]).map((m) => m.toLowerCase()).filter(Boolean);
  for (const words of candidates) {
    const scored = MUSIC_LIBRARY.map((t) => {
      let hits = 0;
      for (const m of t.moods) if (words.includes(m)) hits += m.length > 4 ? 2 : 1;
      return { t, hits, score: hits - (bpm ? Math.abs(t.bpm - bpm) / 40 : 0) };
    }).sort((a, b) => b.score - a.score);
    if (scored[0].hits > 0) return scored[0].t;
  }
  // Nothing matched: nearest tempo.
  return [...MUSIC_LIBRARY].sort((a, b) => Math.abs(a.bpm - (bpm ?? 120)) - Math.abs(b.bpm - (bpm ?? 120)))[0];
}
