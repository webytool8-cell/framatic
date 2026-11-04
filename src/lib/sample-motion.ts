import type { Scene, ScenePlan } from "@/lib/creative/scene-plan";

/**
 * Camera moves and extra motion graphics for the built-in sample ads, in the
 * same style the creative director now writes for real ones.
 */
export function animateSample(plan: ScenePlan): ScenePlan {
  const portrait = plan.aspectRatio === "9:16" || plan.aspectRatio === "4:5";
  const last = plan.scenes.length - 1;
  const add = (s: Scene, type: Scene["visualElements"][number]["type"]) =>
    s.visualElements.length < 5 && !s.visualElements.some((v) => v.type === type) ? [...s.visualElements, { type, position: "center" as const }] : s.visualElements;
  const scenes = plan.scenes.map((s, i): Scene => {
    const types = new Set(s.visualElements.map((v) => v.type));
    if (types.has("screenshot_reveal")) {
      // Zoom into the product page's "Add to cart" button.
      return { ...s, camera: { move: "punch_in", focus: { x: 0.76, y: 0.93 }, scale: 1.7 } };
    }
    if (types.has("stat_counter")) {
      return { ...s, visualElements: add(s, "orbit"), camera: { move: "push_in", focus: { x: 0.5, y: 0.45 }, scale: 1.18 } };
    }
    if (i === last) {
      return { ...s, visualElements: add(s, "sparkles"), camera: { move: "pull_out", focus: { x: 0.5, y: 0.5 }, scale: 1.12 } };
    }
    if (i === 0) {
      return { ...s, camera: { move: "push_in", focus: { x: 0.5, y: 0.5 }, scale: 1.12 } };
    }
    return { ...s, camera: { move: "pan", focus: { x: 0.35, y: 0.5 }, to: { x: 0.65, y: 0.5 }, scale: 1.2 } };
  });
  return { ...plan, scenes, graphics: "lively" };
}
