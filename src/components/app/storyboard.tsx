import type { Scene, ScenePlan } from "@/lib/creative/scene-plan";
import { cn } from "@/lib/cn";

/**
 * Static storyboard frame for one scene — an illustrative layout, NOT a
 * rendered video. Phase 2's renderer will animate the same scene plan.
 */
function resolve(color: string | undefined, plan: ScenePlan): string {
  if (!color) return plan.palette.paper;
  if (color.startsWith("#")) return color;
  return plan.palette[color as keyof ScenePlan["palette"]] ?? plan.palette.paper;
}

function contrastInk(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#202124" : "#FFFFFF";
}

const RATIO: Record<ScenePlan["aspectRatio"], string> = { "16:9": "aspect-video", "9:16": "aspect-[9/16]", "1:1": "aspect-square", "4:5": "aspect-[4/5]" };

export function StoryboardFrame({ scene, plan, index, logoUrl, className }: { scene: Scene; plan: ScenePlan; index: number; logoUrl?: string | null; className?: string }) {
  const bg = resolve(scene.background.color, plan);
  const bg2 = resolve(scene.background.secondaryColor ?? "primary", plan);
  const ink = contrastInk(bg);
  const types = new Set(scene.visualElements.map((v) => v.type));
  const vertical = plan.aspectRatio === "9:16" || plan.aspectRatio === "4:5";
  const photos = scene.visualElements.filter((v) => v.type === "photo" && v.src);
  const backdrop = photos.find((p) => p.photoStyle === "full");
  const framed = photos.find((p) => p.photoStyle !== "full");
  const hasProductWindow = types.has("screenshot_reveal") || types.has("product_recording") || scene.productFootage.required;
  const showsProduct = hasProductWindow || !!framed;

  return (
    <div className={cn("relative overflow-hidden rounded-xl border border-black/10", RATIO[plan.aspectRatio], className)} style={{ background: bg, color: ink }} aria-label={`Storyboard frame ${index + 1}: ${scene.headline}`} role="img">
      {scene.background.type === "split" && <div className={vertical ? "absolute inset-x-0 bottom-0 h-2/5" : "absolute inset-y-0 right-0 w-2/5"} style={{ background: bg2 }} />}
      {scene.background.type === "grid" && <div className="absolute inset-0 opacity-15" style={{ backgroundImage: `linear-gradient(${ink} 1px, transparent 1px), linear-gradient(90deg, ${ink} 1px, transparent 1px)`, backgroundSize: "14% 14%" }} />}
      {(scene.background.type === "shape_field" || types.has("geometric_sweep") || types.has("shape_burst")) && (
        <>
          <div className="absolute -right-[8%] -top-[12%] h-[45%] aspect-square rounded-full" style={{ background: plan.palette.primary, opacity: bg === plan.palette.primary ? 0.3 : 0.9 }} />
          <div className="absolute -bottom-[10%] left-[8%] h-[30%] aspect-square rounded-full border-[6px]" style={{ borderColor: plan.palette.accent }} />
          <div className="absolute bottom-[14%] right-[12%] h-[6%] w-[22%] rounded-full" style={{ background: plan.palette.secondary }} />
        </>
      )}
      {backdrop?.src && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={backdrop.src} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0" style={{ background: `${bg}c0` }} />
        </>
      )}
      {framed?.src && !hasProductWindow && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={framed.src}
          alt=""
          className={cn(
            "absolute object-cover shadow-md",
            framed.photoStyle === "circle" ? "aspect-square rounded-full" : framed.photoStyle === "tilted" ? "-rotate-3 rounded border-4 border-b-[10px] border-white" : "rounded-lg",
            vertical ? "inset-x-[12%] top-[40%] bottom-[14%] h-[46%] w-[76%]" : "right-[6%] top-[16%] h-[68%] w-[44%]",
          )}
        />
      )}
      {hasProductWindow && (
        <div className={cn("absolute rounded-lg border border-black/10 bg-white shadow-sm", vertical ? "inset-x-[10%] top-[38%] bottom-[16%]" : "right-[6%] top-[16%] bottom-[16%] w-[46%]")}>
          <div className="flex gap-1 border-b border-black/5 p-1.5">{[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 rounded-full bg-black/15" />)}</div>
          <div className="space-y-1.5 p-2">
            <div className="h-1.5 w-2/3 rounded bg-black/10" /><div className="h-1.5 w-1/2 rounded bg-black/10" />
            <div className="mt-2 h-6 rounded" style={{ background: plan.palette.primary, opacity: 0.25 }} />
          </div>
          <span className="absolute bottom-1 right-1.5 font-mono text-[8px] uppercase tracking-wider text-black/40">{types.has("product_recording") ? "product recording" : "screenshot"}</span>
        </div>
      )}
      <div className={cn("absolute flex flex-col justify-center p-[7%]", showsProduct && !vertical ? "inset-y-0 left-0 w-[50%]" : showsProduct ? "inset-x-0 top-0 h-[38%]" : scene.background.type === "split" ? (vertical ? "inset-x-0 top-0 h-[60%] items-center text-center" : "inset-y-0 left-0 w-[60%]") : "inset-0 items-center text-center")}>
        {(types.has("logo_reveal") || scene.purpose === "cta") && logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" referrerPolicy="no-referrer" className="mb-[4%] max-h-[14%] max-w-[40%] object-contain" />
        )}
        <p className="font-bold leading-[0.95] tracking-tight" style={{ fontFamily: `"${plan.fonts.heading}", var(--font-sans)`, fontSize: vertical ? "clamp(9px, 11cqw, 40px)" : "clamp(9px, 8cqw, 44px)" }}>
          {scene.headline}
        </p>
        {scene.supportingText && <p className="mt-[3%] text-[clamp(7px,3.6cqw,16px)] opacity-80">{scene.supportingText}</p>}
        {scene.cta && (
          <span className="mt-[5%] inline-block w-fit rounded-full px-[5%] py-[2%] text-[clamp(7px,3.4cqw,15px)] font-bold" style={{ background: plan.palette.primary, color: contrastInk(plan.palette.primary) }}>
            {scene.cta.text}
          </span>
        )}
      </div>
      <span className="absolute left-1.5 top-1.5 rounded bg-white/85 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-ink">{String(index + 1).padStart(2, "0")}</span>
    </div>
  );
}

const PURPOSE_COLOR: Record<string, string> = {
  hook: "#7957FF", problem: "#FF6B6B", agitate: "#FF6B6B", reveal: "#39C6E8", feature: "#39C6E8", demo: "#39C6E8",
  benefit: "#C5F467", proof: "#C5F467", manifesto: "#FFD166", cta: "#202124",
};

/** Timeline strip: scene blocks proportional to duration. */
export function SceneStrip({ plan, className }: { plan: ScenePlan; className?: string }) {
  return (
    <div className={cn("flex h-3 w-full gap-0.5 overflow-hidden rounded-full", className)} aria-label={`${plan.scenes.length} scenes, ${plan.durationSec.toFixed(0)} seconds`}>
      {plan.scenes.map((s) => (
        <span key={s.id} title={`${s.purpose}: ${s.headline} (${s.durationSec}s)`} style={{ flex: s.durationSec, background: PURPOSE_COLOR[s.purpose] ?? "#E8E8EE" }} />
      ))}
    </div>
  );
}

export { PURPOSE_COLOR };
