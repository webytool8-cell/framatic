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

export const samplePlan = plan("Inbox, sorted.", (c) => {
  c.scenePlan.scenes[0].background = { type: "split", color: "paper", secondaryColor: "primary" } as never;
  c.scenePlan.scenes[1].visualElements = [{ type: "screenshot_reveal", text: "Routing" } as never];
  c.scenePlan.scenes[2].background = { type: "shape_field", color: "primary" } as never;
});
