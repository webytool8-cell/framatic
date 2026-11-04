import { useState } from "react";
import { AbsoluteFill, Easing, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Camera, Scene, ScenePlan, VisualElement } from "@/lib/creative/scene-plan";

/*
 * Motion graphics: decorative shapes that float around every scene, extra
 * elements (sparkles, orbits, marquee, confetti), photos with movement, and
 * camera moves that zoom into a chosen spot. All deterministic per scene, so
 * the preview and the exported MP4 match frame for frame.
 */

/** The curved four-point spark from the Framatic mark. */
export const SPARK_VIEWBOX = "133.9 169.5 232.2 232";
export const SPARK_PATH = "M250 169.516C258.929 169.516 256.696 225.277 285.714 249.812C312.5 274.348 366.071 276.578 366.071 285.5C366.071 294.422 312.5 296.652 285.714 321.188C256.696 345.723 258.929 401.484 250 401.484C241.071 401.484 243.304 345.723 214.286 321.188C187.5 296.652 133.929 294.422 133.929 285.5C133.929 276.578 187.5 274.348 214.286 249.812C243.304 225.277 241.071 169.516 250 169.516Z";

/** Small seeded random generator so each scene gets its own, repeatable layout. */
export function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type ShapeKind = "blob" | "ring" | "spark" | "plus" | "dots" | "squiggle" | "pill" | "half";
const KINDS: ShapeKind[] = ["blob", "ring", "spark", "plus", "dots", "squiggle", "pill", "half"];
const COUNT = { calm: 3, lively: 6, bold: 9 } as const;

/** Positions around the edges, keeping the middle clear for the message. */
function edgePosition(r: () => number): { x: number; y: number } {
  const side = Math.floor(r() * 4);
  const along = 4 + r() * 92;
  const depth = 3 + r() * 17;
  if (side === 0) return { x: along, y: depth };
  if (side === 1) return { x: 100 - depth, y: along };
  if (side === 2) return { x: along, y: 100 - depth };
  return { x: depth, y: along };
}

function Shape({ kind, color, size, unit }: { kind: ShapeKind; color: string; size: number; unit: number }) {
  const stroke = Math.max(2, unit * 0.9);
  switch (kind) {
    case "blob":
      return <div style={{ width: size, height: size, borderRadius: "46% 54% 58% 42% / 52% 44% 56% 48%", background: color }} />;
    case "ring":
      return <div style={{ width: size, height: size, borderRadius: "50%", border: `${stroke * 1.4}px solid ${color}` }} />;
    case "spark":
      return (
        <svg viewBox={SPARK_VIEWBOX} width={size} height={size}>
          <path d={SPARK_PATH} fill={color} />
        </svg>
      );
    case "plus":
      return (
        <svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6}>
          <path d="M12 3v18M3 12h18" stroke={color} strokeWidth={4} strokeLinecap="round" />
        </svg>
      );
    case "dots":
      return (
        <svg viewBox="0 0 30 30" width={size} height={size}>
          {[0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => <circle key={`${r}${c}`} cx={5 + c * 10} cy={5 + r * 10} r={2.4} fill={color} />))}
        </svg>
      );
    case "squiggle":
      return (
        <svg viewBox="0 0 120 40" width={size * 1.6} height={size * 0.55}>
          <path d="M4 20c10-14 20-14 28 0s18 14 28 0 18-14 28 0 18 14 28 0" fill="none" stroke={color} strokeWidth={7} strokeLinecap="round" />
        </svg>
      );
    case "pill":
      return <div style={{ width: size * 1.5, height: size * 0.42, borderRadius: size, background: color }} />;
    case "half":
    default:
      return <div style={{ width: size, height: size / 2, borderRadius: `${size}px ${size}px 0 0`, background: color }} />;
  }
}

