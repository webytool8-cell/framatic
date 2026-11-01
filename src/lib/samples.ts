import { blankBrandProfile, type BrandProfile } from "@/lib/brand/schema";
import { AIConcept, CreativePreferences } from "@/lib/creative/concept";
import { finalizeConcept } from "@/lib/creative/director";
import type { ScenePlan } from "@/lib/creative/scene-plan";
import { aiConceptFixture } from "@/lib/dev/sample-data";

/** Fictional sample brand + storyboard used to show real UI on the marketing page. */
export const sampleBrand: BrandProfile = (() => {
  const b = blankBrandProfile("Tidyflow");
  b.identity.primaryColor = "#14B88A";
  b.identity.secondaryColors = ["#FF7A1A"];
  b.identity.accentColors = ["#1B1B1F"];
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
  Object.assign(a, { durationSec: 2.6, headline: "200 unread.", supportingText: "Monday, 9:02am", background: { type: "split", color: "paper", secondaryColor: "primary" }, visualElements: [{ type: "word_stagger", text: "200 unread." }, { type: "shape_burst" }], animation: { type: "word_stagger", staggerMs: 110 }, transition: { type: "wipe_left", durationMs: 350 } });
  Object.assign(b, { durationSec: 3.4, headline: "Routed. Drafted. Done.", background: { type: "solid", color: "paper" }, visualElements: [{ type: "product_recording" }, { type: "feature_callout", text: "Auto-routing", icon: "bolt" }, { type: "feature_callout", text: "AI drafts", icon: "sparkle", color: "secondary" }], animation: { type: "slide_in_left", durationMs: 500 }, transition: { type: "circle_reveal", durationMs: 450 } });
  Object.assign(d, { durationSec: 2.6, headline: "faster replies", background: { type: "shape_field", color: "primary" }, visualElements: [{ type: "stat_counter", text: "3x" }, { type: "kinetic_text" }], animation: { type: "scale_pop" }, transition: { type: "zoom_through", durationMs: 400 } });
  Object.assign(e, { durationSec: 3, headline: "Inbox zero, every day.", background: { type: "solid", color: "paper" }, visualElements: [{ type: "cta_end_card", text: "Start free trial" }, { type: "logo_reveal" }], animation: { type: "tracking_reveal", durationMs: 700 }, cta: { text: "Start free trial" } });
}

export const samplePlan = plan("Inbox, sorted.", richer);
export const sampleVerticalPlan = plan("Inbox, sorted.", richer, "9:16");
