import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { ScenePlan, VisualElement } from "@/lib/creative/scene-plan";
import { inkOn, msToFrames, parseStat, resolveColor } from "./timeline";

/* Pre-built visual components. Each maps 1:1 to a controlled-vocabulary type. */

const ICON_PATHS: Record<string, string> = {
  check: "M5 12.5l4.5 4.5L19 7.5",
  bolt: "M13 3L5 13.5h6L10 21l9-11h-6l1-7z",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 4v5l3.5 2",
  chart: "M4 20V10m6 10V4m6 16v-7m4 7H3",
  shield: "M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z",
  users: "M8.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zm7 0a3 3 0 1 0 0-6M2.5 20c0-3.3 2.7-6 6-6s6 2.7 6 6m1-6c2.8 0 5 2.2 5 5",
  cart: "M3 4h2l2.5 11h10L20 7H6.5M9.5 20.5h.01M17 20.5h.01",
  chat: "M4 5h16v11H9l-5 4V5z",
  lock: "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3",
  rocket: "M12 3c4 2 6 6 6 10l-3 3H9l-3-3c0-4 2-8 6-10zm0 6.5h.01M9 19l-2 2m8-2l2 2",
  target: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 4a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 4a1 1 0 1 0 0 2",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3z",
  heart: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z",
  globe: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z",
  mail: "M3 6h18v12H3zM3 6l9 7 9-7",
  search: "M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM20 20l-4.8-4.8",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  play: "M7 4.5v15l12-7.5-12-7.5z",
  arrow_right: "M4 12h15m-6-6l6 6-6 6",
  cursor: "M5 3l14 7-6 2-2 6L5 3z",
  layers: "M12 3l9 5-9 5-9-5 9-5zm-9 10l9 5 9-5",
  gear: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm0-6v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6l2.1 2.1M5.6 18.4l2.1-2.1m8.6-8.6l2.1-2.1",
  wand: "M4 20L16 8m-2-2l4 4M17 3v3m-1.5-1.5h3M20 9v2m-1-1h2",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z",
};

export function Icon({ name, color, size }: { name?: string; color: string; size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={ICON_PATHS[name ?? "sparkle"] ?? ICON_PATHS.sparkle} />
    </svg>
  );
}

function usePop(delayFrames = 0, damping = 12) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delayFrames, fps, config: { damping, stiffness: 150 } });
}

/** Expanding circles and rings. */
export function ShapeBurst({ plan, unit }: { plan: ScenePlan; unit: number }) {
  const shapes = [
    { x: 78, y: 18, r: 9, c: plan.palette.primary, ring: false, d: 0 },
    { x: 14, y: 76, r: 6, c: plan.palette.accent, ring: true, d: 4 },
    { x: 88, y: 82, r: 3.5, c: plan.palette.secondary, ring: false, d: 8 },
    { x: 20, y: 18, r: 2.2, c: plan.palette.secondary, ring: true, d: 10 },
  ];
  return (
    <>
      {shapes.map((s, i) => (
        <BurstShape key={i} {...s} unit={unit} />
      ))}
    </>
  );
}

function BurstShape({ x, y, r, c, ring, d, unit }: { x: number; y: number; r: number; c: string; ring: boolean; d: number; unit: number }) {
  const s = usePop(d, 10);
  const frame = useCurrentFrame();
  const drift = Math.sin((frame + d * 10) / 40) * unit * 0.4;
  const size = r * unit * 2;
  return (
    <div
      style={{
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2 + drift,
        borderRadius: "50%",
        background: ring ? "transparent" : c,
        border: ring ? `${unit * 1.2}px solid ${c}` : undefined,
        transform: `scale(${s})`,
      }}
    />
  );
}

