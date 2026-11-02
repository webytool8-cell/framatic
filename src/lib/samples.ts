import { blankBrandProfile, type BrandProfile } from "@/lib/brand/schema";
import { AIConcept, CreativePreferences } from "@/lib/creative/concept";
import { finalizeConcept } from "@/lib/creative/director";
import type { ScenePlan } from "@/lib/creative/scene-plan";
import { aiConceptFixture } from "@/lib/dev/sample-data";
import { trackById } from "@/video/music";

/**
 * Fictional sample products used on the marketing page. Every plan runs through
 * the real director (brand palette, beat-snapped timing), so what visitors see
 * is what the pipeline produces.
 */

type Ratio = "16:9" | "9:16" | "1:1" | "4:5";
type RawScene = Record<string, unknown>;
type Fact = { label: string; value: string; tone: "verified" | "inferred" };

export type SampleProduct = {
  id: string;
  name: string;
  /** Short wordmark used in the video. */
  mark: string;
  host: string;
  kind: string;
  colors: [string, string, string];
  meta: string;
  facts: Fact[];
  concepts: { slot: "A" | "B" | "C"; name: string; title: string; hook: string; headline: string }[];
  cta: string;
  plans: Record<Ratio, ScenePlan>;
  music: string;
};

type Def = Omit<SampleProduct, "plans" | "music"> & { track: string; scenes: (s: RawScene[]) => void };

function brandFor(d: Def): BrandProfile {
  const b = blankBrandProfile(d.name);
  b.identity.primaryColor = d.colors[0];
  b.identity.secondaryColors = [d.colors[1]];
  b.identity.accentColors = [d.colors[2]];
  b.identity.typography = { heading: "Archivo", body: "Archivo", provenance: "extracted" };
  return b;
}

function build(d: Def): SampleProduct {
  const brand = brandFor(d);
  const make = (aspectRatio: Ratio) => {
    const raw = aiConceptFixture(d.concepts[0].title);
    raw.cta = d.cta;
    d.scenes(raw.scenePlan.scenes as unknown as RawScene[]);
    return finalizeConcept(AIConcept.parse(raw), brand, CreativePreferences.parse({ aspectRatio, musicTrack: d.track })).scenePlan;
  };
  const plans = { "16:9": make("16:9"), "9:16": make("9:16"), "1:1": make("1:1"), "4:5": make("4:5") };
  const t = trackById(d.track);
  const { scenes: _scenes, track: _track, ...rest } = d;
  void _scenes;
  void _track;
  return { ...rest, plans, music: t ? `${t.title}, ${t.bpm} bpm` : "No music" };
}

