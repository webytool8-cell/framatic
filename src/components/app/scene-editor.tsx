"use client";
import { StoryboardFrame } from "@/components/app/storyboard";
import { Field, Input, Select } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import {
  ADDABLE_ELEMENTS,
  ANIMATION_LABEL,
  BACKGROUND_LABEL,
  BUTTON_ELEMENTS,
  COLOR_ROLES,
  COLOR_ROLE_LABEL,
  CAMERA_LABEL,
  ELEMENT_LABEL,
  PHOTO_MOTION_LABEL,
  PHOTO_STYLE_LABEL,
  TEXT_ELEMENTS,
  TRANSITION_LABEL,
} from "@/lib/creative/labels";
import { ANIMATION_TYPES, BACKGROUND_TYPES, CAMERA_MOVES, ICONS, PHOTO_MOTIONS, PHOTO_STYLES, TRANSITION_TYPES, type Camera, type Scene, type ScenePlan } from "@/lib/creative/scene-plan";

export type LibraryPhoto = { id: string; url: string; kind: "photo" | "ai_photo"; alt: string | null };

const RATIO_CLASS: Record<ScenePlan["aspectRatio"], string> = { "16:9": "aspect-video", "9:16": "aspect-[9/16]", "1:1": "aspect-square", "4:5": "aspect-[4/5]" };

/** Click on a mini frame to choose where the camera zooms. */
function FocusPicker({ scene, plan, value, onChange, label, index }: { scene: Scene; plan: ScenePlan; value: { x: number; y: number }; onChange: (v: { x: number; y: number }) => void; label: string; index: number }) {
  const types = new Set(scene.visualElements.map((v) => v.type));
  const productWindow = types.has("screenshot_reveal") || types.has("product_recording") || scene.productFootage.required;
  const photo = scene.visualElements.find((v) => v.type === "photo" && v.src && v.photoStyle !== "full");
  const inFrame = productWindow || !!photo;
  return (
    <div>
      <p className="mb-1 text-xs text-slate">{label}{inFrame ? (productWindow ? " (inside the product window)" : " (inside the photo)") : ""}</p>
      <button
        type="button"
        aria-label={`${label}: click a spot in the frame`}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          onChange({ x: +Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)).toFixed(3), y: +Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)).toFixed(3) });
        }}
        onKeyDown={(e) => {
          const step = 0.05;
          const k: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
          const d = k[e.key];
          if (!d) return;
          e.preventDefault();
          onChange({ x: +Math.min(1, Math.max(0, value.x + d[0])).toFixed(3), y: +Math.min(1, Math.max(0, value.y + d[1])).toFixed(3) });
        }}
        className={cn("relative block w-full cursor-crosshair overflow-hidden rounded-lg ring-1 ring-black/10", inFrame ? "aspect-[4/3] max-w-[200px]" : cn("max-w-[220px]", RATIO_CLASS[plan.aspectRatio]))}
      >
        {productWindow ? (
          // Same layout as the video's product window: image left, details and buy button right.
          <div className="pointer-events-none absolute inset-0 flex bg-white">
            <div className="w-1/2" style={{ background: `linear-gradient(160deg, ${plan.palette.accent}, ${plan.palette.primary})` }} />
            <div className="flex flex-1 flex-col gap-1.5 p-2">
              <div className="h-1.5 w-3/4 rounded bg-black/15" />
              <div className="h-1.5 w-1/2 rounded bg-black/10" />
              <div className="mt-auto h-4 rounded-full" style={{ background: plan.palette.primary }} />
            </div>
          </div>
        ) : photo?.src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.src} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="pointer-events-none absolute inset-0 [container-type:inline-size]">
            <StoryboardFrame scene={scene} plan={plan} index={index} />
          </div>
        )}
        <span className="pointer-events-none absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-violet/40 shadow-[0_0_0_2px_#7957FF]" style={{ left: `${value.x * 100}%`, top: `${value.y * 100}%` }} />
      </button>
    </div>
  );
}