/** A bold bar that sweeps across, leaving geometric marks behind. */
export function GeometricSweep({ plan, unit }: { plan: ScenePlan; unit: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = interpolate(frame, [0, fps * 0.6], [0, 1], { extrapolateRight: "clamp" });
  return (
    <>
      <div style={{ position: "absolute", left: 0, top: "62%", height: unit * 5, width: `${p * 100}%`, background: plan.palette.accent, borderRadius: unit * 2.5 }} />
      <div style={{ position: "absolute", right: `${(1 - p) * 30 + 6}%`, top: "12%", width: unit * 14, height: unit * 14, borderRadius: "50%", background: plan.palette.primary, opacity: p }} />
    </>
  );
}

/** Mock product window. A real screenshot/recording replaces this when the user uploads one. */
export function ProductWindow({ plan, unit, recording, image, label }: { plan: ScenePlan; unit: number; recording: boolean; image?: string | null; label?: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = usePop(msToFrames(150, fps), 16);
  const cursorX = interpolate(frame, [fps * 0.6, fps * 2], [70, 38], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: (t) => 1 - Math.pow(1 - t, 3) });
  const cursorY = interpolate(frame, [fps * 0.6, fps * 2], [80, 58], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: (t) => 1 - Math.pow(1 - t, 3) });
  const click = frame > fps * 2 && frame < fps * 2.3;
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        borderRadius: unit * 1.6,
        background: "#FFFFFF",
        border: "1px solid rgba(0,0,0,0.08)",
        boxShadow: `0 ${unit * 3}px ${unit * 8}px -${unit * 3}px rgba(0,0,0,0.35)`,
        overflow: "hidden",
        transform: `translateY(${(1 - s) * 30}%)`,
        opacity: s,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", gap: unit * 0.8, padding: unit * 1.2, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
        {["#FF6B6B", "#FFD166", "#C5F467"].map((c) => <span key={c} style={{ width: unit * 1.2, height: unit * 1.2, borderRadius: "50%", background: c }} />)}
      </div>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" style={{ width: "100%", flex: 1, minHeight: 0, objectFit: "cover" }} />
      ) : recording ? (
        <div style={{ display: "grid", gridTemplateColumns: "28% 1fr", flex: 1, minHeight: 0 }}>
          <div style={{ background: "#F7F7FA", padding: unit * 1.5, display: "flex", flexDirection: "column", gap: unit }}>
            {[0, 1, 2, 3].map((i) => <div key={i} style={{ height: unit * 1.2, borderRadius: unit, background: i === 1 ? plan.palette.primary : "rgba(0,0,0,0.08)", width: `${80 - i * 10}%` }} />)}
          </div>
          <div style={{ padding: unit * 2, display: "flex", flexDirection: "column", gap: unit * 1.4 }}>
            <div style={{ height: unit * 2, width: "55%", borderRadius: unit, background: "rgba(0,0,0,0.12)" }} />
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: unit, opacity: interpolate(frame, [fps * (0.4 + i * 0.15), fps * (0.6 + i * 0.15)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
                <div style={{ width: unit * 2.4, height: unit * 2.4, borderRadius: "50%", background: [plan.palette.primary, plan.palette.secondary, plan.palette.accent][i] }} />
                <div style={{ flex: 1, height: unit * 1.2, borderRadius: unit, background: "rgba(0,0,0,0.07)" }} />
              </div>
            ))}
            <div style={{ marginTop: "auto", alignSelf: "flex-start", padding: `${unit}px ${unit * 2}px`, borderRadius: unit * 3, background: plan.palette.primary, color: inkOn(plan.palette.primary), fontSize: unit * 1.4, fontWeight: 700, transform: `scale(${click ? 0.94 : 1})` }}>
              {label || "Get started"}
            </div>
          </div>
        </div>
      ) : (
        // Product-page mock: hero image block, title, price, add-to-cart.
        <div style={{ display: "grid", gridTemplateColumns: "52% 1fr", flex: 1, minHeight: 0 }}>
          <div style={{ margin: unit * 1.5, borderRadius: unit * 1.2, background: `radial-gradient(circle at 35% 35%, ${plan.palette.accent} 0%, ${plan.palette.primary} 55%, ${plan.palette.secondary} 130%)`, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", left: "28%", top: "26%", width: "44%", height: "52%", borderRadius: `${unit}px ${unit}px ${unit * 3}px ${unit * 3}px`, background: "rgba(255,255,255,0.85)", transform: `scale(${interpolate(frame, [0, fps * 0.6], [0.85, 1], { extrapolateRight: "clamp" })})` }} />
          </div>
          <div style={{ padding: `${unit * 2.4}px ${unit * 2}px`, display: "flex", flexDirection: "column", gap: unit * 1.2 }}>
            <div style={{ height: unit * 1.1, width: "40%", borderRadius: unit, background: "rgba(0,0,0,0.08)" }} />
            <div style={{ height: unit * 2, width: "85%", borderRadius: unit, background: "rgba(0,0,0,0.14)" }} />
            <div style={{ display: "flex", gap: unit * 0.4 }}>{[0, 1, 2, 3, 4].map((i) => <span key={i} style={{ width: unit * 1.2, height: unit * 1.2, borderRadius: 2, background: plan.palette.accent }} />)}</div>
            {[0, 1].map((i) => <div key={i} style={{ height: unit, width: `${90 - i * 20}%`, borderRadius: unit, background: "rgba(0,0,0,0.06)" }} />)}
            <div style={{ marginTop: "auto", padding: `${unit * 1.1}px ${unit * 2}px`, borderRadius: unit * 3, background: plan.palette.primary, color: inkOn(plan.palette.primary), fontSize: unit * 1.4, fontWeight: 700, textAlign: "center", transform: `scale(${click ? 0.94 : 1})` }}>
              {label || "Add to cart"}
            </div>
          </div>
        </div>
      )}
      {recording && (
        <>
          <svg viewBox="0 0 24 24" width={unit * 3} height={unit * 3} style={{ position: "absolute", left: `${cursorX}%`, top: `${cursorY}%`, filter: "drop-shadow(0 2px 3px rgba(0,0,0,.3))" }}>
            <path d="M5 3l14 7-6 2-2 6L5 3z" fill="#202124" stroke="#fff" strokeWidth="1.4" />
          </svg>
          <div style={{ position: "absolute", top: unit * 1, right: unit * 1.4, display: "flex", alignItems: "center", gap: unit * 0.5, fontSize: unit * 1.1, fontWeight: 700, color: "#C93C3C" }}>
            <span style={{ width: unit, height: unit, borderRadius: "50%", background: "#FF6B6B", opacity: Math.floor(frame / 15) % 2 ? 0.4 : 1 }} /> DEMO
          </div>
        </>
      )}
    </div>
  );
}

