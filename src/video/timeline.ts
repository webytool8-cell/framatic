import type { ScenePlan } from "@/lib/creative/scene-plan";

/**
 * Frame math for turning a ScenePlan into a timeline. Pure and shared by the
 * browser preview and (later) server-side rendering.
 */
export const FPS = 30;

export const DIMENSIONS: Record<ScenePlan["aspectRatio"], { width: number; height: number }> = {
  "16:9": { width: 1920, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
};

export interface TimelineScene {
  index: number;
  /** First frame of this scene's sequence (start of its incoming transition). */
  from: number;
  durationInFrames: number;
  /** Transition into the NEXT scene (0 = hard cut). */
  transitionFrames: number;
  /** Frame of the cut to the next scene: the middle of the transition, on the beat. */
  cutFrame: number;
}

export function msToFrames(ms: number, fps = FPS) {
  return Math.round((ms / 1000) * fps);
}

/** Transition length in seconds; with music it is half a beat or a full beat. */
function transitionSeconds(ms: number, bpm: number | null): number {
  const sec = (ms || 300) / 1000;
  if (!bpm) return sec;
  const beat = 60 / bpm;
  return sec >= beat * 0.75 ? beat : beat / 2;
}

/**
 * Lay scenes on the timeline so every cut lands exactly on the scene
 * boundary (which snapToBeats puts on the music's beat grid). Boundaries are
 * rounded independently, so there is no drift over the length of the ad.
 * Transitions are centred on the cut.
 */
export function buildTimeline(plan: ScenePlan, fps = FPS): { scenes: TimelineScene[]; durationInFrames: number } {
  const bpm = plan.music?.track && plan.music.track !== "none" ? plan.music.bpm : null;
  const n = plan.scenes.length;
  const boundaries: number[] = [];
  let acc = 0;
  for (const s of plan.scenes) {
    acc += s.durationSec;
    boundaries.push(Math.round(acc * fps));
  }
  const lengths = boundaries.map((b, i) => b - (i ? boundaries[i - 1] : 0));
  const trans = plan.scenes.map((s, i) => {
    if (i === n - 1 || s.transition.type === "cut") return 0;
    const max = Math.floor(Math.min(lengths[i], lengths[i + 1]) / 2);
    const t = Math.round(transitionSeconds(s.transition.durationMs, bpm) * fps);
    return Math.max(0, Math.min(t, max));
  });
  const scenes: TimelineScene[] = [];
  let from = 0;
  for (let i = 0; i < n; i++) {
    const cut = boundaries[i];
    const half = Math.floor(trans[i] / 2);
    const nextFrom = i < n - 1 ? cut - half : cut;
    const durationInFrames = Math.max(1, nextFrom + trans[i] - from);
    scenes.push({ index: i, from, durationInFrames, transitionFrames: trans[i], cutFrame: cut });
    from = nextFrom;
  }
  return { scenes, durationInFrames: Math.max(1, boundaries[n - 1] ?? 1) };
}

/** Resolve a palette reference ("primary") or hex to a hex color. */
export function resolveColor(ref: string | undefined, plan: ScenePlan, fallback: keyof ScenePlan["palette"] = "paper"): string {
  if (!ref) return plan.palette[fallback];
  if (ref.startsWith("#")) return ref;
  return plan.palette[ref as keyof ScenePlan["palette"]] ?? plan.palette[fallback];
}

/** Readable text color for a background. */
export function inkOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#202124" : "#FFFFFF";
}

/** Pull the first number out of text for stat counters ("3x faster" → 3, suffix "x faster"). */
export function parseStat(text: string): { prefix: string; value: number; decimals: number; suffix: string } | null {
  const m = text.match(/^(.*?)(\d+(?:[.,]\d+)?)(.*)$/);
  if (!m) return null;
  const raw = m[2].replace(",", ".");
  return { prefix: m[1], value: Number(raw), decimals: raw.includes(".") ? raw.split(".")[1].length : 0, suffix: m[3] };
}

/** Google Fonts we can safely request for brand typography in the preview. */
export function googleFontsHref(families: string[]): string | null {
  const clean = [...new Set(families.map((f) => f.trim()).filter((f) => /^[A-Za-z0-9 ]{2,40}$/.test(f)))];
  if (!clean.length) return null;
  return `https://fonts.googleapis.com/css2?${clean.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;600;700`).join("&")}&display=swap`;
}

/** Frame at which each scene is fully on screen (after its incoming transition), for jumping to a scene. */
export function sceneStarts(plan: ScenePlan, fps = FPS): number[] {
  const { scenes } = buildTimeline(plan, fps);
  return scenes.map((s, i) => s.from + (i > 0 ? scenes[i - 1].transitionFrames : 0));
}

/** Frame at which each scene's sequence begins (start of its incoming transition). */
export function sequenceStarts(plan: ScenePlan, fps = FPS): number[] {
  return buildTimeline(plan, fps).scenes.map((s) => s.from);
}

/** Music volume envelope: short fade-in, ~1.2s fade-out at the end. */
export function musicVolume(frame: number, totalFrames: number, base: number, fps = FPS): number {
  const fadeIn = Math.min(1, frame / (0.3 * fps));
  const outFrames = 1.2 * fps;
  const fadeOut = Math.min(1, Math.max(0, (totalFrames - frame) / outFrames));
  return Math.max(0, base * fadeIn * fadeOut);
}
