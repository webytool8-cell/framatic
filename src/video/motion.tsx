import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Scene } from "@/lib/creative/scene-plan";
import { msToFrames } from "./timeline";

type Anim = Scene["animation"];

const EASINGS: Record<Anim["easing"], (t: number) => number> = {
  linear: Easing.linear,
  ease_out: Easing.out(Easing.cubic),
  ease_in_out: Easing.inOut(Easing.cubic),
  spring: Easing.out(Easing.back(1.6)),
  snap: Easing.bezier(0.2, 0.8, 0.2, 1),
};

/** 0→1 progress for an animation starting at `delayMs` and lasting `durationMs`. */
export function useProgress(delayMs: number, durationMs: number, easing: Anim["easing"] = "ease_out") {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = msToFrames(delayMs, fps);
  const len = Math.max(1, msToFrames(durationMs, fps));
  if (easing === "spring") {
    return spring({ frame: frame - start, fps, durationInFrames: len, config: { damping: 12, stiffness: 140 } });
  }
  return interpolate(frame, [start, start + len], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASINGS[easing] });
}

/** Animated headline driven by the scene's controlled-vocabulary animation spec. */
export function AnimatedText({
  text,
  anim,
  style,
  accent,
}: {
  text: string;
  anim: Anim;
  style: React.CSSProperties;
  accent: string;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = useProgress(anim.delayMs, anim.durationMs, anim.easing);
  const words = text.split(/\s+/).filter(Boolean);

  switch (anim.type) {
    case "word_stagger": {
      const stagger = anim.staggerMs || 90;
      return (
        <div style={style}>
          {words.map((w, i) => {
            const start = msToFrames(anim.delayMs + i * stagger, fps);
            const s = spring({ frame: frame - start, fps, config: { damping: 14, stiffness: 160 } });
            return (
              <span key={i} style={{ display: "inline-block", marginRight: "0.24em", opacity: s, transform: `translateY(${(1 - s) * 0.5}em)` }}>
                {w}
              </span>
            );
          })}
        </div>
      );
    }
    case "tracking_reveal":
      return <div style={{ ...style, opacity: p, letterSpacing: `${interpolate(p, [0, 1], [0.45, -0.03])}em`, filter: `blur(${(1 - p) * 8}px)` }}>{text}</div>;
    case "scale_pop": {
      const s = spring({ frame: frame - msToFrames(anim.delayMs, fps), fps, config: { damping: 9, stiffness: 160 } });
      return <div style={{ ...style, transform: `scale(${interpolate(s, [0, 1], [0.6, 1])})`, opacity: Math.min(1, s * 1.5) }}>{text}</div>;
    }
    case "slide_in_left":
    case "slide_in_right": {
      const dir = anim.type === "slide_in_left" ? -1 : 1;
      return <div style={{ ...style, opacity: p, transform: `translateX(${dir * (1 - p) * 60}%)` }}>{text}</div>;
    }
    case "mask_wipe":
      return <div style={{ ...style, clipPath: `inset(0 ${(1 - p) * 100}% 0 0)` }}>{text}</div>;
    case "typewriter": {
      const n = Math.round(p * text.length);
      const caret = Math.floor(frame / 8) % 2 === 0 && p < 1;
      return (
        <div style={style}>
          {text.slice(0, n)}
          <span style={{ opacity: caret ? 1 : 0, color: accent }}>|</span>
        </div>
      );
    }
    case "geometric_sweep": {
      const bar = interpolate(p, [0, 0.5, 1], [0, 1, 1]);
      const reveal = interpolate(p, [0.45, 1], [0, 1], { extrapolateLeft: "clamp" });
      return (
        <div style={{ ...style, position: "relative" }}>
          <span style={{ opacity: reveal }}>{text}</span>
          <span
            aria-hidden
            style={{
              position: "absolute",
              inset: "-0.05em -0.1em",
              background: accent,
              transformOrigin: p < 0.5 ? "left" : "right",
              transform: `scaleX(${p < 0.5 ? bar : 1 - reveal})`,
              borderRadius: "0.12em",
            }}
          />
        </div>
      );
    }
    case "zoom_in":
      return <div style={{ ...style, opacity: p, transform: `scale(${interpolate(p, [0, 1], [1.35, 1])})` }}>{text}</div>;
    case "none":
      return <div style={style}>{text}</div>;
    case "fade_up":
    default:
      return <div style={{ ...style, opacity: p, transform: `translateY(${(1 - p) * 0.6}em)` }}>{text}</div>;
  }
}
