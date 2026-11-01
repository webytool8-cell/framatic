import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { TransitionSeries, linearTiming, springTiming, type TransitionPresentation, type TransitionPresentationComponentProps } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { iris } from "@remotion/transitions/iris";
import { clockWipe } from "@remotion/transitions/clock-wipe";
import type { Scene, ScenePlan } from "@/lib/creative/scene-plan";
import { AnimatedText } from "./motion";
import { CtaButton, FeatureCallout, GeometricSweep, IconPop, LogoReveal, ProductWindow, ShapeBurst, StatCounter } from "./elements";
import { buildTimeline, inkOn, resolveColor } from "./timeline";

export interface AdVideoProps extends Record<string, unknown> {
  plan: ScenePlan;
  logoUrl?: string | null;
  productName?: string;
  /** Uploaded product screenshot, when available (Phase 3). */
  screenshotUrl?: string | null;
}

/* ---------- custom presentation: zoom through ---------- */
function ZoomThrough({ children, presentationDirection, presentationProgress }: TransitionPresentationComponentProps<Record<string, never>>) {
  const entering = presentationDirection === "entering";
  const scale = entering ? interpolate(presentationProgress, [0, 1], [0.7, 1]) : interpolate(presentationProgress, [0, 1], [1, 1.6]);
  const opacity = entering ? presentationProgress : 1 - presentationProgress;
  return <AbsoluteFill style={{ transform: `scale(${scale})`, opacity }}>{children}</AbsoluteFill>;
}
const zoomThrough = (): TransitionPresentation<Record<string, never>> => ({ component: ZoomThrough, props: {} });

function presentationFor(type: Scene["transition"]["type"], width: number, height: number): TransitionPresentation<Record<string, unknown>> {
  switch (type) {
    case "wipe_left":
      return wipe({ direction: "from-right" }) as unknown as TransitionPresentation<Record<string, unknown>>;
    case "wipe_up":
      return wipe({ direction: "from-bottom" }) as unknown as TransitionPresentation<Record<string, unknown>>;
    case "whip_pan":
      return slide({ direction: "from-right" }) as unknown as TransitionPresentation<Record<string, unknown>>;
    case "circle_reveal":
      return iris({ width, height }) as unknown as TransitionPresentation<Record<string, unknown>>;
    case "shape_morph":
      return clockWipe({ width, height }) as unknown as TransitionPresentation<Record<string, unknown>>;
    case "zoom_through":
      return zoomThrough() as unknown as TransitionPresentation<Record<string, unknown>>;
    case "crossfade":
    default:
      return fade() as unknown as TransitionPresentation<Record<string, unknown>>;
  }
}

/* ---------- backgrounds ---------- */
function Background({ scene, plan, unit }: { scene: Scene; plan: ScenePlan; unit: number }) {
  const frame = useCurrentFrame();
  const bg = resolveColor(scene.background.color, plan);
  const bg2 = resolveColor(scene.background.secondaryColor ?? "primary", plan);
  const ink = inkOn(bg);
  switch (scene.background.type) {
    case "split": {
      const w = interpolate(frame, [0, 12], [0, 40], { extrapolateRight: "clamp", easing: (t) => 1 - Math.pow(1 - t, 3) });
      return (
        <AbsoluteFill style={{ background: bg }}>
          <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: `${w}%`, background: bg2 }} />
        </AbsoluteFill>
      );
    }
    case "grid":
      return (
        <AbsoluteFill
          style={{
            background: bg,
            backgroundImage: `linear-gradient(${ink}22 1px, transparent 1px), linear-gradient(90deg, ${ink}22 1px, transparent 1px)`,
            backgroundSize: `${unit * 8}px ${unit * 8}px`,
            backgroundPosition: `${frame * 0.4}px ${frame * 0.4}px`,
          }}
        />
      );
    case "shape_field":
      return (
        <AbsoluteFill style={{ background: bg }}>
          <ShapeBurst plan={{ ...plan, palette: { ...plan.palette, primary: bg === plan.palette.primary ? plan.palette.secondary : plan.palette.primary } }} unit={unit} />
        </AbsoluteFill>
      );
    case "brand_gradient_flat":
      return (
        <AbsoluteFill style={{ background: bg }}>
          <div style={{ position: "absolute", inset: 0, background: bg2, clipPath: "polygon(60% 0, 100% 0, 100% 100%, 35% 100%)" }} />
        </AbsoluteFill>
      );
    case "solid":
    default:
      return <AbsoluteFill style={{ background: bg }} />;
  }
}

