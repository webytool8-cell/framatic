import { blankBrandProfile, type BrandProfile } from "@/lib/brand/schema";
import { AIConcept, CreativePreferences } from "@/lib/creative/concept";
import { finalizeConcept } from "@/lib/creative/director";
import type { ScenePlan } from "@/lib/creative/scene-plan";
import { aiConceptFixture } from "@/lib/dev/sample-data";

/** Fictional sample brand + storyboard used to show real UI on the marketing page. */
export const sampleBrand: BrandProfile = (() => {
  const b = blankBrandProfile("Lumen Mug");
  b.identity.primaryColor = "#E8572A";
  b.identity.secondaryColors = ["#2B2D42"];
  b.identity.accentColors = ["#F2C14E"];
  b.identity.typography = { heading: "Space Grotesk", body: "Space Grotesk", provenance: "extracted" };
  return b;
})();

function plan(title: string, tweak: (c: ReturnType<typeof aiConceptFixture>) => void, aspectRatio: "16:9" | "9:16" = "16:9"): ScenePlan {
  const raw = aiConceptFixture(title);
  tweak(raw);
  return finalizeConcept(AIConcept.parse(raw), sampleBrand, CreativePreferences.parse({ aspectRatio })).scenePlan;
}

function richer(c: ReturnType<typeof aiConceptFixture>) {
  const [a, b, d, e] = c.scenePlan.scenes as unknown as Array<Record<string, unknown>>;
  Object.assign(a, { durationSec: 2.6, headline: "Cold coffee. Again.", supportingText: "9:42am, third reheat", background: { type: "split", color: "paper", secondaryColor: "primary" }, visualElements: [{ type: "word_stagger", text: "Cold coffee. Again." }, { type: "shape_burst" }], animation: { type: "word_stagger", staggerMs: 110 }, transition: { type: "wipe_left", durationMs: 350 } });
  Object.assign(b, { durationSec: 3.4, headline: "Hot for 3 hours.", background: { type: "solid", color: "paper" }, visualElements: [{ type: "screenshot_reveal" }, { type: "feature_callout", text: "Smart heat", icon: "bolt" }, { type: "feature_callout", text: "Dishwasher-safe lid", icon: "check", color: "secondary" }], animation: { type: "slide_in_left", durationMs: 500 }, transition: { type: "circle_reveal", durationMs: 450 } });
  Object.assign(d, { durationSec: 2.6, headline: "hours of perfect sips", background: { type: "shape_field", color: "primary" }, visualElements: [{ type: "stat_counter", text: "3" }, { type: "kinetic_text" }], animation: { type: "scale_pop" }, transition: { type: "zoom_through", durationMs: 400 }, audioCues: [{ atSec: 0, cue: "beat_drop" }] });
  Object.assign(e, { durationSec: 3, headline: "Good mornings, kept warm.", background: { type: "solid", color: "paper" }, visualElements: [{ type: "cta_end_card", text: "Shop now" }, { type: "logo_reveal" }], animation: { type: "tracking_reveal", durationMs: 700 }, cta: { text: "Shop now" }, audioCues: [{ atSec: 0.4, cue: "hit" }] });
}

export const samplePlan = plan("Never cold again", richer);
export const sampleVerticalPlan = plan("Never cold again", richer, "9:16");
