import { AIConcept, CONCEPT_META, CreativePreferences, type ConceptContent, type ConceptKind } from "@/lib/creative/concept";
import { finalizeConcept } from "@/lib/creative/director";
import type { ScenePlan } from "@/lib/creative/scene-plan";
import { aiConceptFixture } from "@/lib/dev/sample-data";
import { sampleBrand } from "@/lib/samples";

/**
 * A fictional, read-only sample project (Lumen Mug) that every signed-in user
 * can open. It lives only in code: nothing is stored, nothing can be saved,
 * and there are no exports.
 */
type RawScene = Record<string, unknown>;

export type SampleConcept = {
  id: string;
  slug: "a" | "b" | "c";
  kind: ConceptKind;
  content: ConceptContent;
  plan: ScenePlan;
  preferences: CreativePreferences;
};

export const SAMPLE_PROJECT = {
  name: "Lumen Mug launch",
  host: "lumenmug.example",
  product: "Lumen Mug",
  mark: "Lumen",
  promise: "Your coffee, hot for 3 hours",
  audience: "Busy remote workers",
  price: "$39",
  colors: ["#E8572A", "#2B2D42", "#F2C14E"] as const,
  facts: ["Keeps coffee hot for 3 hours", "Dishwasher-safe lid", "Free shipping over $50"],
};

const base = (s: RawScene, extra: RawScene) => Object.assign(s, { supportingText: "", audioCues: [], cta: null, ...extra });

