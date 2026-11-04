"use client";
import { Field, Select } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import { COLOR_ROLES, COLOR_ROLE_LABEL, GRAPHICS_LABEL, HEADING_FONTS } from "@/lib/creative/labels";
import { ASPECT_RATIOS, GRAPHICS_LEVELS, type ScenePlan } from "@/lib/creative/scene-plan";

const FORMAT_HINT: Record<ScenePlan["aspectRatio"], string> = { "9:16": "Reels · TikTok · Shorts", "1:1": "Feed", "4:5": "Feed · Stories", "16:9": "YouTube · web" };
const FORMAT_BOX: Record<ScenePlan["aspectRatio"], string> = { "16:9": "h-5 w-9", "9:16": "h-9 w-5", "1:1": "h-7 w-7", "4:5": "h-8 w-6" };

export type StyleState = Pick<ScenePlan, "aspectRatio" | "palette" | "fonts" | "graphics">;

/** Format, colors and fonts for the whole ad. Changes show in the preview right away. */
export function StylePanel({ value, original, onChange }: { value: StyleState; original: StyleState; onChange: (v: StyleState) => void }) {
  const fonts = [...new Set([value.fonts.heading, original.fonts.heading, ...HEADING_FONTS])];
  const paletteChanged = COLOR_ROLES.some((r) => value.palette[r] !== original.palette[r]);
  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-semibold">Format</p>
        <div role="radiogroup" aria-label="Format" className="grid grid-cols-4 gap-2">
          {ASPECT_RATIOS.map((a) => (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={value.aspectRatio === a}
              onClick={() => onChange({ ...value, aspectRatio: a })}
              className={cn("flex flex-col items-center gap-1.5 rounded-xl border-[1.5px] px-1 py-2.5 text-xs", value.aspectRatio === a ? "border-violet bg-lavender" : "border-line hover:border-ink")}
            >
              <span className={cn("rounded-sm border-2 border-current", FORMAT_BOX[a])} aria-hidden />
              <span className="font-mono font-semibold">{a}</span>
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-slate">{FORMAT_HINT[value.aspectRatio]}. Every scene re-lays out for the new shape.</p>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold">Colors</p>
          {paletteChanged && (
            <button type="button" onClick={() => onChange({ ...value, palette: original.palette })} className="text-xs font-semibold text-violet-deep hover:underline">Reset</button>
          )}
        </div>
        <div className="grid grid-cols-5 gap-2">
          {COLOR_ROLES.map((r) => (
            <label key={r} className="text-center text-[11px] text-slate">
              <span className="relative mx-auto block h-11 w-full overflow-hidden rounded-lg ring-1 ring-black/10" style={{ background: value.palette[r] }}>
                <input type="color" value={value.palette[r]} onChange={(e) => onChange({ ...value, palette: { ...value.palette, [r]: e.target.value.toUpperCase() } })} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" aria-label={`${COLOR_ROLE_LABEL[r]} color`} />
              </span>
              <span className="mt-1 block">{COLOR_ROLE_LABEL[r]}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold">Motion graphics</p>
        <div role="radiogroup" aria-label="Motion graphics" className="grid grid-cols-3 gap-2">
          {GRAPHICS_LEVELS.map((g) => (
            <button key={g} type="button" role="radio" aria-checked={(value.graphics ?? "lively") === g} onClick={() => onChange({ ...value, graphics: g })} className={cn("rounded-xl border-[1.5px] px-2 py-2 text-sm font-medium", (value.graphics ?? "lively") === g ? "border-violet bg-lavender" : "border-line hover:border-ink")}>
              {GRAPHICS_LABEL[g]}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-slate">Floating shapes and sparks around every scene.</p>
      </div>

      <Field label="Headline font" htmlFor="style-font">
        <Select id="style-font" value={value.fonts.heading} onChange={(e) => onChange({ ...value, fonts: { ...value.fonts, heading: e.target.value } })}>
          {fonts.map((f) => <option key={f} value={f}>{f}{f === original.fonts.heading ? " (brand)" : ""}</option>)}
        </Select>
      </Field>
    </div>
  );
}
