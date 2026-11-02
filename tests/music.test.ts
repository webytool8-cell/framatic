import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { MUSIC_LIBRARY, SFX, SOUND_SETS, TRANSITION_SOUNDS, musicPath, pickTrack, sfxPath, soundForTransition, transitionPath } from "@/video/music";
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
    for (const t of TRANSITION_SOUNDS) expect(existsSync(join("public", transitionPath(t.id)))).toBe(true);
    expect(MUSIC_LIBRARY.length).toBeGreaterThanOrEqual(10);
  });

  it("uses at most two transition sounds per video", () => {
    for (const set of SOUND_SETS) {
      const used = new Set(["wipe_left", "wipe_up", "whip_pan", "circle_reveal", "shape_morph", "zoom_through", "crossfade", "cut"].map((t) => soundForTransition(set.id, t)?.id).filter(Boolean));
      expect(used.size).toBeLessThanOrEqual(2);
      for (const id of set.sounds) expect(TRANSITION_SOUNDS.some((t) => t.id === id)).toBe(true);
    }
    expect(soundForTransition("off", "wipe_left")).toBeNull();
    for (const t of MUSIC_LIBRARY) expect(SOUND_SETS.some((s) => s.id === t.soundSet)).toBe(true);
  });

  it("starts tracks on a whole beat", () => {
    for (const t of MUSIC_LIBRARY) {
      const beats = t.startAtSec / (60 / t.bpm);
      expect(Math.abs(beats - Math.round(beats))).toBeLessThan(0.02);
    }
  });

  it("matches tracks to the concept's mood", () => {
    expect(pickTrack("Warm lo-fi, relaxed").id).toBe("lofi-chill");
    expect(pickTrack("Epic cinematic build").id).toBe("cinematic-rise");
    expect(pickTrack("retro 80s neon").id).toBe("synthwave");
    expect(pickTrack("acoustic, honest and warm").id).toBe("acoustic-sunrise");
    expect(pickTrack("heartfelt, minimal").id).toBe("soft-piano");
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
    // transitions become half a beat or a full beat; word staggers step on 1/8 beats
    expect(snapped.scenes.map((s) => s.transition.durationMs)).toEqual([250, 250, 250, 250]);
    expect(snapped.scenes.every((s) => s.animation.staggerMs === 0 || s.animation.staggerMs % 62.5 < 1 || 62.5 - (s.animation.staggerMs % 62.5) < 1)).toBe(true);
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
    expect(sequenceStarts(plan, 30)).toEqual([0, 116, 237, 357]);
  });
});