const MIN_SCENES = 3;
const MAX_SCENES = 14;
const MAX_ELEMENTS = 5;

function newSceneId() {
  return `scene_${Math.random().toString(36).slice(2, 8)}`;
}

/** A plain text scene to start from when adding one by hand. */
export function blankScene(): Scene {
  return {
    id: newSceneId(),
    purpose: "feature",
    durationSec: 2.5,
    headline: "New scene",
    supportingText: "",
    visualElements: [{ type: "kinetic_text", position: "center" }],
    animation: { type: "fade_up", delayMs: 0, durationMs: 600, easing: "ease_out", staggerMs: 0 },
    transition: { type: "crossfade", durationMs: 300 },
    background: { type: "solid", color: "paper" },
    brandAssets: [],
    productFootage: { required: false, description: "" },
    audioCues: [],
    cta: null,
  };
}

/** Horizontal list of scenes: pick one to edit, add, duplicate, move or delete. */
export function SceneList({
  scenes,
  plan,
  selected,
  logoUrl,
  onSelect,
  onChange,
}: {
  scenes: Scene[];
  plan: ScenePlan;
  selected: number;
  logoUrl: string | null;
  onSelect: (i: number) => void;
  onChange: (scenes: Scene[], select?: number) => void;
}) {
  const portrait = plan.aspectRatio === "9:16" || plan.aspectRatio === "4:5";
  return (
    <div>
      <ol className="flex snap-x gap-3 overflow-x-auto pb-2" aria-label="Scenes">
        {scenes.map((s, i) => (
          <li key={s.id} className={cn("shrink-0 snap-start", portrait ? "w-28" : "w-44")}>
            <button
              type="button"
              onClick={() => onSelect(i)}
              aria-pressed={selected === i}
              aria-label={`Edit scene ${i + 1}: ${s.headline}`}
              className={cn("block w-full rounded-xl border-2 p-1 text-left transition-colors", selected === i ? "border-violet bg-lavender" : "border-transparent hover:border-line-strong")}
            >
              <div className="pointer-events-none [container-type:inline-size]">
                <StoryboardFrame scene={s} plan={plan} index={i} logoUrl={logoUrl} />
              </div>
              <span className="mt-1 flex items-center justify-between gap-1 px-0.5 text-[11px]">
                <span className="truncate font-semibold">{i + 1}. {s.headline || "Untitled"}</span>
                <span className="shrink-0 font-mono text-slate">{s.durationSec.toFixed(1)}s</span>
              </span>
            </button>
          </li>
        ))}
        <li className={cn("shrink-0", portrait ? "w-28" : "w-44")}>
          <button
            type="button"
            disabled={scenes.length >= MAX_SCENES}
            onClick={() => {
              const at = Math.min(selected + 1, scenes.length);
              const next = [...scenes];
              next.splice(at, 0, blankScene());
              onChange(next, at);
            }}
            className={cn("grid w-full place-items-center rounded-xl border-2 border-dashed border-line-strong text-sm font-semibold text-slate hover:border-violet hover:text-violet-deep disabled:opacity-40", portrait ? "aspect-[9/16]" : "aspect-video")}
          >
            + Add scene
          </button>
        </li>
      </ol>
    </div>
  );
}

function ColorPicker({ value, plan, onChange, label }: { value: string | undefined; plan: ScenePlan; onChange: (v: string) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {COLOR_ROLES.map((role) => (
        <button
          key={role}
          type="button"
          role="radio"
          aria-checked={value === role}
          title={COLOR_ROLE_LABEL[role]}
          onClick={() => onChange(role)}
          className={cn("h-8 w-8 rounded-lg ring-1 ring-black/10 transition-transform", value === role && "scale-110 ring-2 ring-violet ring-offset-2")}
          style={{ background: plan.palette[role] }}
        >
          <span className="sr-only">{COLOR_ROLE_LABEL[role]}</span>
        </button>
      ))}
    </div>
  );
}

