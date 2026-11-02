import { describe, expect, it } from "vitest";
import { AIConcept, CreativePreferences } from "@/lib/creative/concept";
import { finalizeConcept } from "@/lib/creative/director";
import { blankBrandProfile } from "@/lib/brand/schema";
import { buildTimeline, googleFontsHref, inkOn, parseStat, resolveColor, sceneStarts } from "@/video/timeline";
import { snapToBeats } from "@/lib/creative/scene-plan";
import { aiConceptFixture } from "./helpers";

const plan = finalizeConcept(AIConcept.parse(aiConceptFixture()), blankBrandProfile("X"), CreativePreferences.parse({})).scenePlan;

describe("video timeline", () => {
  it("puts every cut on the beat and centres transitions on it", () => {
    // Fixture concept gets Bright Pop (120 bpm): beat = 15 frames, scenes snapped to 4.0s.
    expect(plan.music.track).toBe("bright-pop");
    const t = buildTimeline(plan, 30);
    expect(t.scenes.map((s) => s.cutFrame)).toEqual([120, 240, 360, 480]);
    expect(t.scenes.every((s) => s.cutFrame % 15 === 0)).toBe(true);
    // wipes are snapped to half a beat (250ms = 8 frames)
    expect(t.scenes.map((s) => s.transitionFrames)).toEqual([8, 8, 8, 0]);
    for (let i = 0; i < 3; i++) {
      const mid = t.scenes[i + 1].from + t.scenes[i].transitionFrames / 2;
      expect(Math.abs(mid - t.scenes[i].cutFrame)).toBeLessThanOrEqual(0.5);
      // sequences chain the way TransitionSeries lays them out
      expect(t.scenes[i].from + t.scenes[i].durationInFrames - t.scenes[i].transitionFrames).toBe(t.scenes[i + 1].from);
    }
    expect(t.durationInFrames).toBe(480);
  });

  it("does not drift at tempos that don't divide evenly into frames", () => {
    const p = snapToBeats({ ...plan, music: { ...plan.music, track: "lofi-chill" }, scenes: [...plan.scenes, ...plan.scenes].map((s, i) => ({ ...s, id: `s${i}`, durationSec: 2.1 })) }, 86);
    const beatFrames = (60 / 86) * 30;
    const t = buildTimeline(p, 30);
    for (const s of t.scenes) {
      const beats = s.cutFrame / beatFrames;
      expect(Math.abs(beats * 2 - Math.round(beats * 2)) * (beatFrames / 2)).toBeLessThanOrEqual(0.5); // within half a frame of the half-beat grid
    }
  });

  it("treats cuts as zero-length and clamps long transitions", () => {
    const p = structuredClone(plan);
    p.scenes[0].transition = { type: "cut", durationMs: 1500 };
    p.scenes[1].transition = { type: "crossfade", durationMs: 1500 };
    p.scenes[2].durationSec = 1;
    const t = buildTimeline(p, 30);
    expect(t.scenes[0].transitionFrames).toBe(0);
    expect(t.scenes[1].transitionFrames).toBe(15); // one beat, also half of the 1s neighbour
  });

  it("jumps to the point each scene is fully visible", () => {
    expect(sceneStarts(plan, 30)).toEqual([0, 124, 244, 364]);
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