/* ---------- one scene ---------- */
export function SceneView({ scene, plan, logoUrl, productName, screenshotUrl }: { scene: Scene; plan: ScenePlan; logoUrl?: string | null; productName?: string; screenshotUrl?: string | null }) {
  const { width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  const unit = Math.min(width, height) / 100;
  const portrait = height > width * 1.1;
  const bg = resolveColor(scene.background.color, plan);
  const ink = inkOn(bg);
  const types = new Set(scene.visualElements.map((v) => v.type));
  const hasProduct = types.has("screenshot_reveal") || types.has("product_recording") || scene.productFootage.required;
  const isCta = scene.purpose === "cta" || types.has("cta_end_card");
  const showLogo = types.has("logo_reveal") || isCta;
  const headlineSize = unit * (scene.headline.length > 34 ? 6.4 : scene.headline.length > 20 ? 8 : 9.6) * (hasProduct && !portrait ? 0.82 : 1);
  const stat = scene.visualElements.find((v) => v.type === "stat_counter");
  const callouts = scene.visualElements.filter((v) => v.type === "feature_callout" && v.text);
  const icons = scene.visualElements.filter((v) => v.type === "icon_animation");
  const subOpacity = interpolate(frame, [12, 24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const textAlign = hasProduct && !portrait ? "left" : "center";

  const textBlock = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: textAlign === "left" ? "flex-start" : "center", gap: unit * 2.4, textAlign }}>
      {showLogo && !isCta && <LogoReveal logoUrl={logoUrl} name={productName ?? ""} color={ink} unit={unit} />}
      {icons.length > 0 && (
        <div style={{ display: "flex", gap: unit * 2 }}>{icons.slice(0, 3).map((el, i) => <IconPop key={i} el={el} plan={plan} unit={unit} index={i} />)}</div>
      )}
      {stat?.text && <StatCounter text={stat.text} color={plan.palette.primary === bg ? ink : plan.palette.primary} unit={unit} />}
      {isCta && <LogoReveal logoUrl={logoUrl} name={productName ?? ""} color={ink} unit={unit} />}
      {scene.headline && (
        <AnimatedText
          text={scene.headline}
          anim={scene.animation}
          accent={plan.palette.accent === bg ? plan.palette.primary : plan.palette.accent}
          style={{ fontFamily: `"${plan.fonts.heading}", "Space Grotesk Variable", system-ui, sans-serif`, fontWeight: 700, fontSize: headlineSize, lineHeight: 0.98, letterSpacing: "-0.035em", color: ink, maxWidth: hasProduct && !portrait ? "100%" : "88%" }}
        />
      )}
      {scene.supportingText && (
        <div style={{ fontFamily: `"${plan.fonts.body}", "Space Grotesk Variable", system-ui, sans-serif`, fontSize: unit * 3, lineHeight: 1.3, color: ink, opacity: subOpacity * 0.82, maxWidth: "80%" }}>{scene.supportingText}</div>
      )}
      {callouts.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: unit * 1.2, justifyContent: textAlign === "left" ? "flex-start" : "center" }}>
          {callouts.slice(0, 3).map((el, i) => <FeatureCallout key={i} el={el} plan={plan} unit={unit} index={i} />)}
        </div>
      )}
      {isCta && <CtaButton text={scene.cta?.text || scene.headline} plan={plan} unit={unit} />}
    </div>
  );

  return (
    <AbsoluteFill>
      <Background scene={scene} plan={plan} unit={unit} />
      {(types.has("shape_burst") && scene.background.type !== "shape_field") && <ShapeBurst plan={plan} unit={unit} />}
      {types.has("geometric_sweep") && <GeometricSweep plan={plan} unit={unit} />}
      {hasProduct ? (
        portrait ? (
          <AbsoluteFill style={{ padding: unit * 7, display: "flex", flexDirection: "column", gap: unit * 6 }}>
            <div style={{ flex: "0 0 auto", paddingTop: unit * 6 }}>{textBlock}</div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <ProductWindow plan={plan} unit={unit} recording={types.has("product_recording")} image={screenshotUrl} label={scene.cta?.text} />
            </div>
          </AbsoluteFill>
        ) : (
          <AbsoluteFill style={{ padding: unit * 8, display: "grid", gridTemplateColumns: "44% 1fr", gap: unit * 6, alignItems: "center" }}>
            {textBlock}
            <div style={{ height: "78%" }}>
              <ProductWindow plan={plan} unit={unit} recording={types.has("product_recording")} image={screenshotUrl} label={scene.cta?.text} />
            </div>
          </AbsoluteFill>
        )
      ) : (
        <AbsoluteFill style={{ padding: unit * 8, display: "flex", alignItems: "center", justifyContent: "center", right: scene.background.type === "split" ? "40%" : 0 }}>{textBlock}</AbsoluteFill>
      )}
    </AbsoluteFill>
  );
}

/* ---------- the whole ad ---------- */
export function AdVideo({ plan, logoUrl, productName, screenshotUrl }: AdVideoProps) {
  const { width, height, fps } = useVideoConfig();
  const timeline = buildTimeline(plan, fps);
  return (
    <AbsoluteFill style={{ background: plan.palette.paper }}>
      <TransitionSeries>
        {plan.scenes.flatMap((scene, i) => {
          const t = timeline.scenes[i];
          const items = [
            <TransitionSeries.Sequence key={`s-${scene.id}`} durationInFrames={t.durationInFrames}>
              <SceneView scene={scene} plan={plan} logoUrl={logoUrl} productName={productName} screenshotUrl={screenshotUrl} />
            </TransitionSeries.Sequence>,
          ];
          if (t.transitionFrames > 0 && i < plan.scenes.length - 1) {
            items.push(
              <TransitionSeries.Transition
                key={`t-${scene.id}`}
                presentation={presentationFor(scene.transition.type, width, height)}
                timing={scene.transition.type === "whip_pan" ? springTiming({ config: { damping: 200 }, durationInFrames: t.transitionFrames }) : linearTiming({ durationInFrames: t.transitionFrames })}
              />,
            );
          }
          return items;
        })}
      </TransitionSeries>
    </AbsoluteFill>
  );
}