/** Floating shapes around the edges of every scene. */
export function MotionGraphics({ scene, plan, unit, bg }: { scene: Scene; plan: ScenePlan; unit: number; bg: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const level = plan.graphics ?? "lively";
  const r = seeded(`${scene.id}:${scene.purpose}`);
  const colors = [plan.palette.primary, plan.palette.secondary, plan.palette.accent, plan.palette.ink].filter((c) => c.toLowerCase() !== bg.toLowerCase());
  const n = COUNT[level];
  const items = Array.from({ length: n }, (_, i) => {
    const pos = edgePosition(r);
    return {
      kind: KINDS[Math.floor(r() * KINDS.length)],
      color: colors[Math.floor(r() * colors.length)] ?? plan.palette.primary,
      size: unit * (3 + r() * (level === "bold" ? 12 : 9)),
      ...pos,
      delay: Math.round(i * 2.5 + r() * 4),
      speed: 0.4 + r() * 0.9,
      spin: (r() - 0.5) * (level === "calm" ? 0.4 : 1.2),
      phase: r() * Math.PI * 2,
      dir: r() > 0.5 ? 1 : -1,
    };
  });
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {items.map((it, i) => {
        const pop = spring({ frame: frame - it.delay, fps, config: { damping: 11, stiffness: 140 } });
        const t = frame / fps;
        const dx = Math.sin(t * it.speed + it.phase) * unit * 1.6 + it.dir * t * unit * 0.6 * it.speed;
        const dy = Math.cos(t * it.speed * 0.8 + it.phase) * unit * 1.8;
        const rot = it.spin * frame * 2 + (it.kind === "spark" ? Math.sin(t * 3 + it.phase) * 10 : 0);
        const twinkle = it.kind === "spark" ? 0.85 + 0.15 * Math.sin(t * 5 + it.phase) : 1;
        return (
          <div key={i} style={{ position: "absolute", left: `${it.x}%`, top: `${it.y}%`, transform: `translate(-50%, -50%) translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(${pop * twinkle})` }}>
            <Shape kind={it.kind} color={it.color} size={it.size} unit={unit} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
}

/** A cluster of twinkling brand sparks. */
export function Sparkles({ plan, unit, seed }: { plan: ScenePlan; unit: number; seed: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const r = seeded(`sparkles:${seed}`);
  const colors = [plan.palette.accent, plan.palette.primary, plan.palette.secondary];
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: 7 }, (_, i) => {
        const x = 10 + r() * 80;
        const y = 8 + r() * 84;
        const size = unit * (2.5 + r() * 6);
        const d = Math.round(r() * 18);
        const s = spring({ frame: frame - d, fps, config: { damping: 9, stiffness: 160 } });
        const tw = 0.6 + 0.4 * Math.abs(Math.sin((frame - d) / 7 + i));
        return (
          <svg key={i} viewBox={SPARK_VIEWBOX} width={size} height={size} style={{ position: "absolute", left: `${x}%`, top: `${y}%`, transform: `translate(-50%,-50%) scale(${s * tw}) rotate(${(frame - d) * 1.5}deg)` }}>
            <path d={SPARK_PATH} fill={colors[i % colors.length]} />
          </svg>
        );
      })}
    </AbsoluteFill>
  );
}

/** Rings turning around the middle with dots riding on them. */
export function Orbit({ plan, unit }: { plan: ScenePlan; unit: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const grow = spring({ frame, fps, config: { damping: 14, stiffness: 90 } });
  const rings = [
    { r: 34, c: plan.palette.primary, speed: 0.9, dot: plan.palette.accent },
    { r: 46, c: plan.palette.accent, speed: -0.6, dot: plan.palette.secondary },
  ];
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
      {rings.map((ring, i) => {
        const d = ring.r * unit * 2 * grow;
        const a = frame * ring.speed * 2;
        return (
          <div key={i} style={{ position: "absolute", width: d, height: d, borderRadius: "50%", border: `${unit * 0.5}px dashed ${ring.c}`, transform: `rotate(${a}deg)`, opacity: 0.9 }}>
            <div style={{ position: "absolute", top: -unit * 1.6, left: "50%", width: unit * 3.2, height: unit * 3.2, marginLeft: -unit * 1.6, borderRadius: "50%", background: ring.dot }} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
}

/** A band of repeating words scrolling across the bottom. */
export function Marquee({ text, plan, unit, bg }: { text: string; plan: ScenePlan; unit: number; bg: string }) {
  const frame = useCurrentFrame();
  const band = bg.toLowerCase() === plan.palette.ink.toLowerCase() ? plan.palette.accent : plan.palette.ink;
  const ink = bg.toLowerCase() === plan.palette.ink.toLowerCase() ? plan.palette.ink : plan.palette.paper;
  const words = `${text.toUpperCase()} ✦ `.repeat(8);
  const enter = interpolate(frame, [0, 10], [100, 0], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  return (
    <div style={{ position: "absolute", left: "-5%", right: "-5%", bottom: unit * 5, height: unit * 9, background: band, transform: `translateY(${enter}%) rotate(-2deg)`, overflow: "hidden", display: "flex", alignItems: "center" }}>
      <div style={{ whiteSpace: "nowrap", color: ink, fontWeight: 800, fontSize: unit * 4.4, letterSpacing: "0.02em", transform: `translateX(${-frame * unit * 0.6}px)` }}>{words}</div>
    </div>
  );
}

/** Pieces falling and spinning, for celebratory beats. */
export function Confetti({ plan, unit, seed }: { plan: ScenePlan; unit: number; seed: string }) {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const r = seeded(`confetti:${seed}`);
  const colors = [plan.palette.primary, plan.palette.secondary, plan.palette.accent];
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      {Array.from({ length: 36 }, (_, i) => {
        const x = r() * 100;
        const delay = r() * fps * 0.8;
        const fall = (frame - delay) * unit * (0.5 + r() * 0.7);
        const sway = Math.sin((frame + i * 9) / 9) * unit * 2;
        const w = unit * (0.8 + r() * 1.2);
        const round = r() > 0.6;
        if (frame < delay) return null;
        return (
          <div key={i} style={{ position: "absolute", left: `${x}%`, top: -unit * 4, width: w, height: round ? w : w * 2.2, borderRadius: round ? "50%" : unit * 0.2, background: colors[i % 3], transform: `translate(${sway}px, ${Math.min(fall, height * 1.2)}px) rotate(${(frame - delay) * (6 + i % 5)}deg)` }} />
        );
      })}
    </AbsoluteFill>
  );
}

/* ---------- photos ---------- */

function useImageOk() {
  const [ok, setOk] = useState(true);
  return [ok, () => setOk(false)] as const;
}

/** Scale and position over the scene for a photo motion. */
function photoTransform(motion: VisualElement["motion"], p: number): string {
  switch (motion) {
    case "zoom_out":
      return `scale(${interpolate(p, [0, 1], [1.22, 1.02])})`;
    case "pan_left":
      return `scale(1.18) translateX(${interpolate(p, [0, 1], [5, -5])}%)`;
    case "pan_right":
      return `scale(1.18) translateX(${interpolate(p, [0, 1], [-5, 5])}%)`;
    case "float":
      return `scale(1.06) translateY(${Math.sin(p * Math.PI * 2) * 2}%)`;
    case "ken_burns":
    default:
      return `scale(${interpolate(p, [0, 1], [1.02, 1.16])}) translate(${interpolate(p, [0, 1], [-1.5, 1.5])}%, ${interpolate(p, [0, 1], [1, -1])}%)`;
  }
}

/** Full-bleed photo behind the scene, tinted with the background color so text stays readable. */
export function PhotoBackdrop({ el, bg, progress }: { el: VisualElement; bg: string; progress: number }) {
  const [ok, fail] = useImageOk();
  if (!el.src || !ok) return null;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Img src={el.src} onError={fail} style={{ width: "100%", height: "100%", objectFit: "cover", transform: photoTransform(el.motion, progress) }} />
      <AbsoluteFill style={{ background: `linear-gradient(180deg, ${bg}99 0%, ${bg}cc 55%, ${bg}ee 100%)` }} />
    </AbsoluteFill>
  );
}

/** Framed photo in the scene's media slot: card, circle or tilted print, with its own motion. */
export function PhotoMedia({ el, unit, progress, plan }: { el: VisualElement; unit: number; progress: number; plan: ScenePlan }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const [ok, fail] = useImageOk();
  const pop = spring({ frame: frame - 3, fps, config: { damping: 13, stiffness: 120 } });
  if (!el.src || !ok) return null;
  const style = el.photoStyle ?? "card";
  const float = Math.sin(frame / fps * 1.4) * unit * 0.8;
  const frameStyle: React.CSSProperties =
    style === "circle"
      ? { borderRadius: "50%", aspectRatio: "1 / 1", height: "auto", width: "min(100%, 100cqh)", maxHeight: "100%", border: `${unit * 1.2}px solid ${plan.palette.paper}` }
      : style === "tilted"
        ? { borderRadius: unit * 0.8, border: `${unit * 1.6}px solid #FFFFFF`, borderBottomWidth: unit * 5, transform: `rotate(${-4 + Math.sin(frame / 30) * 1.2}deg)` }
        : { borderRadius: unit * 2.4 };
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", containerType: "size" }}>
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          overflow: "hidden",
          boxShadow: `0 ${unit * 3}px ${unit * 8}px -${unit * 3}px rgba(0,0,0,0.45)`,
          transform: `translateY(${(1 - pop) * 40 + float}px) scale(${0.9 + pop * 0.1})`,
          opacity: pop,
          background: plan.palette.secondary,
          ...frameStyle,
        }}
      >
        <Img src={el.src} onError={fail} style={{ width: "100%", height: "100%", objectFit: "cover", transform: photoTransform(el.motion, progress) }} />
      </div>
    </div>
  );
}

/* ---------- camera ---------- */

/** Scale and transform-origin for a camera move at progress p (0–1 over the scene). */
export function cameraTransform(camera: Camera | undefined, p: number, frame: number, fps: number, sceneFrames: number): { transform: string; transformOrigin: string } {
  const move = camera?.move ?? "drift";
  const focus = camera?.focus ?? { x: 0.5, y: 0.5 };
  const s = camera?.scale ?? 1.35;
  const origin = (f: { x: number; y: number }) => `${(f.x * 100).toFixed(2)}% ${(f.y * 100).toFixed(2)}%`;
  const ease = Easing.inOut(Easing.cubic);
  switch (move) {
    case "none":
      return { transform: "none", transformOrigin: "50% 50%" };
    case "push_in":
      return { transform: `scale(${interpolate(p, [0, 1], [1, s], { easing: ease })})`, transformOrigin: origin(focus) };
    case "pull_out":
      return { transform: `scale(${interpolate(p, [0, 1], [s, 1], { easing: Easing.out(Easing.cubic) })})`, transformOrigin: origin(focus) };
    case "punch_in": {
      // Hold, then snap in on (roughly) the beat a third of the way through.
      const at = Math.round(sceneFrames * 0.35);
      const k = interpolate(frame, [at, at + Math.round(fps * 0.22)], [1, s], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.2, 0.8, 0.2, 1) });
      return { transform: `scale(${k})`, transformOrigin: origin(focus) };
    }
    case "pan": {
      const to = camera?.to ?? { x: 1 - focus.x, y: focus.y };
      const cur = { x: interpolate(p, [0, 1], [focus.x, to.x], { easing: ease }), y: interpolate(p, [0, 1], [focus.y, to.y], { easing: ease }) };
      return { transform: `scale(${Math.max(1.2, s)})`, transformOrigin: origin(cur) };
    }
    case "drift":
    default:
      return { transform: `scale(${interpolate(p, [0, 1], [1, 1.05])}) translateX(${interpolate(p, [0, 1], [0, -0.8])}%)`, transformOrigin: origin(focus) };
  }
}

/** Wraps a scene's visuals in its camera move. */
export function CameraRig({ camera, sceneFrames, children }: { camera?: Camera; sceneFrames: number; children: React.ReactNode }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = Math.min(1, Math.max(0, frame / Math.max(1, sceneFrames - 1)));
  const { transform, transformOrigin } = cameraTransform(camera, p, frame, fps, sceneFrames);
  return <AbsoluteFill style={{ transform, transformOrigin, willChange: "transform" }}>{children}</AbsoluteFill>;
}
