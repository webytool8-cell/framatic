import { z } from "zod";

/**
 * Structured, versioned scene plan — the contract between the AI creative
 * director (Phase 1) and the programmatic renderer (Phase 2, e.g. Remotion).
 *
 * Everything is declarative data from a controlled vocabulary. The renderer
 * maps each `type` to a pre-built component; no AI-generated code is ever run.
 */
export const SCENE_PLAN_SCHEMA_VERSION = 1;

export const VISUAL_ELEMENT_TYPES = [
  "kinetic_text",
  "word_stagger",
  "tracking_reveal",
  "geometric_sweep",
  "shape_burst",
  "icon_animation",
  "screenshot_reveal",
  "product_recording",
  "feature_callout",
  "stat_counter",
  "logo_reveal",
  "cta_end_card",
] as const;

export const ANIMATION_TYPES = [
  "fade_up",
  "word_stagger",
  "tracking_reveal",
  "scale_pop",
  "slide_in_left",
  "slide_in_right",
  "mask_wipe",
  "typewriter",
  "geometric_sweep",
  "zoom_in",
  "none",
] as const;

export const TRANSITION_TYPES = ["cut", "crossfade", "wipe_left", "wipe_up", "shape_morph", "zoom_through", "whip_pan", "circle_reveal"] as const;

export const SCENE_PURPOSES = ["hook", "problem", "agitate", "reveal", "feature", "benefit", "demo", "manifesto", "proof", "cta"] as const;

export const BACKGROUND_TYPES = ["solid", "split", "shape_field", "grid", "brand_gradient_flat"] as const;

export const ICONS = [
  "sparkle", "bolt", "check", "clock", "chart", "shield", "users", "cart", "chat", "lock", "rocket", "target",
  "layers", "wand", "globe", "heart", "star", "arrow_right", "cursor", "play", "calendar", "mail", "search", "gear",
] as const;

export const AUDIO_CUES = ["music_in", "beat_drop", "riser", "hit", "whoosh", "click", "swell", "music_out"] as const;

export const EASINGS = ["linear", "ease_out", "ease_in_out", "spring", "snap"] as const;

export const ASSET_REFS = ["logo", "primary_screenshot", "feature_screenshot", "product_recording", "product_image", "og_image"] as const;

export const ASPECT_RATIOS = ["16:9", "9:16", "1:1", "4:5"] as const;

