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
  ELEMENT_LABEL,
  TEXT_ELEMENTS,
  TRANSITION_LABEL,
} from "@/lib/creative/labels";
import { ANIMATION_TYPES, BACKGROUND_TYPES, ICONS, TRANSITION_TYPES, type Scene, type ScenePlan } from "@/lib/creative/scene-plan";

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
}: {
  scenes: Scene[];
  index: number;
  plan: ScenePlan;
  onChange: (scenes: Scene[], select?: number) => void;
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
            {ADDABLE_ELEMENTS.filter((a) => !s.visualElements.some((v) => v.type === a.type) || a.type === "feature_callout").map((a) => (
              <button
                key={a.type}
                type="button"
                onClick={() =>
                  set({
                    visualElements: [...s.visualElements, { type: a.type, text: a.text, icon: a.icon, position: "center" }],
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
