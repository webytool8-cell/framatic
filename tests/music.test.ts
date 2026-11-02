import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { MUSIC_LIBRARY, SFX, musicPath, pickTrack, sfxPath } from "@/video/music";
import { snapToBeats, ScenePlan } from "@/lib/creative/scene-plan";
import { musicVolume, sequenceStarts } from "@/video/timeline";
import { AIConcept, CreativePreferences } from "@/lib/creative/concept";
import { finalizeConcept } from "@/lib/creative/director";
import { blankBrandProfile } from "@/lib/brand/schema";
import { aiConceptFixture } from "./helpers";

const brand = blankBrandProfile("X");

describe("music library", () => {
  it("ships every track and sound effect", () => {
    for (const t of MUSIC_LIBRARY) expect(existsSync(join("public", musicPath(t.id)))).toBe(true);
    for (const s of SFX) expect(existsSync(join("public", sfxPath(s)))).toBe(true);
  });

  it("matches tracks to the concept's mood", () => {
    expect(pickTrack("Warm lo-fi, relaxed").id).toBe("lofi-chill");
    expect(pickTrack("Epic cinematic build").id).toBe("cinematic-rise");
    expect(pickTrack("modern tech, confident").id).toBe("tech-pulse");
    expect(pickTrack("quirky and playful").id).toBe("playful-bounce");
    expect(pickTrack("something", 121).id).toBe("bright-pop"); // nearest tempo when no words match
  });
});

describe("beat-aware timing", () => {
  it("snaps scene lengths to half-beats within bounds", () => {
    const plan = finalizeConcept(AIConcept.parse(aiConceptFixture()), brand, CreativePreferences.parse({})).scenePlan;
    const snapped = snapToBeats({ ...plan, scenes: plan.scenes.map((s, i) => ({ ...s, durationSec: [1.13, 4.4, 0.5, 11.9][i] })) }, 120);
    expect(snapped.scenes.map((s) => s.durationSec)).toEqual([1.25, 4.5, 0.75, 12]);
    expect(snapped.music.bpm).toBe(120);
  });

  it("chooses a track automatically and keeps the user's choice on regeneration", () => {
    const auto = finalizeConcept(AIConcept.parse({ ...aiConceptFixture(), musicMood: "Warm lo-fi beat" }), brand, CreativePreferences.parse({}));
    expect(auto.scenePlan.music.track).toBe("lofi-chill");
    expect(auto.scenePlan.music.bpm).toBe(86);
    const kept = finalizeConcept(AIConcept.parse({ ...aiConceptFixture(), musicMood: "Warm lo-fi beat" }), brand, CreativePreferences.parse({ musicTrack: "tech-pulse" }));
    expect(kept.scenePlan.music.track).toBe("tech-pulse");
    const silent = finalizeConcept(AIConcept.parse(aiConceptFixture()), brand, CreativePreferences.parse({ musicTrack: "none" }));
    expect(silent.scenePlan.music.track).toBe("none");
    expect(ScenePlan.safeParse(silent.scenePlan).success).toBe(true);
  });

  it("fades music in and out", () => {
    expect(musicVolume(0, 300, 0.7)).toBe(0);
    expect(musicVolume(150, 300, 0.7)).toBeCloseTo(0.7);
    expect(musicVolume(299, 300, 0.7)).toBeLessThan(0.05);
  });

  it("knows where each scene's sequence starts", () => {
    const plan = finalizeConcept(AIConcept.parse(aiConceptFixture()), brand, CreativePreferences.parse({ musicTrack: "none" })).scenePlan;
    expect(sequenceStarts(plan, 30)).toEqual([0, 111, 222, 333]);
  });
});