const ColorRef = z.union([
  z.enum(["primary", "secondary", "accent", "ink", "paper"]),
  z.string().regex(/^#[0-9a-fA-F]{6}$/),
]);

export const VisualElement = z.object({
  type: z.enum(VISUAL_ELEMENT_TYPES),
  text: z.string().max(160).optional().describe("Text shown by this element, if any"),
  icon: z.enum(ICONS).optional(),
  color: ColorRef.optional(),
  asset: z.enum(ASSET_REFS).optional().describe("Brand asset this element needs"),
  position: z.enum(["center", "top", "bottom", "left", "right", "full"]).default("center"),
});
export type VisualElement = z.infer<typeof VisualElement>;

export const Scene = z.object({
  id: z.string().min(1).max(40),
  purpose: z.enum(SCENE_PURPOSES),
  durationSec: z.number().min(0.6).max(12),
  headline: z.string().max(90).describe("On-screen headline; short and punchy (ideally ≤ 7 words)"),
  supportingText: z.string().max(160).default(""),
  visualElements: z.array(VisualElement).min(1).max(5),
  animation: z.object({
    type: z.enum(ANIMATION_TYPES),
    delayMs: z.number().int().min(0).max(4000).default(0),
    durationMs: z.number().int().min(100).max(4000).default(600),
    easing: z.enum(EASINGS).default("ease_out"),
    staggerMs: z.number().int().min(0).max(600).default(0),
  }),
  transition: z.object({
    type: z.enum(TRANSITION_TYPES),
    durationMs: z.number().int().min(0).max(1500).default(300),
  }),
  background: z.object({
    type: z.enum(BACKGROUND_TYPES),
    color: ColorRef,
    secondaryColor: ColorRef.optional(),
  }),
  brandAssets: z.array(z.enum(ASSET_REFS)).max(4).default([]),
  productFootage: z.object({
    required: z.boolean(),
    description: z.string().max(240).default(""),
  }),
  audioCues: z
    .array(z.object({ atSec: z.number().min(0).max(12), cue: z.enum(AUDIO_CUES) }))
    .max(4)
    .default([]),
  cta: z.object({ text: z.string().max(40), url: z.string().max(2048).optional() }).nullable().default(null),
});
export type Scene = z.infer<typeof Scene>;

export const ScenePlan = z.object({
  schemaVersion: z.literal(SCENE_PLAN_SCHEMA_VERSION),
  aspectRatio: z.enum(ASPECT_RATIOS).default("16:9"),
  fps: z.literal(30).default(30),
  durationSec: z.number().min(5).max(90),
  palette: z.object({
    primary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    secondary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    ink: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    paper: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  }),
  fonts: z.object({ heading: z.string().max(120), body: z.string().max(120) }),
  music: z.object({
    mood: z.string().max(120),
    bpm: z.number().int().min(60).max(180),
    /** Built-in track id (src/video/music.ts) or "none" for silence. Chosen automatically if absent. */
    track: z.string().max(40).optional(),
    volume: z.number().min(0).max(1).default(0.7),
    /** Transition sound set (src/video/music.ts SOUND_SETS) or "off". */
    soundSet: z.string().max(40).optional(),
  }),
  scenes: z.array(Scene).min(3).max(14),
});
export type ScenePlan = z.infer<typeof ScenePlan>;

/**
 * Post-validation normalization:
 * - unique scene IDs
 * - total duration equals sum of scenes (rounded to frames)
 * - last scene carries the CTA; audio cues clamped inside their scene
 */
export function normalizeScenePlan(plan: ScenePlan, fallbackCta?: string): ScenePlan {
  const seen = new Set<string>();
  const scenes = plan.scenes.map((s, i) => {
    let id = s.id.replace(/[^a-z0-9_-]/gi, "_").slice(0, 40) || `scene_${i + 1}`;
    while (seen.has(id)) id = `${id}_${i + 1}`;
    seen.add(id);
    // Keep beat-snapped lengths exact; the timeline rounds cut points to frames
    // from the running total, so there is no drift.
    const durationSec = +s.durationSec.toFixed(3);
    return {
      ...s,
      id,
      durationSec: +durationSec.toFixed(3),
      audioCues: s.audioCues.filter((c) => c.atSec <= durationSec),
    };
  });
  const last = scenes[scenes.length - 1];
  if (last && !last.cta && fallbackCta) {
    scenes[scenes.length - 1] = { ...last, cta: { text: fallbackCta.slice(0, 40) } };
  }
  const total = +scenes.reduce((n, s) => n + s.durationSec, 0).toFixed(3);
  return { ...plan, scenes, durationSec: total };
}

/** Assets the plan needs, de-duplicated — used for "required product assets". */
export function requiredAssets(plan: ScenePlan): string[] {
  const set = new Set<string>();
  for (const s of plan.scenes) {
    s.brandAssets.forEach((a) => set.add(a));
    s.visualElements.forEach((v) => v.asset && set.add(v.asset));
    if (s.productFootage.required) set.add("product_recording");
  }
  return [...set];
}

/**
 * Snap scene lengths to the music's half-beats so cuts land on the beat.
 * Keeps every scene within the schema's 0.6–12s bounds.
 */
export function snapToBeats(plan: ScenePlan, bpm: number): ScenePlan {
  const half = 30 / bpm; // seconds per half-beat
  const min = Math.ceil(0.6 / half) * half;
  const max = Math.floor(12 / half) * half;
  const beatMs = 60000 / bpm;
  const q = (ms: number, unit: number) => Math.round(ms / unit) * unit;
  const scenes = plan.scenes.map((s) => ({
    ...s,
    durationSec: +Math.min(max, Math.max(min, Math.round(s.durationSec / half) * half)).toFixed(3),
    // Transitions last half a beat or a full beat.
    transition: { ...s.transition, durationMs: s.transition.type === "cut" ? 0 : Math.round(s.transition.durationMs >= beatMs * 0.75 ? beatMs : beatMs / 2) },
    // Text animations start and step on the beat subdivision.
    animation: {
      ...s.animation,
      delayMs: Math.min(4000, Math.round(q(s.animation.delayMs, beatMs / 4))),
      staggerMs: s.animation.staggerMs ? Math.min(600, Math.max(Math.round(beatMs / 8), Math.round(q(s.animation.staggerMs, beatMs / 8)))) : 0,
    },
  }));
  return { ...plan, scenes, music: { ...plan.music, bpm: Math.round(bpm) } };
}
