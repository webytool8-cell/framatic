import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ScenePlan } from "@/lib/creative/scene-plan";
import { attachPhotos, listPhotos } from "@/lib/photos/library";
import { buildImagePrompt } from "@/lib/photos/generate";
import { cameraTransform, seeded } from "@/video/graphics";
import { samplePlan, sampleBrand } from "@/lib/samples";
import { FakeDB } from "./fake-supabase";

const asDb = (f: FakeDB) => f as unknown as SupabaseClient;

function planWithPhotos() {
  const plan = structuredClone(samplePlan);
  plan.scenes[0].visualElements.push({ type: "photo", position: "full", prompt: "a sunny desk with a laptop", photoStyle: "full" });
  plan.scenes[2].visualElements.push({ type: "photo", position: "center", src: "https://evil.example/x.jpg", prompt: "hands around a warm mug" });
  return plan;
}

describe("photos in plans", () => {
  it("old plans still validate: graphics and camera are optional", () => {
    const old = structuredClone(samplePlan) as Record<string, unknown>;
    delete old.graphics;
    for (const s of old.scenes as Record<string, unknown>[]) delete s.camera;
    const parsed = ScenePlan.parse(old);
    expect(parsed.graphics).toBe("lively");
    expect(parsed.scenes[0].camera).toBeUndefined();
  });

  it("fills photo elements from the project library and never keeps outside URLs", async () => {
    const db = new FakeDB();
    db.table("assets").push(
      { id: "a1", project_id: "p1", user_id: "u1", kind: "photo", url: "https://cdn.example/storage/p1/a.jpg", alt: "Mug on desk", prompt: null, created_at: "2026-11-01" },
      { id: "a2", project_id: "p1", user_id: "u1", kind: "photo", url: "https://cdn.example/storage/p1/b.jpg", alt: "Mug close-up", prompt: null, created_at: "2026-11-02" },
    );
    const plan = await attachPhotos(asDb(db), { userId: "u1", projectId: "p1", brand: sampleBrand, plan: planWithPhotos(), aiBudget: 0 });
    const srcs = plan.scenes.flatMap((s) => s.visualElements.filter((v) => v.type === "photo").map((v) => v.src));
    expect(srcs).toEqual(["https://cdn.example/storage/p1/a.jpg", "https://cdn.example/storage/p1/b.jpg"]);
    expect(srcs).not.toContain("https://evil.example/x.jpg");
    expect(plan.scenes[2].visualElements.find((v) => v.type === "photo")).toMatchObject({ motion: "ken_burns", photoStyle: "card" });
  });

  it("drops photo elements when there's nothing to show", async () => {
    const db = new FakeDB();
    const plan = await attachPhotos(asDb(db), { userId: "u1", projectId: "p1", brand: sampleBrand, plan: planWithPhotos(), aiBudget: 0 });
    expect(plan.scenes.some((s) => s.visualElements.some((v) => v.type === "photo"))).toBe(false);
    expect(plan.scenes.every((s) => s.visualElements.length >= 1)).toBe(true);
    expect(await listPhotos(asDb(db), "u1", "p1")).toEqual([]);
  });

  it("asks the image model for scenes, never a made-up version of the product", () => {
    const p = buildImagePrompt("hands around a warm mug on a rainy morning", { category: "Drinkware", colors: ["#E8572A"], tone: "warm" });
    expect(p).toMatch(/hands around a warm mug/);
    expect(p).toMatch(/Do not show any specific branded product/);
    expect(p).toMatch(/No text/);
  });
});

describe("camera and graphics", () => {
  it("zooms toward the chosen spot, not just the middle", () => {
    const cam = { move: "push_in" as const, focus: { x: 0.8, y: 0.25 }, scale: 1.5 };
    expect(cameraTransform(cam, 0, 0, 30, 90)).toEqual({ transform: "scale(1)", transformOrigin: "80.00% 25.00%" });
    expect(cameraTransform(cam, 1, 89, 30, 90).transform).toBe("scale(1.5)");
  });

  it("punch-in holds, then snaps in about a third of the way through", () => {
    const cam = { move: "punch_in" as const, focus: { x: 0.7, y: 0.5 }, scale: 1.4 };
    expect(cameraTransform(cam, 0.2, 18, 30, 90).transform).toBe("scale(1)");
    expect(cameraTransform(cam, 0.6, 54, 30, 90).transform).toBe("scale(1.4)");
  });

  it("pans the zoom point from start to end", () => {
    const cam = { move: "pan" as const, focus: { x: 0.2, y: 0.5 }, to: { x: 0.8, y: 0.5 }, scale: 1.3 };
    expect(cameraTransform(cam, 0, 0, 30, 90).transformOrigin).toBe("20.00% 50.00%");
    expect(cameraTransform(cam, 1, 89, 30, 90).transformOrigin).toBe("80.00% 50.00%");
  });

  it("lays out graphics the same way every time for a scene (preview matches export)", () => {
    const a = seeded("scene-1:hook");
    const b = seeded("scene-1:hook");
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(seeded("scene-2:hook")()).not.toBe(seeded("scene-1:hook")());
  });
});