const DEFS: Def[] = [
  {
    id: "mug",
    name: "Lumen Mug",
    mark: "Lumen",
    host: "lumenmug.example",
    kind: "Physical product",
    colors: ["#E8572A", "#2B2D42", "#F2C14E"],
    meta: "Archivo · light · $39",
    facts: [
      { label: "Promise", value: "Your coffee, hot for 3 hours", tone: "verified" },
      { label: "Feature", value: "Dishwasher-safe lid", tone: "verified" },
      { label: "Audience", value: "Busy remote workers", tone: "inferred" },
    ],
    concepts: [
      { slot: "A", name: "Problem → Solution", title: "Never cold again", hook: "Problem hook", headline: "Cold coffee. Again." },
      { slot: "B", name: "Product in Motion", title: "Sip. Set. Stay hot.", hook: "Product demo", headline: "Sip. Set. Stay hot." },
      { slot: "C", name: "Brand Manifesto", title: "Good mornings deserve better", hook: "Story", headline: "Mornings, upgraded." },
    ],
    cta: "Shop now",
    track: "bright-pop",
    scenes: ([a, b, c, e]) => {
      Object.assign(a, { durationSec: 2.6, headline: "Cold coffee. Again.", supportingText: "9:42am, third reheat", background: { type: "split", color: "paper", secondaryColor: "primary" }, visualElements: [{ type: "word_stagger", text: "Cold coffee. Again." }, { type: "shape_burst" }], animation: { type: "word_stagger", staggerMs: 110 }, transition: { type: "wipe_left", durationMs: 350 } });
      Object.assign(b, { durationSec: 3.4, headline: "Hot for 3 hours.", background: { type: "solid", color: "paper" }, visualElements: [{ type: "screenshot_reveal" }, { type: "feature_callout", text: "Smart heat", icon: "bolt" }, { type: "feature_callout", text: "Dishwasher-safe lid", icon: "check", color: "secondary" }], animation: { type: "slide_in_left", durationMs: 500 }, transition: { type: "circle_reveal", durationMs: 450 } });
      Object.assign(c, { durationSec: 2.6, headline: "hours of perfect sips", background: { type: "shape_field", color: "primary" }, visualElements: [{ type: "stat_counter", text: "3" }, { type: "kinetic_text" }], animation: { type: "scale_pop" }, transition: { type: "zoom_through", durationMs: 400 }, audioCues: [{ atSec: 0, cue: "beat_drop" }] });
      Object.assign(e, { durationSec: 3, headline: "Good mornings, kept warm.", background: { type: "solid", color: "paper" }, visualElements: [{ type: "cta_end_card", text: "Shop now" }, { type: "logo_reveal" }], animation: { type: "tracking_reveal", durationMs: 700 }, cta: { text: "Shop now" }, audioCues: [{ atSec: 0.4, cue: "hit" }] });
    },
  },
  {
    id: "app",
    name: "Loopnote",
    mark: "Loopnote",
    host: "loopnote.example",
    kind: "App / SaaS",
    colors: ["#3B5BFF", "#0F172A", "#22D3A5"],
    meta: "Archivo · bold · Free trial",
    facts: [
      { label: "Promise", value: "Habits that stick, 2 minutes a day", tone: "verified" },
      { label: "Feature", value: "Daily streak reminders", tone: "verified" },
      { label: "Audience", value: "People restarting routines", tone: "inferred" },
    ],
    concepts: [
      { slot: "A", name: "Problem → Solution", title: "The last habit app you'll need", hook: "Problem hook", headline: "Day 3. Gave up. Again." },
      { slot: "B", name: "App walkthrough", title: "Tap. Track. Keep the streak.", hook: "Screen demo", headline: "Tap. Track. Done." },
      { slot: "C", name: "Before / After", title: "From someday to every day", hook: "Transformation", headline: "Someday → every day." },
    ],
    cta: "Start free trial",
    track: "tech-pulse",
    scenes: ([a, b, c, e]) => {
      Object.assign(a, { durationSec: 2.4, headline: "Day 3. Gave up. Again.", background: { type: "solid", color: "secondary" }, visualElements: [{ type: "word_stagger", text: "Day 3. Gave up. Again." }], animation: { type: "word_stagger", staggerMs: 90 }, transition: { type: "wipe_up", durationMs: 300 } });
      Object.assign(b, { durationSec: 3.6, headline: "Habits that stick.", supportingText: "2 minutes a day", background: { type: "solid", color: "paper" }, visualElements: [{ type: "screenshot_reveal" }, { type: "feature_callout", text: "Daily nudge", icon: "calendar" }, { type: "feature_callout", text: "Streaks", icon: "chart", color: "accent" }], animation: { type: "slide_in_left", durationMs: 450 }, cta: { text: "Try it free" }, transition: { type: "wipe_left", durationMs: 300 } });
      Object.assign(c, { durationSec: 2.4, headline: "minutes a day", background: { type: "shape_field", color: "primary" }, visualElements: [{ type: "stat_counter", text: "2" }, { type: "kinetic_text" }], animation: { type: "scale_pop" }, transition: { type: "zoom_through", durationMs: 350 }, audioCues: [{ atSec: 0, cue: "beat_drop" }] });
      Object.assign(e, { durationSec: 3, headline: "Start your streak today.", background: { type: "solid", color: "paper" }, visualElements: [{ type: "cta_end_card", text: "Start free trial" }, { type: "logo_reveal" }], animation: { type: "tracking_reveal", durationMs: 600 }, cta: { text: "Start free trial" }, audioCues: [{ atSec: 0.4, cue: "hit" }] });
    },
  },
  {
    id: "course",
    name: "Kiln at Home",
    mark: "Kiln",
    host: "kilnathome.example",
    kind: "Online course",
    colors: ["#2F6F4F", "#1F2937", "#F4A261"],
    meta: "Archivo · warm · $79 course",
    facts: [
      { label: "Promise", value: "Make your first bowl this weekend", tone: "verified" },
      { label: "Feature", value: "24 short video lessons", tone: "verified" },
      { label: "Audience", value: "Curious beginners", tone: "inferred" },
    ],
    concepts: [
      { slot: "A", name: "Curiosity hook", title: "Always wanted to try pottery?", hook: "Question hook", headline: "Always wanted to try pottery?" },
      { slot: "B", name: "What's inside", title: "24 lessons, one kitchen table", hook: "Course tour", headline: "24 lessons. No studio." },
      { slot: "C", name: "Maker story", title: "Made by your hands", hook: "Story", headline: "Made by your hands." },
    ],
    cta: "Enroll now",
    track: "acoustic-sunrise",
    scenes: ([a, b, c, e]) => {
      Object.assign(a, { durationSec: 2.8, headline: "Always wanted to try pottery?", background: { type: "split", color: "paper", secondaryColor: "accent" }, visualElements: [{ type: "word_stagger", text: "Always wanted to try pottery?" }], animation: { type: "word_stagger", staggerMs: 120 }, transition: { type: "crossfade", durationMs: 450 } });
      Object.assign(b, { durationSec: 3.4, headline: "Learn it at home.", background: { type: "solid", color: "paper" }, visualElements: [{ type: "screenshot_reveal" }, { type: "feature_callout", text: "No wheel needed", icon: "check" }, { type: "feature_callout", text: "Lifetime access", icon: "play", color: "accent" }], animation: { type: "slide_in_left", durationMs: 550 }, cta: { text: "See the lessons" }, transition: { type: "circle_reveal", durationMs: 450 } });
      Object.assign(c, { durationSec: 2.6, headline: "bite-size lessons", background: { type: "shape_field", color: "primary" }, visualElements: [{ type: "stat_counter", text: "24" }, { type: "kinetic_text" }], animation: { type: "scale_pop" }, transition: { type: "crossfade", durationMs: 400 } });
      Object.assign(e, { durationSec: 3, headline: "Your first bowl, this weekend.", background: { type: "solid", color: "paper" }, visualElements: [{ type: "cta_end_card", text: "Enroll now" }, { type: "logo_reveal" }], animation: { type: "tracking_reveal", durationMs: 700 }, cta: { text: "Enroll now" }, audioCues: [{ atSec: 0.4, cue: "hit" }] });
    },
  },
  {
    id: "serum",
    name: "Dewly Serum",
    mark: "Dewly",
    host: "dewly.example",
    kind: "Beauty product",
    colors: ["#E86A92", "#3D2C3E", "#FFD6E0"],
    meta: "Archivo · soft · $28",
    facts: [
      { label: "Promise", value: "Glow you can see in a week", tone: "verified" },
      { label: "Feature", value: "Fragrance-free formula", tone: "verified" },
      { label: "Audience", value: "Sensitive-skin shoppers", tone: "inferred" },
    ],
    concepts: [
      { slot: "A", name: "Problem → Solution", title: "Dull skin? Meet dew.", hook: "Problem hook", headline: "Dull by 3pm?" },
      { slot: "B", name: "Routine demo", title: "Three drops, all day glow", hook: "How-to", headline: "Three drops. That's it." },
      { slot: "C", name: "Bestseller", title: "The one everyone's restocking", hook: "Social proof", headline: "Back in stock." },
    ],
    cta: "Shop the serum",
    track: "deep-house",
    scenes: ([a, b, c, e]) => {
      Object.assign(a, { durationSec: 2.4, headline: "Dull by 3pm?", background: { type: "split", color: "paper", secondaryColor: "accent" }, visualElements: [{ type: "word_stagger", text: "Dull by 3pm?" }, { type: "shape_burst" }], animation: { type: "word_stagger", staggerMs: 120 }, transition: { type: "wipe_left", durationMs: 300 } });
      Object.assign(b, { durationSec: 3.4, headline: "Three drops. All-day glow.", background: { type: "solid", color: "paper" }, visualElements: [{ type: "screenshot_reveal" }, { type: "feature_callout", text: "Fragrance-free", icon: "heart" }, { type: "feature_callout", text: "Vegan", icon: "sparkle", color: "secondary" }], animation: { type: "slide_in_left", durationMs: 450 }, cta: { text: "Add to bag" }, transition: { type: "circle_reveal", durationMs: 400 } });
      Object.assign(c, { durationSec: 2.6, headline: "days to visible glow", background: { type: "shape_field", color: "primary" }, visualElements: [{ type: "stat_counter", text: "7" }, { type: "kinetic_text" }], animation: { type: "scale_pop" }, transition: { type: "zoom_through", durationMs: 350 }, audioCues: [{ atSec: 0, cue: "beat_drop" }] });
      Object.assign(e, { durationSec: 3, headline: "Your skin, but dewier.", background: { type: "solid", color: "paper" }, visualElements: [{ type: "cta_end_card", text: "Shop the serum" }, { type: "logo_reveal" }], animation: { type: "tracking_reveal", durationMs: 600 }, cta: { text: "Shop the serum" }, audioCues: [{ atSec: 0.4, cue: "hit" }] });
    },
  },
];

export const SAMPLE_PRODUCTS: SampleProduct[] = DEFS.map(build);

/** Kept for the dev preview page and older callers. */
export const sampleBrand: BrandProfile = brandFor(DEFS[0]);
export const samplePlan = SAMPLE_PRODUCTS[0].plans["16:9"];
export const sampleVerticalPlan = SAMPLE_PRODUCTS[0].plans["9:16"];
