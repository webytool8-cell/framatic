/**
 * Built-in audio — original music and sounds synthesized by
 * scripts/music/generate.py (free to use in any ad). Files live in
 * public/audio, served to the browser and bundled into the renderer image.
 */
export interface MusicTrack {
  id: string;
  title: string;
  bpm: number;
  durationSec: number;
  moods: string[];
  /** Skip a slow intro (seconds; always a whole number of beats). */
  startAtSec: number;
  /** Transition sound set that suits this track. */
  soundSet: string;
}

export const MUSIC_LIBRARY: MusicTrack[] = [
  {
    "id": "bright-pop",
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
    ],
    "startAtSec": 2,
    "soundSet": "bubbly"
  },
  {
    "id": "lofi-chill",
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
    ],
    "startAtSec": 1.395,
    "soundSet": "airy"
  },
  {
    "id": "tech-pulse",
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
    ],
    "startAtSec": 0,
    "soundSet": "digital"
  },
  {
    "id": "cinematic-rise",
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
    ],
    "startAtSec": 0,
    "soundSet": "cinematic"
  },
  {
    "id": "playful-bounce",
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
    ],
    "startAtSec": 2.222,
    "soundSet": "snappy"
  },
  {
    "id": "acoustic-sunrise",
    "title": "Acoustic Sunrise",
    "bpm": 104,
    "durationSec": 64.62,
    "moods": [
      "acoustic",
      "organic",
      "warm",
      "friendly",
      "natural",
      "honest",
      "sunny",
      "community",
      "wholesome",
      "folk",
      "handmade"
    ],
    "startAtSec": 2.308,
    "soundSet": "airy"
  },
  {
    "id": "deep-house",
    "title": "Deep House",
    "bpm": 122,
    "durationSec": 55.08,
    "moods": [
      "stylish",
      "fashion",
      "sleek",
      "luxury",
      "ecommerce",
      "shopping",
      "lifestyle",
      "chic",
      "smooth",
      "cool",
      "elegant",
      "premium",
      "night"
    ],
    "startAtSec": 0,
    "soundSet": "punchy"
  },
  {
    "id": "boom-bap",
    "title": "Boom Bap",
    "bpm": 90,
    "durationSec": 66.67,
    "moods": [
      "hip-hop",
      "hiphop",
      "urban",
      "streetwear",
      "street",
      "gritty",
      "swagger",
      "bold",
      "edgy",
      "creator",
      "rap",
      "groovy"
    ],
    "startAtSec": 0.667,
    "soundSet": "snappy"
  },
  {
    "id": "synthwave",
    "title": "Synthwave",
    "bpm": 100,
    "durationSec": 67.2,
    "moods": [
      "retro",
      "80s",
      "nostalgic",
      "neon",
      "synthwave",
      "gaming",
      "night",
      "vintage",
      "dreamy",
      "futuristic"
    ],
    "startAtSec": 2.4,
    "soundSet": "retro"
  },
  {
    "id": "soft-piano",
    "title": "Soft Piano",
    "bpm": 74,
    "durationSec": 71.35,
    "moods": [
      "emotional",
      "heartfelt",
      "elegant",
      "minimal",
      "calm",
      "thoughtful",
      "gentle",
      "sincere",
      "healthcare",
      "wellness",
      "story",
      "tender",
      "reflective"
    ],
    "startAtSec": 0,
    "soundSet": "gentle"
  }
];

/** Overall music level: the slider's 100% is still a background bed. */
export const MUSIC_GAIN = 0.45;
export const DEFAULT_MUSIC_VOLUME = 0.7;

/* ---------- cue sound effects (from the AI's audio cues) ---------- */
export const SFX = ["whoosh", "riser", "hit", "beat_drop", "click", "swell"] as const;
export type SfxName = (typeof SFX)[number];

/* ---------- transition sounds ---------- */
export interface TransitionSound {
  id: string;
  title: string;
  /** Seconds from the start of the file to its loudest moment (aligned to the cut). */
  peakSec: number;
}