const DEFS: {
  slug: SampleConcept["slug"];
  kind: ConceptKind;
  ratio: "16:9" | "9:16" | "1:1" | "4:5";
  track: string;
  content: Partial<ConceptContent>;
  scenes: (s: RawScene[]) => void;
}[] = [
  {
    slug: "a",
    kind: "problem_solution",
    ratio: "16:9",
    track: "bright-pop",
    content: {
      title: "Never cold again",
      description: "Open on the everyday letdown of a cold third reheat, then reveal the mug that keeps every sip hot.",
      targetAudience: "Remote workers who forget their coffee between calls",
      campaignObjective: "purchases",
      rationale: "The cold-coffee moment is instantly recognizable, and the 3-hour promise answers it in one line.",
      headline: "Coffee that waits for you",
      supportingCopy: "Lumen keeps your coffee at the perfect temperature for 3 hours. No more reheats.",
      cta: "Shop now",
      visualDirection: "Warm orange on cream, quick split-screen reveals, product window with feature badges.",
      typographyDirection: "Heavy, tight headlines with word-by-word reveals.",
      musicMood: "Bright, upbeat pop",
      pacing: "punchy",
    },
    scenes: ([a, b, c, e]) => {
      base(a, { durationSec: 2.6, headline: "Cold coffee. Again.", supportingText: "9:42am, third reheat", background: { type: "split", color: "paper", secondaryColor: "primary" }, visualElements: [{ type: "word_stagger" }, { type: "shape_burst" }], animation: { type: "word_stagger", staggerMs: 110 }, transition: { type: "wipe_left", durationMs: 350 } });
      base(b, { durationSec: 3.4, headline: "Hot for 3 hours.", background: { type: "solid", color: "paper" }, visualElements: [{ type: "screenshot_reveal" }, { type: "feature_callout", text: "Smart heat", icon: "bolt" }, { type: "feature_callout", text: "Dishwasher-safe lid", icon: "check", color: "secondary" }], animation: { type: "slide_in_left", durationMs: 500 }, transition: { type: "circle_reveal", durationMs: 450 } });
      base(c, { durationSec: 2.6, headline: "hours of perfect sips", background: { type: "shape_field", color: "primary" }, visualElements: [{ type: "stat_counter", text: "3" }, { type: "kinetic_text" }], animation: { type: "scale_pop" }, transition: { type: "zoom_through", durationMs: 400 }, audioCues: [{ atSec: 0, cue: "beat_drop" }] });
      base(e, { durationSec: 3, headline: "Good mornings, kept warm.", background: { type: "solid", color: "paper" }, visualElements: [{ type: "cta_end_card" }, { type: "logo_reveal" }], animation: { type: "tracking_reveal", durationMs: 700 }, cta: { text: "Shop now" }, audioCues: [{ atSec: 0.4, cue: "hit" }] });
    },
  },
  {
    slug: "b",
    kind: "product_in_motion",
    ratio: "9:16",
    track: "deep-house",
    content: {
      title: "Sip. Set. Stay hot.",
      description: "A fast vertical walk through the mug: sip, set it down, and it's still hot hours later.",
      targetAudience: "Coffee lovers scrolling Reels and TikTok",
      campaignObjective: "purchases",
      rationale: "Short, rhythmic beats suit vertical feeds; each scene shows one benefit.",
      headline: "Sip. Set. Stay hot.",
      supportingCopy: "Smart heat keeps every sip at your perfect temperature.",
      cta: "Get yours",
      visualDirection: "Bold product window, badges popping in on the beat, dark navy accents.",
      typographyDirection: "Short stacked lines, big and centered for vertical.",
      musicMood: "Smooth deep house",
      pacing: "punchy",
    },
    scenes: ([a, b, c, e]) => {
      base(a, { durationSec: 2, headline: "Sip.", background: { type: "solid", color: "secondary" }, visualElements: [{ type: "kinetic_text" }], animation: { type: "scale_pop" }, transition: { type: "whip_pan", durationMs: 300 } });
      base(b, { durationSec: 2, headline: "Set.", background: { type: "solid", color: "primary" }, visualElements: [{ type: "kinetic_text" }, { type: "shape_burst" }], animation: { type: "scale_pop" }, transition: { type: "whip_pan", durationMs: 300 } });
      base(c, { durationSec: 3.5, headline: "Stay hot.", supportingText: "Smart heat, all morning", background: { type: "solid", color: "paper" }, visualElements: [{ type: "screenshot_reveal" }, { type: "feature_callout", text: "3-hour heat", icon: "clock" }, { type: "feature_callout", text: "Leak-proof lid", icon: "shield", color: "secondary" }], animation: { type: "slide_in_left", durationMs: 450 }, cta: { text: "Get yours" }, transition: { type: "circle_reveal", durationMs: 400 } });
      base(e, { durationSec: 3, headline: "Lumen Mug. $39.", background: { type: "solid", color: "paper" }, visualElements: [{ type: "cta_end_card" }, { type: "logo_reveal" }], animation: { type: "tracking_reveal", durationMs: 600 }, cta: { text: "Get yours" }, audioCues: [{ atSec: 0.3, cue: "hit" }] });
    },
  },
  {
    slug: "c",
    kind: "brand_manifesto",
    ratio: "1:1",
    track: "acoustic-sunrise",
    content: {
      title: "Good mornings deserve better",
      description: "A calmer, warmer story about the small ritual of a good first coffee.",
      targetAudience: "People who treat their morning coffee as a ritual",
      campaignObjective: "awareness",
      rationale: "A softer brand story balances the two direct-response concepts and works well in feeds.",
      headline: "Mornings, upgraded.",
      supportingCopy: "The first sip should be the best one. And so should the last.",
      cta: "Discover Lumen",
      visualDirection: "Cream backgrounds, gentle crossfades, yellow accents.",
      typographyDirection: "Letter-spaced reveals, unhurried.",
      musicMood: "Warm acoustic",
      pacing: "calm",
    },
    scenes: ([a, b, c, e]) => {
      base(a, { durationSec: 3, headline: "Mornings, upgraded.", background: { type: "solid", color: "paper" }, visualElements: [{ type: "tracking_reveal" }], animation: { type: "tracking_reveal", durationMs: 800 }, transition: { type: "crossfade", durationMs: 500 } });
      base(b, { durationSec: 3, headline: "The first sip should be the best one.", background: { type: "split", color: "paper", secondaryColor: "accent" }, visualElements: [{ type: "word_stagger" }], animation: { type: "word_stagger", staggerMs: 140 }, transition: { type: "crossfade", durationMs: 500 } });
      base(c, { durationSec: 3, headline: "And so should the last.", background: { type: "shape_field", color: "accent" }, visualElements: [{ type: "kinetic_text" }, { type: "geometric_sweep" }], animation: { type: "fade_up" }, transition: { type: "crossfade", durationMs: 500 } });
      base(e, { durationSec: 3.5, headline: "Lumen. Warmth that lasts.", background: { type: "solid", color: "paper" }, visualElements: [{ type: "cta_end_card" }, { type: "logo_reveal" }], animation: { type: "tracking_reveal", durationMs: 700 }, cta: { text: "Discover Lumen" } });
    },
  },
];

function build(d: (typeof DEFS)[number]): SampleConcept {
  const raw = aiConceptFixture(String(d.content.title));
  Object.assign(raw, d.content, { requiredAssets: [{ type: "logo", description: "Lumen logo" }, { type: "product_image", description: "Lumen Mug on a desk" }] });
  for (const s of raw.scenePlan.scenes as unknown as RawScene[]) s.productFootage = { required: false, description: "" };
  d.scenes(raw.scenePlan.scenes as unknown as RawScene[]);
  const preferences = CreativePreferences.parse({ aspectRatio: d.ratio, musicTrack: d.track });
  const finished = finalizeConcept(AIConcept.parse(raw), sampleBrand, preferences);
  const { scenePlan, ...content } = finished;
  return { id: `sample-${d.slug}`, slug: d.slug, kind: d.kind, content, plan: scenePlan, preferences };
}

export const SAMPLE_CONCEPTS: SampleConcept[] = DEFS.map(build);

export function sampleConcept(slug: string): SampleConcept | null {
  return SAMPLE_CONCEPTS.find((c) => c.slug === slug) ?? null;
}

export const SAMPLE_SLOT = Object.fromEntries(SAMPLE_CONCEPTS.map((c) => [c.slug, CONCEPT_META[c.kind].slot]));