/** Everything about one scene, editable by hand. */
export function SceneInspector({
  scenes,
  index,
  plan,
  onChange,
  photos = [],
}: {
  scenes: Scene[];
  index: number;
  plan: ScenePlan;
  onChange: (scenes: Scene[], select?: number) => void;
  photos?: LibraryPhoto[];
}) {
  const s = scenes[index];
  if (!s) return null;
  const set = (patch: Partial<Scene>) => onChange(scenes.map((x, i) => (i === index ? { ...x, ...patch } : x)));
  const setEl = (j: number, patch: Partial<Scene["visualElements"][number]>) => set({ visualElements: s.visualElements.map((v, k) => (k === j ? { ...v, ...patch } : v)) });
  const showsButton = s.visualElements.some((v) => BUTTON_ELEMENTS.has(v.type)) || index === scenes.length - 1;
  const move = (dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= scenes.length) return;
    const next = [...scenes];
    [next[index], next[j]] = [next[j], next[index]];
    onChange(next, j);
  };
  const id = (k: string) => `sc-${s.id}-${k}`;
  const camera: Camera = { move: s.camera?.move ?? "drift", focus: s.camera?.focus ?? { x: 0.5, y: 0.5 }, scale: s.camera?.scale ?? 1.35, ...(s.camera?.to ? { to: s.camera.to } : {}) };
  const setCamera = (patch: Partial<Camera>) => set({ camera: { ...camera, ...patch } });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">Scene {index + 1} of {scenes.length}</p>
        <div className="flex gap-1 text-xs font-semibold">
          <button type="button" onClick={() => move(-1)} disabled={index === 0} className="rounded-md border border-line px-2 py-1 hover:border-ink disabled:opacity-30" aria-label="Move scene earlier">←</button>
          <button type="button" onClick={() => move(1)} disabled={index === scenes.length - 1} className="rounded-md border border-line px-2 py-1 hover:border-ink disabled:opacity-30" aria-label="Move scene later">→</button>
          <button
            type="button"
            disabled={scenes.length >= MAX_SCENES}
            onClick={() => {
              const next = [...scenes];
              next.splice(index + 1, 0, { ...structuredClone(s), id: newSceneId() });
              onChange(next, index + 1);
            }}
            className="rounded-md border border-line px-2 py-1 hover:border-ink disabled:opacity-30"
          >
            Duplicate
          </button>
          <button
            type="button"
            disabled={scenes.length <= MIN_SCENES}
            title={scenes.length <= MIN_SCENES ? `An ad needs at least ${MIN_SCENES} scenes` : undefined}
            onClick={() => onChange(scenes.filter((_, i) => i !== index), Math.max(0, index - 1))}
            className="rounded-md border border-line px-2 py-1 text-coral-deep hover:border-coral disabled:opacity-30"
          >
            Delete
          </button>
        </div>
      </div>

      <Field label="Headline" htmlFor={id("h")}>
        <Input id={id("h")} value={s.headline} maxLength={90} onChange={(e) => set({ headline: e.target.value })} />
      </Field>
      <Field label="Supporting text" htmlFor={id("t")}>
        <Input id={id("t")} value={s.supportingText} maxLength={160} placeholder="Optional line under the headline" onChange={(e) => set({ supportingText: e.target.value })} />
      </Field>
      {showsButton && (
        <Field label="Button text" htmlFor={id("cta")}>
          <Input id={id("cta")} value={s.cta?.text ?? ""} maxLength={40} placeholder="e.g. Shop now" onChange={(e) => set({ cta: e.target.value ? { ...(s.cta ?? {}), text: e.target.value } : null })} />
        </Field>
      )}

      <Field label={`Length: ${s.durationSec.toFixed(1)}s`} htmlFor={id("d")}>
        <input id={id("d")} type="range" min={0.6} max={8} step={0.1} value={Math.min(8, s.durationSec)} onChange={(e) => set({ durationSec: +e.target.value })} className="w-full accent-violet" />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Text animation" htmlFor={id("a")}>
          <Select id={id("a")} value={s.animation.type} onChange={(e) => set({ animation: { ...s.animation, type: e.target.value as Scene["animation"]["type"] } })}>
            {ANIMATION_TYPES.map((a) => <option key={a} value={a}>{ANIMATION_LABEL[a]}</option>)}
          </Select>
        </Field>
        <Field label={index === scenes.length - 1 ? "Transition (last scene)" : "Transition to next"} htmlFor={id("tr")}>
          <Select id={id("tr")} value={s.transition.type} onChange={(e) => set({ transition: { ...s.transition, type: e.target.value as Scene["transition"]["type"] } })}>
            {TRANSITION_TYPES.map((t) => <option key={t} value={t}>{TRANSITION_LABEL[t]}</option>)}
          </Select>
        </Field>
      </div>

      <div>
        <p className="mb-1.5 text-sm font-semibold">Camera</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Select aria-label="Camera move" value={camera.move} onChange={(e) => setCamera({ move: e.target.value as Camera["move"] })}>
            {CAMERA_MOVES.map((m) => <option key={m} value={m}>{CAMERA_LABEL[m]}</option>)}
          </Select>
          {camera.move !== "none" && camera.move !== "drift" && (
            <label className="block text-xs text-slate">
              Zoom {camera.scale.toFixed(2)}×
              <input type="range" min={1.1} max={2.5} step={0.05} value={camera.scale} onChange={(e) => setCamera({ scale: +e.target.value })} className="mt-1 w-full accent-violet" aria-label="Zoom amount" />
            </label>
          )}
        </div>
        {camera.move !== "none" && (
          <div className="mt-3 flex flex-wrap gap-4">
            <FocusPicker scene={s} plan={plan} index={index} label={camera.move === "pan" ? "Start here" : "Zoom into"} value={camera.focus} onChange={(focus) => setCamera({ focus })} />
            {camera.move === "pan" && (
              <FocusPicker scene={s} plan={plan} index={index} label="End here" value={camera.to ?? { x: 1 - camera.focus.x, y: camera.focus.y }} onChange={(to) => setCamera({ to })} />
            )}
          </div>
        )}
        <p className="mt-1.5 text-xs text-slate">The camera moves the visuals; text stays put and readable.</p>
      </div>

      <div>
        <p className="mb-1.5 text-sm font-semibold">Background</p>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {BACKGROUND_TYPES.map((b) => (
            <button key={b} type="button" aria-pressed={s.background.type === b} onClick={() => set({ background: { ...s.background, type: b } })} className={cn("rounded-full border-[1.5px] px-3 py-1 text-xs font-medium", s.background.type === b ? "border-violet bg-lavender text-violet-deep" : "border-line hover:border-ink")}>
              {BACKGROUND_LABEL[b]}
            </button>
          ))}
        </div>
        <ColorPicker label="Background color" value={s.background.color} plan={plan} onChange={(c) => set({ background: { ...s.background, color: c } })} />
        {(s.background.type === "split" || s.background.type === "brand_gradient_flat") && (
          <div className="mt-2">
            <p className="mb-1 text-xs text-slate">Second color</p>
            <ColorPicker label="Second background color" value={s.background.secondaryColor ?? "primary"} plan={plan} onChange={(c) => set({ background: { ...s.background, secondaryColor: c } })} />
          </div>
        )}
      </div>

      <div>
        <p className="mb-1.5 text-sm font-semibold">On screen</p>
        <ul className="space-y-2">
          {s.visualElements.map((v, j) => (
            <li key={j} className="rounded-lg border border-line p-2">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="font-medium">{ELEMENT_LABEL[v.type]}</span>
                <button type="button" disabled={s.visualElements.length <= 1} onClick={() => set({ visualElements: s.visualElements.filter((_, k) => k !== j) })} className="text-xs font-semibold text-slate hover:text-coral-deep disabled:opacity-30" aria-label={`Remove ${ELEMENT_LABEL[v.type]}`}>Remove</button>
              </div>
              {v.type === "photo" && (
                <div className="mt-2 space-y-2">
                  {photos.length ? (
                    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Choose a photo">
                      {photos.map((p) => (
                        <button key={p.id} type="button" role="radio" aria-checked={v.src === p.url} onClick={() => setEl(j, { src: p.url })} className={cn("relative h-14 w-14 overflow-hidden rounded-md ring-1 ring-black/10", v.src === p.url && "ring-2 ring-violet ring-offset-1")} title={p.alt ?? undefined}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.url} alt={p.alt ?? "Project photo"} className="h-full w-full object-cover" />
                          {p.kind === "ai_photo" && <span className="absolute bottom-0.5 left-0.5 rounded bg-black/60 px-1 text-[9px] font-semibold text-white">AI</span>}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate">No photos for this project yet. They come from your product page when the ad is written.</p>
                  )}
                  <div className="grid grid-cols-2 gap-1.5">
                    <Select aria-label="Photo layout" value={v.photoStyle ?? "card"} onChange={(e) => setEl(j, { photoStyle: e.target.value as (typeof PHOTO_STYLES)[number] })}>
                      {PHOTO_STYLES.map((p) => <option key={p} value={p}>{PHOTO_STYLE_LABEL[p]}</option>)}
                    </Select>
                    <Select aria-label="Photo movement" value={v.motion ?? "ken_burns"} onChange={(e) => setEl(j, { motion: e.target.value as (typeof PHOTO_MOTIONS)[number] })}>
                      {PHOTO_MOTIONS.map((m) => <option key={m} value={m}>{PHOTO_MOTION_LABEL[m]}</option>)}
                    </Select>
                  </div>
                </div>
              )}
              {v.type === "marquee" && (
                <div className="mt-1.5">
                  <Input aria-label="Scrolling text" value={v.text ?? ""} maxLength={40} placeholder={s.headline} onChange={(e) => setEl(j, { text: e.target.value })} />
                </div>
              )}
              {TEXT_ELEMENTS.has(v.type) && (
                <div className={cn("mt-1.5 grid gap-1.5", v.type === "feature_callout" ? "grid-cols-[minmax(0,1fr)_7.5rem]" : "grid-cols-1")}>
                  <Input aria-label={`${ELEMENT_LABEL[v.type]} text`} value={v.text ?? ""} maxLength={v.type === "stat_counter" ? 12 : 40} onChange={(e) => setEl(j, { text: e.target.value })} />
                  {v.type === "feature_callout" && (
                    <Select aria-label="Badge icon" value={v.icon ?? "sparkle"} onChange={(e) => setEl(j, { icon: e.target.value as (typeof ICONS)[number] })} className="pr-6">
                      {ICONS.map((ic) => <option key={ic} value={ic}>{ic.replace("_", " ")}</option>)}
                    </Select>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
        {s.visualElements.length < MAX_ELEMENTS && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {ADDABLE_ELEMENTS.filter((a) => (!s.visualElements.some((v) => v.type === a.type) || a.type === "feature_callout") && (a.type !== "photo" || photos.length > 0)).map((a) => (
              <button
                key={a.type}
                type="button"
                onClick={() =>
                  set({
                    visualElements: [
                      ...s.visualElements,
                      a.type === "photo"
                        ? { type: "photo", position: "center", src: photos.find((p) => !scenes.some((x) => x.visualElements.some((v) => v.src === p.url)))?.url ?? photos[0]?.url, photoStyle: "card", motion: "ken_burns" }
                        : { type: a.type, text: a.text, icon: a.icon, position: "center" },
                    ],
                    ...(a.type === "cta_end_card" && !s.cta ? { cta: { text: a.text ?? "Learn more" } } : {}),
                  })
                }
                className="rounded-full border border-dashed border-line-strong px-2.5 py-1 text-xs hover:border-violet hover:text-violet-deep"
              >
                + {ELEMENT_LABEL[a.type]}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
