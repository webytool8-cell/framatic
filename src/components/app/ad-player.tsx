"use client";
import { Player, type PlayerRef } from "@remotion/player";
import { useEffect, useMemo, useRef } from "react";
import { AdVideo, type AdVideoProps } from "@/video/AdVideo";
import { buildTimeline, DIMENSIONS, FPS, googleFontsHref } from "@/video/timeline";
import type { ScenePlan } from "@/lib/creative/scene-plan";

/**
 * Live, in-browser animated preview of a scene plan. This is the Phase 2
 * renderer's composition running in the Remotion Player (no export yet).
 */
export default function AdPlayer({
  plan,
  logoUrl,
  productName,
  autoPlay = false,
  loop = true,
  controls = true,
  className,
  onFrame,
  seekTo,
}: {
  plan: ScenePlan;
  logoUrl?: string | null;
  productName?: string;
  autoPlay?: boolean;
  loop?: boolean;
  controls?: boolean;
  className?: string;
  onFrame?: (frame: number) => void;
  seekTo?: { frame: number; id: number } | null;
}) {
  const ref = useRef<PlayerRef>(null);
  const { width, height } = DIMENSIONS[plan.aspectRatio];
  const { durationInFrames } = useMemo(() => buildTimeline(plan), [plan]);
  const inputProps: AdVideoProps = useMemo(() => ({ plan, logoUrl, productName }), [plan, logoUrl, productName]);

  // Load the brand's fonts from Google Fonts when available.
  useEffect(() => {
    const href = googleFontsHref([plan.fonts.heading, plan.fonts.body]);
    if (!href || document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }, [plan.fonts.heading, plan.fonts.body]);

  useEffect(() => {
    const p = ref.current;
    if (!p || !onFrame) return;
    const h = (e: { detail: { frame: number } }) => onFrame(e.detail.frame);
    p.addEventListener("frameupdate", h);
    return () => p.removeEventListener("frameupdate", h);
  }, [onFrame]);

  useEffect(() => {
    if (seekTo) ref.current?.seekTo(seekTo.frame);
  }, [seekTo]);

  return (
    <Player
      ref={ref}
      component={AdVideo}
      inputProps={inputProps}
      durationInFrames={durationInFrames}
      fps={FPS}
      compositionWidth={width}
      compositionHeight={height}
      controls={controls}
      loop={loop}
      autoPlay={autoPlay}
      // Autoplaying previews start muted so browsers allow them; click-to-play ones have sound.
      initiallyMuted={autoPlay}
      // Show a frame where the first scene has animated in, not a blank start.
      initialFrame={autoPlay ? 0 : Math.min(30, durationInFrames - 1)}
      acknowledgeRemotionLicense
      clickToPlay
      style={{ width: "100%", aspectRatio: `${width} / ${height}`, borderRadius: 12, overflow: "hidden" }}
      className={className}
    />
  );
}
