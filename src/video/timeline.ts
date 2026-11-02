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
  durationInFrames: number;
  /** Transition into the NEXT scene (0 = hard cut). */
  transitionFrames: number;
}

export function msToFrames(ms: number, fps = FPS) {
  return Math.round((ms / 1000) * fps);
}

export function buildTimeline(plan: ScenePlan, fps = FPS): { scenes: TimelineScene[]; durationInFrames: number } {
  const scenes = plan.scenes.map((s, index) => ({ index, durationInFrames: Math.max(1, Math.round(s.durationSec * fps)), transitionFrames: 0 }));
  for (let i = 0; i < scenes.length - 1; i++) {
    const t = plan.scenes[i].transition;
    if (t.type === "cut") continue;
    // A transition may not be longer than half of either neighbouring scene.
    const max = Math.floor(Math.min(scenes[i].durationInFrames, scenes[i + 1].durationInFrames) / 2);
    scenes[i].transitionFrames = Math.max(0, Math.min(msToFrames(t.durationMs || 300, fps), max));
  }
  const total = scenes.reduce((n, s) => n + s.durationInFrames, 0) - scenes.reduce((n, s) => n + s.transitionFrames, 0);
  return { scenes, durationInFrames: Math.max(1, total) };
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

/**
 * Frame at which each scene is fully on screen (after the incoming
 * transition finishes), used for jumping to a scene.
 */
export function sceneStarts(plan: ScenePlan, fps = FPS): number[] {
  const { scenes } = buildTimeline(plan, fps);
  const starts: number[] = [];
  let t = 0;
  scenes.forEach((s, i) => {
    starts.push(t + (i > 0 ? scenes[i - 1].transitionFrames : 0));
    t += s.durationInFrames - s.transitionFrames;
  });
  return starts;
}

/** Frame at which each scene's sequence begins (start of its incoming transition). */
export function sequenceStarts(plan: ScenePlan, fps = FPS): number[] {
  const { scenes } = buildTimeline(plan, fps);
  const out: number[] = [];
  let t = 0;
  for (const s of scenes) {
    out.push(t);
    t += s.durationInFrames - s.transitionFrames;
  }
  return out;
}

/** Music volume envelope: short fade-in, ~1.2s fade-out at the end. */
export function musicVolume(frame: number, totalFrames: number, base: number, fps = FPS): number {
  const fadeIn = Math.min(1, frame / (0.3 * fps));
  const outFrames = 1.2 * fps;
  const fadeOut = Math.min(1, Math.max(0, (totalFrames - frame) / outFrames));
  return Math.max(0, base * fadeIn * fadeOut);
}