export function FeatureCallout({ el, plan, unit, index }: { el: VisualElement; plan: ScenePlan; unit: number; index: number }) {
  const { fps } = useVideoConfig();
  const s = usePop(msToFrames(300 + index * 160, fps), 13);
  const bg = resolveColor(el.color ?? "accent", plan);
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: unit,
        padding: `${unit * 1.1}px ${unit * 2}px`,
        borderRadius: unit * 4,
        background: bg,
        color: inkOn(bg),
        fontSize: unit * 2,
        fontWeight: 700,
        boxShadow: `0 ${unit}px ${unit * 3}px -${unit}px rgba(0,0,0,.3)`,
        transform: `translateX(${(1 - s) * -40}px) scale(${0.8 + 0.2 * s})`,
        opacity: s,
      }}
    >
      <Icon name={el.icon ?? "check"} color={inkOn(bg)} size={unit * 2.4} />
      {el.text}
    </div>
  );
}

export function StatCounter({ text, color, unit }: { text: string; color: string; unit: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const stat = parseStat(text);
  const p = interpolate(frame, [fps * 0.2, fps * 1.4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: (t) => 1 - Math.pow(1 - t, 3) });
  if (!stat) return <div style={{ fontSize: unit * 6, fontWeight: 800, color }}>{text}</div>;
  return (
    <div style={{ fontSize: unit * 9, fontWeight: 800, color, letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
      {stat.prefix}
      {(stat.value * p).toFixed(stat.decimals)}
      {stat.suffix}
    </div>
  );
}

export function LogoReveal({ logoUrl, name, color, unit }: { logoUrl?: string | null; name: string; color: string; unit: number }) {
  const s = usePop(0, 10);
  return (
    <div style={{ transform: `scale(${interpolate(s, [0, 1], [0.7, 1])})`, opacity: s, display: "flex", alignItems: "center", justifyContent: "center", gap: unit * 1.5 }}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" style={{ maxHeight: unit * 9, maxWidth: unit * 40, objectFit: "contain" }} />
      ) : (
        <span style={{ fontSize: unit * 6, fontWeight: 800, letterSpacing: "-0.04em", color }}>{name}</span>
      )}
    </div>
  );
}

export function CtaButton({ text, plan, unit }: { text: string; plan: ScenePlan; unit: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = usePop(msToFrames(350, fps), 9);
  const pulse = 1 + Math.max(0, Math.sin((frame - fps) / 7)) * 0.03 * (frame > fps ? 1 : 0);
  return (
    <div
      style={{
        display: "inline-block",
        padding: `${unit * 1.6}px ${unit * 3.4}px`,
        borderRadius: unit * 5,
        background: plan.palette.primary,
        color: inkOn(plan.palette.primary),
        fontSize: unit * 2.6,
        fontWeight: 800,
        transform: `scale(${s * pulse})`,
        boxShadow: `0 ${unit}px ${unit * 4}px -${unit}px ${plan.palette.primary}`,
      }}
    >
      {text}
    </div>
  );
}

export function IconPop({ el, plan, unit, index }: { el: VisualElement; plan: ScenePlan; unit: number; index: number }) {
  const { fps } = useVideoConfig();
  const s = usePop(msToFrames(200 + index * 120, fps), 8);
  const c = resolveColor(el.color ?? "primary", plan);
  return (
    <div style={{ width: unit * 10, height: unit * 10, borderRadius: unit * 2.5, background: c, display: "grid", placeItems: "center", transform: `scale(${s}) rotate(${(1 - s) * -20}deg)` }}>
      <Icon name={el.icon} color={inkOn(c)} size={unit * 6} />
    </div>
  );
}