export const TRANSITION_SOUNDS: TransitionSound[] = [
  { id: "whoosh-air", title: "Airy whoosh", peakSec: 0.447 },
  { id: "whoosh-fast", title: "Fast whoosh", peakSec: 0.185 },
  { id: "swish", title: "Swish", peakSec: 0.213 },
  { id: "swipe-up", title: "Swipe up", peakSec: 0.5 },
  { id: "pop", title: "Pop", peakSec: 0.017 },
  { id: "snap", title: "Snap", peakSec: 0.013 },
  { id: "blip", title: "Blip", peakSec: 0.02 },
  { id: "glitch", title: "Glitch", peakSec: 0.075 },
  { id: "shimmer", title: "Shimmer", peakSec: 0.202 },
  { id: "thump", title: "Thump", peakSec: 0.021 },
  { id: "reverse-swell", title: "Reverse swell", peakSec: 1.1 },
  { id: "tape-stop", title: "Tape stop", peakSec: 0.022 },
];

/**
 * Each video uses one set: at most two transition sounds.
 * [0] plays on movement transitions (wipes, pans), [1] on reveals (circle, zoom, morph).
 */
export interface SoundSet {
  id: string;
  title: string;
  sounds: [string, string];
}

export const SOUND_SETS: SoundSet[] = [
  { id: "airy", title: "Airy", sounds: ["whoosh-air", "shimmer"] },
  { id: "bubbly", title: "Bubbly", sounds: ["swipe-up", "pop"] },
  { id: "snappy", title: "Snappy", sounds: ["swish", "snap"] },
  { id: "punchy", title: "Punchy", sounds: ["whoosh-fast", "thump"] },
  { id: "digital", title: "Digital", sounds: ["blip", "glitch"] },
  { id: "cinematic", title: "Cinematic", sounds: ["reverse-swell", "thump"] },
  { id: "retro", title: "Retro", sounds: ["tape-stop", "blip"] },
  { id: "gentle", title: "Gentle", sounds: ["whoosh-air", "pop"] },
];

const MOVEMENT = new Set(["wipe_left", "wipe_up", "whip_pan"]);
const REVEAL = new Set(["circle_reveal", "shape_morph", "zoom_through"]);

/** The transition sound (if any) for a transition type within a set. */
export function soundForTransition(setId: string | undefined, transition: string): TransitionSound | null {
  const set = SOUND_SETS.find((s) => s.id === setId);
  if (!set) return null;
  const id = MOVEMENT.has(transition) ? set.sounds[0] : REVEAL.has(transition) ? set.sounds[1] : null;
  return TRANSITION_SOUNDS.find((t) => t.id === id) ?? null;
}

export function trackById(id: string | null | undefined): MusicTrack | null {
  return MUSIC_LIBRARY.find((t) => t.id === id) ?? null;
}

export const musicPath = (id: string) => `audio/music/${id}.mp3`;
export const sfxPath = (name: string) => `audio/sfx/${name}.mp3`;
export const transitionPath = (id: string) => `audio/transitions/${id}.mp3`;

/**
 * Choose the track whose moods best match the concept's music direction.
 * Several descriptions can be given in priority order; the first that matches decides.
 */
export function pickTrack(mood: string | string[], bpm?: number): MusicTrack {
  const candidates = (Array.isArray(mood) ? mood : [mood]).map((m) => m.toLowerCase()).filter(Boolean);
  for (const words of candidates) {
    const scored = MUSIC_LIBRARY.map((t) => {
      let hits = 0;
      for (const m of t.moods) if (words.includes(m)) hits += m.length > 4 ? 2 : 1;
      return { t, hits, score: hits - (bpm ? Math.abs(t.bpm - bpm) / 40 : 0) };
    }).sort((a, b) => b.score - a.score);
    if (scored[0].hits > 0) return scored[0].t;
  }
  return [...MUSIC_LIBRARY].sort((a, b) => Math.abs(a.bpm - (bpm ?? 120)) - Math.abs(b.bpm - (bpm ?? 120)))[0];
}
