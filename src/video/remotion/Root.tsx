import { useEffect, useState } from "react";
import { Composition, continueRender, delayRender } from "remotion";
import { AdVideo, type AdVideoProps } from "../AdVideo";
import { buildTimeline, DIMENSIONS, FPS, googleFontsHref } from "../timeline";
import type { ScenePlan } from "@/lib/creative/scene-plan";

/** Waits for the brand's web fonts before frames are captured. */
function AdVideoForRender(props: AdVideoProps) {
  const [handle] = useState(() => delayRender("Loading brand fonts", { timeoutInMilliseconds: 20000 }));
  useEffect(() => {
    const href = googleFontsHref([props.plan.fonts.heading, props.plan.fonts.body]);
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        continueRender(handle);
      }
    };
    const fallback = setTimeout(finish, 6000);
    if (!href) {
      finish();
    } else {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.onload = () => document.fonts.ready.then(finish, finish);
      link.onerror = finish;
      document.head.appendChild(link);
    }
    return () => clearTimeout(fallback);
  }, [handle, props.plan.fonts.heading, props.plan.fonts.body]);
  return <AdVideo {...props} />;
}

const DEFAULT_PLAN: ScenePlan = {
  schemaVersion: 1,
  aspectRatio: "16:9",
  fps: 30,
  durationSec: 6,
  palette: { primary: "#7957FF", secondary: "#FF6B6B", accent: "#39C6E8", ink: "#202124", paper: "#FFFFFF" },
  fonts: { heading: "Archivo", body: "Archivo" },
  music: { mood: "upbeat", bpm: 120, track: "bright-pop", volume: 0.7 },
  scenes: [
    { id: "a", purpose: "hook", durationSec: 2, headline: "Your product.", supportingText: "", visualElements: [{ type: "word_stagger", position: "center" }], animation: { type: "word_stagger", delayMs: 0, durationMs: 600, easing: "ease_out", staggerMs: 90 }, transition: { type: "wipe_left", durationMs: 300 }, background: { type: "solid", color: "paper" }, brandAssets: [], productFootage: { required: false, description: "" }, audioCues: [], cta: null },
    { id: "b", purpose: "reveal", durationSec: 2, headline: "A whole new motion.", supportingText: "", visualElements: [{ type: "shape_burst", position: "center" }], animation: { type: "scale_pop", delayMs: 0, durationMs: 600, easing: "spring", staggerMs: 0 }, transition: { type: "circle_reveal", durationMs: 400 }, background: { type: "shape_field", color: "primary" }, brandAssets: [], productFootage: { required: false, description: "" }, audioCues: [], cta: null },
    { id: "c", purpose: "cta", durationSec: 2, headline: "Made with Framatic", supportingText: "", visualElements: [{ type: "cta_end_card", position: "center" }], animation: { type: "fade_up", delayMs: 0, durationMs: 600, easing: "ease_out", staggerMs: 0 }, transition: { type: "cut", durationMs: 0 }, background: { type: "solid", color: "paper" }, brandAssets: [], productFootage: { required: false, description: "" }, audioCues: [], cta: { text: "Try it" } },
  ],
};

export function RemotionRoot() {
  return (
    <Composition
      id="AdVideo"
      component={AdVideoForRender}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={buildTimeline(DEFAULT_PLAN).durationInFrames}
      defaultProps={{ plan: DEFAULT_PLAN, productName: "Framatic", logoUrl: null } as AdVideoProps}
      calculateMetadata={({ props }) => {
        const plan = (props as AdVideoProps).plan;
        const { width, height } = DIMENSIONS[plan.aspectRatio];
        return { durationInFrames: buildTimeline(plan).durationInFrames, width, height, fps: FPS };
      }}
    />
  );
}
