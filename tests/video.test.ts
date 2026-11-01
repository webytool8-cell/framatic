import { describe, expect, it } from "vitest";
import { AIConcept, CreativePreferences } from "@/lib/creative/concept";
import { finalizeConcept } from "@/lib/creative/director";
import { blankBrandProfile } from "@/lib/brand/schema";
import { buildTimeline, googleFontsHref, inkOn, parseStat, resolveColor, sceneStarts } from "@/video/timeline";
import { aiConceptFixture } from "./helpers";

const plan = finalizeConcept(AIConcept.parse(aiConceptFixture()), blankBrandProfile("X"), CreativePreferences.parse({})).scenePlan;

describe("video timeline", () => {
  it("converts scenes to frames and overlaps transitions", () => {
    const t = buildTimeline(plan, 30);
    expect(t.scenes.map((s) => s.durationInFrames)).toEqual([120, 120, 120, 120]);
    // 3 wipe transitions of 300ms = 9 frames each; the last scene has none
    expect(t.scenes.map((s) => s.transitionFrames)).toEqual([9, 9, 9, 0]);
    expect(t.durationInFrames).toBe(480 - 27);
  });

  it("treats cuts as zero-length and clamps long transitions", () => {
    const p = structuredClone(plan);
    p.scenes[0].transition = { type: "cut", durationMs: 1500 };
    p.scenes[1].transition = { type: "crossfade", durationMs: 1500 };
    p.scenes[2].durationSec = 1;
    const t = buildTimeline(p, 30);
    expect(t.scenes[0].transitionFrames).toBe(0);
    expect(t.scenes[1].transitionFrames).toBe(15); // half of the 1s neighbour
  });

  it("jumps to the point each scene is fully visible", () => {
    expect(sceneStarts(plan, 30)).toEqual([0, 120, 231, 342]);
  });

  it("resolves colors and contrast", () => {
    expect(resolveColor("primary", plan)).toBe(plan.palette.primary);
    expect(resolveColor("#123456", plan)).toBe("#123456");
    expect(inkOn("#FFFFFF")).toBe("#202124");
    expect(inkOn("#202124")).toBe("#FFFFFF");
  });

  it("parses stats and builds safe font URLs", () => {
    expect(parseStat("3x faster")).toEqual({ prefix: "", value: 3, decimals: 0, suffix: "x faster" });
    expect(parseStat("$1.5M saved")).toEqual({ prefix: "$", value: 1.5, decimals: 1, suffix: "M saved" });
    expect(parseStat("no number")).toBeNull();
    expect(googleFontsHref(["Sora", "Inter", "Sora"])).toBe("https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&family=Inter:wght@400;600;700&display=swap");
    expect(googleFontsHref(["evil\"><script>", ""])).toBeNull();
  });
});
