"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { restoreSceneVersion, setPreferredConcept, updateConceptContent, updateConceptPreferences, updateScenes } from "@/app/actions/concepts";
import { Button } from "@/components/ui/button";
import { accentBorder } from "@/components/ui/card";
import { Alert, Field, Input, Select, Textarea } from "@/components/ui/form";
import { Tag } from "@/components/ui/status";
import { PURPOSE_COLOR, SceneStrip, StoryboardFrame } from "@/components/app/storyboard";
import { ScenePreview } from "@/components/app/scene-preview";
import { CAMPAIGN_OBJECTIVES } from "@/lib/brand/schema";
import {
  CONCEPT_META,
  FIELD_LABELS,
  PACING,
  REGENERATABLE_FIELDS,
  type ConceptContent,
  type ConceptKind,
  type CreativePreferences,
  type EditableField,
  type RegeneratableField,
} from "@/lib/creative/concept";
import { ASPECT_RATIOS, type ScenePlan } from "@/lib/creative/scene-plan";
import { cn } from "@/lib/cn";

type Props = {
  concept: {
    id: string;
    kind: ConceptKind;
    content: ConceptContent;
    preferences: CreativePreferences;
    editedFields: string[];
    isPreferred: boolean;
    version: number;
    plan: ScenePlan;
  };
  versions: Array<{ version: number; source: string; created_at: string }>;
  logoUrl: string | null;
  productName?: string;
  aiReady: boolean;
};

const QUICK_ASKS = ["Make it punchier", "Shorter: 15 seconds", "Vertical 9:16 for Reels", "More playful", "Focus on one feature", "Stronger call to action"];
const LONG: EditableField[] = ["description", "rationale", "supportingCopy", "visualDirection", "typographyDirection", "targetAudience"];
const ADVANCED_FIELDS: EditableField[] = ["title", "campaignObjective", "description", "targetAudience", "rationale", "visualDirection", "typographyDirection", "musicMood", "pacing"];
const fmt = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function ConceptWorkspace({ concept, versions, logoUrl, productName, aiReady }: Props) {
  const router = useRouter();
  const meta = CONCEPT_META[concept.kind];
  const [content, setContent] = useState(concept.content);
  const [dirtyFields, setDirtyFields] = useState<Set<string>>(new Set());
  const [scenes, setScenes] = useState(concept.plan.scenes);
  const [scenesDirty, setScenesDirty] = useState(false);
  const [prefs, setPrefs] = useState(concept.preferences);
  const [prefsDirty, setPrefsDirty] = useState(false);
  const [ask, setAsk] = useState("");
  const [selected, setSelected] = useState<Set<RegeneratableField>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [view, setView] = useState<"preview" | "frames">("preview");
  const [notice, setNotice] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [, start] = useTransition();
  const anyDirty = dirtyFields.size > 0 || scenesDirty || prefsDirty;
  const planPreview: ScenePlan = { ...concept.plan, scenes, durationSec: scenes.reduce((n, s) => n + s.durationSec, 0) };
  const aiBusy = busy === "ask" || busy === "fresh" || busy === "selected" || !!busy?.startsWith("field:");

  function setField<K extends EditableField>(k: K, v: ConceptContent[K]) {
    setContent((c) => ({ ...c, [k]: v }));
    setDirtyFields((d) => new Set(d).add(k));
    setNotice(null);
  }

  function run(label: string, fn: () => Promise<{ error?: string; message?: string } | undefined>, after?: () => void) {
    setBusy(label);
    setNotice(null);
    start(async () => {
      const r = await fn();
      setBusy(null);
      if (r?.error) setNotice({ tone: "error", text: r.error });
      else {
        setNotice({ tone: "success", text: r?.message ?? "Saved" });
        after?.();
        router.refresh();
      }
    });
  }

  async function regenerate(body: { fields?: RegeneratableField[]; instruction?: string }) {
    const res = await fetch(`/api/concepts/${concept.id}/regenerate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { error: json.error ?? "That didn't work. Please try again." };
    const changed = (json.changed ?? []) as string[];
    if (body.instruction) return { message: "Done. Here's the new version." };
    return { message: changed.length ? `Updated: ${changed.map((c) => FIELD_LABELS[c as RegeneratableField] ?? c).join(", ")}` : "Nothing changed. Everything is locked by your edits." };
  }

  /** Save every pending manual edit in one go. */
  async function saveAll() {
    if (dirtyFields.size) {
      const r = await updateConceptContent(concept.id, Object.fromEntries([...dirtyFields].map((f) => [f, content[f as EditableField]])));
      if (r?.error) return r;
    }
    if (scenesDirty) {
      const r = await updateScenes(concept.id, scenes.map((s) => ({ id: s.id, headline: s.headline, supportingText: s.supportingText, durationSec: s.durationSec })));
      if (r?.error) return r;
    }
    if (prefsDirty) {
      const r = await updateConceptPreferences(concept.id, prefs);
      if (r?.error) return r;
    }
    return { message: "Saved" };
  }

  function moveScene(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= scenes.length) return;
    const next = [...scenes];
    [next[i], next[j]] = [next[j], next[i]];
    setScenes(next);
    setScenesDirty(true);
  }

  const fieldEditor = (f: EditableField, opts: { regen?: boolean } = {}) => {
    const edited = concept.editedFields.includes(f);
    const label = FIELD_LABELS[f];
    const id = `f-${f}`;
    let input: React.ReactNode;
    if (f === "campaignObjective") {
      input = (
        <Select id={id} value={content.campaignObjective} onChange={(e) => setField("campaignObjective", e.target.value as ConceptContent["campaignObjective"])}>
          {CAMPAIGN_OBJECTIVES.map((o) => <option key={o} value={o}>{o.replace("_", " ")}</option>)}
        </Select>
      );
    } else if (f === "pacing") {
      input = (
        <Select id={id} value={content.pacing} onChange={(e) => setField("pacing", e.target.value as ConceptContent["pacing"])}>
          {PACING.map((p) => <option key={p} value={p}>{p}</option>)}
        </Select>
      );
    } else if (LONG.includes(f)) {
      input = <Textarea id={id} value={content[f] as string} onChange={(e) => setField(f, e.target.value)} />;
    } else {
      input = <Input id={id} value={content[f] as string} onChange={(e) => setField(f, e.target.value)} />;
    }
    return (
      <div key={f}>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <label htmlFor={id} className="text-sm font-semibold">{label}</label>
          <span className="flex items-center gap-1.5">
            {edited && <Tag tone="user">Yours</Tag>}
            {aiReady && opts.regen !== false && (
              <button
                type="button"
                disabled={!!busy || anyDirty}
                title={anyDirty ? "Save your changes first" : `Rewrite ${label.toLowerCase()}`}
                aria-label={`Rewrite ${label.toLowerCase()}`}
                onClick={() => run(`field:${f}`, () => regenerate({ fields: [f] }))}
                className="rounded-md px-1.5 py-0.5 text-xs font-semibold text-violet-deep hover:bg-lavender disabled:opacity-40"
              >
                {busy === `field:${f}` ? "…" : "↻ Rewrite"}
              </button>
            )}
          </span>
        </div>
        {input}
      </div>
    );
  };

  return (
    <div className="pb-24">
      {/* Header */}
      <div className={cn("mb-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border-[1.5px] bg-white p-4", accentBorder[meta.accent])}>
        <div className="min-w-0">
          <p className="text-sm text-slate">Concept {meta.slot} · {meta.label}</p>
          <h2 className="text-heading truncate text-2xl">{content.title}</h2>
          <SceneStrip plan={planPreview} className="mt-3 h-2 max-w-md" />
          <p className="mt-2 text-sm text-slate">{planPreview.aspectRatio} · {planPreview.durationSec.toFixed(0)}s · {planPreview.scenes.length} scenes · {content.pacing} · {content.musicMood}</p>
        </div>
        <Button variant={concept.isPreferred ? "ink" : "secondary"} disabled={!!busy} onClick={() => run("pref", () => setPreferredConcept(concept.id, !concept.isPreferred))}>
          {concept.isPreferred ? "★ This is my pick" : "☆ Choose this one"}
        </Button>
      </div>

      {notice && <Alert tone={notice.tone} className="mb-6">{notice.text}</Alert>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Preview + storyboard */}
        <section aria-labelledby="sb-title">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h3 id="sb-title" className="text-heading text-lg">Storyboard</h3>
              <div role="tablist" aria-label="View" className="flex rounded-lg border border-line bg-white p-0.5 text-sm">
                {(["preview", "frames"] as const).map((v) => (
                  <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={cn("rounded-md px-2.5 py-0.5 font-medium transition-colors", view === v ? "bg-ink text-white" : "text-slate hover:text-ink")}>
                    {v === "preview" ? "▶ Preview" : "Edit scenes"}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-slate">{view === "preview" ? "Live animated preview, no sound yet. Video export is coming soon." : "Click any line to edit it."}</p>
          </div>
          {view === "preview" && (
            <div className="rounded-xl border border-line bg-white p-3">
              <ScenePreview plan={planPreview} logoUrl={logoUrl} productName={productName} />
              {scenesDirty && <p className="mt-2 text-xs text-slate">Showing your unsaved edits.</p>}
            </div>
          )}
          {view === "frames" && (
          <ol className={cn("grid gap-4", planPreview.aspectRatio === "9:16" || planPreview.aspectRatio === "4:5" ? "grid-cols-2 sm:grid-cols-3 xl:grid-cols-4" : "sm:grid-cols-2")}>
            {scenes.map((s, i) => (
              <li key={s.id} className="group rounded-xl border-[1.5px] border-line bg-white p-2.5 transition-colors duration-200 hover:border-line-strong">
                <div className="[container-type:inline-size]">
                  <StoryboardFrame scene={s} plan={planPreview} index={i} logoUrl={logoUrl} />
                </div>
                <div className="mt-2.5 flex items-center justify-between gap-2 text-xs">
                  <span className="flex items-center gap-1.5 text-slate">
                    <span className="h-2 w-2 rounded-full" style={{ background: PURPOSE_COLOR[s.purpose] }} />
                    {s.purpose}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <label className="sr-only" htmlFor={`dur-${s.id}`}>Scene {i + 1} length in seconds</label>
                    <input id={`dur-${s.id}`} type="number" min={0.6} max={12} step={0.5} value={s.durationSec} onChange={(e) => { const v = Math.max(0.6, Math.min(12, +e.target.value || 0.6)); setScenes(scenes.map((x) => (x.id === s.id ? { ...x, durationSec: v } : x))); setScenesDirty(true); }} className="w-12 rounded border border-transparent px-1 text-right font-mono hover:border-line focus:border-violet focus:outline-none" />
                    <span className="text-slate">s</span>
                    <button type="button" aria-label={`Move scene ${i + 1} earlier`} disabled={i === 0} onClick={() => moveScene(i, -1)} className="ml-1 grid h-6 w-6 place-items-center rounded text-slate hover:bg-lavender disabled:opacity-30">←</button>
                    <button type="button" aria-label={`Move scene ${i + 1} later`} disabled={i === scenes.length - 1} onClick={() => moveScene(i, 1)} className="grid h-6 w-6 place-items-center rounded text-slate hover:bg-lavender disabled:opacity-30">→</button>
                  </span>
                </div>
                <label className="sr-only" htmlFor={`h-${s.id}`}>Scene {i + 1} headline</label>
                <input id={`h-${s.id}`} value={s.headline} maxLength={90} onChange={(e) => { setScenes(scenes.map((x) => (x.id === s.id ? { ...x, headline: e.target.value } : x))); setScenesDirty(true); }} className="mt-1 w-full rounded-md border border-transparent px-1.5 py-1 font-semibold hover:border-line focus:border-violet focus:outline-none" />
                <label className="sr-only" htmlFor={`t-${s.id}`}>Scene {i + 1} supporting text</label>
                <input id={`t-${s.id}`} value={s.supportingText} maxLength={160} placeholder="Add supporting text" onChange={(e) => { setScenes(scenes.map((x) => (x.id === s.id ? { ...x, supportingText: e.target.value } : x))); setScenesDirty(true); }} className="w-full rounded-md border border-transparent px-1.5 py-0.5 text-sm text-slate placeholder:text-slate/50 hover:border-line focus:border-violet focus:outline-none" />
              </li>
            ))}
          </ol>
          )}
        </section>

        {/* Right rail: ask + key copy */}
        <div className="space-y-5 lg:sticky lg:top-6 lg:self-start">
          {aiReady && (
            <section className="rounded-[var(--radius-card)] border-2 border-ink bg-white p-4 shadow-[5px_5px_0_0_#7957FF]" aria-labelledby="ask-title">
              <h3 id="ask-title" className="text-heading mb-2 text-lg">Ask for changes</h3>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (ask.trim().length < 2) return;
                  run("ask", () => regenerate({ instruction: ask.trim() }), () => setAsk(""));
                }}
              >
                <label htmlFor="ask" className="sr-only">Describe the change</label>
                <Textarea id="ask" value={ask} onChange={(e) => setAsk(e.target.value)} maxLength={600} placeholder="e.g. Open with the dashboard and make the ending warmer" className="min-h-20 border-line" disabled={aiBusy || anyDirty} />
                <div className="my-3 flex flex-wrap gap-1.5">
                  {QUICK_ASKS.map((q) => (
                    <button key={q} type="button" disabled={aiBusy || anyDirty} onClick={() => setAsk((a) => (a ? `${a.replace(/[.\s]*$/, "")}. ${q}` : q))} className="rounded-full border border-line px-2.5 py-1 text-xs hover:border-violet hover:bg-lavender disabled:opacity-40">
                      {q}
                    </button>
                  ))}
                </div>
                <Button type="submit" className="w-full" disabled={aiBusy || anyDirty || ask.trim().length < 2}>
                  {busy === "ask" ? "Reworking the concept…" : "Apply changes"}
                </Button>
                {anyDirty && <p className="mt-2 text-xs text-slate">Save your edits first.</p>}
              </form>
            </section>
          )}

          <section className="space-y-4 rounded-[var(--radius-card)] border-[1.5px] border-line bg-white p-4" aria-label="Main copy">
            {fieldEditor("headline")}
            {fieldEditor("supportingCopy")}
            {fieldEditor("cta")}
          </section>

          {anyDirty ? (
            <div className="flex gap-2">
              <Button className="flex-1" disabled={!!busy} onClick={() => run("save", saveAll, () => { setDirtyFields(new Set()); setScenesDirty(false); setPrefsDirty(false); })}>
                {busy === "save" ? "Saving…" : "Save my edits"}
              </Button>
              <Button variant="ghost" disabled={!!busy} onClick={() => { setContent(concept.content); setScenes(concept.plan.scenes); setPrefs(concept.preferences); setDirtyFields(new Set()); setScenesDirty(false); setPrefsDirty(false); }}>Undo</Button>
            </div>
          ) : (
            aiReady && (
              <Button variant="secondary" className="w-full" disabled={!!busy} onClick={() => run("fresh", () => regenerate({}))}>
                {busy === "fresh" ? "Writing a fresh take…" : "Try a fresh take (keeps your edits)"}
              </Button>
            )
          )}
        </div>
      </div>

      {/* Advanced */}
      <details className="group mt-10">
        <summary className="flex cursor-pointer select-none items-center justify-between rounded-[var(--radius-card)] border-[1.5px] border-dashed border-line-strong px-6 py-4 font-semibold hover:border-ink">
          More controls: all copy, format, regenerate parts, motion details, history
          <span aria-hidden className="text-slate transition-transform duration-200 group-open:rotate-45">+</span>
        </summary>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-[var(--radius-card)] border-[1.5px] border-coral bg-white p-6">
            <h3 className="text-heading mb-4 text-lg">All copy & direction</h3>
            <div className="grid gap-4">{ADVANCED_FIELDS.map((f) => fieldEditor(f))}</div>
          </section>

          <div className="space-y-6">
            <section className="rounded-[var(--radius-card)] border-[1.5px] border-yellow bg-white p-6">
              <h3 className="text-heading mb-4 text-lg">Format & feel</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Format" htmlFor="p-ar">
                  <Select id="p-ar" value={prefs.aspectRatio} onChange={(e) => { setPrefs({ ...prefs, aspectRatio: e.target.value as CreativePreferences["aspectRatio"] }); setPrefsDirty(true); }}>
                    {ASPECT_RATIOS.map((a) => <option key={a} value={a}>{a} {a === "9:16" ? "Stories/Reels" : a === "16:9" ? "YouTube/Web" : a === "1:1" ? "Feed" : "Portrait feed"}</option>)}
                  </Select>
                </Field>
                <Field label={`Target length: ${prefs.targetDurationSec}s`} htmlFor="p-dur">
                  <input id="p-dur" type="range" min={6} max={60} step={1} value={prefs.targetDurationSec} onChange={(e) => { setPrefs({ ...prefs, targetDurationSec: +e.target.value }); setPrefsDirty(true); }} className="w-full accent-violet" />
                </Field>
                <Field label="Pacing" htmlFor="p-pace">
                  <Select id="p-pace" value={prefs.pacing ?? ""} onChange={(e) => { setPrefs({ ...prefs, pacing: (e.target.value || undefined) as CreativePreferences["pacing"] }); setPrefsDirty(true); }}>
                    <option value="">Let the AI decide</option>
                    {PACING.map((p) => <option key={p} value={p}>{p}</option>)}
                  </Select>
                </Field>
                <Field label="Music mood" htmlFor="p-music">
                  <Input id="p-music" value={prefs.musicMood ?? ""} placeholder="e.g. warm synth-pop" onChange={(e) => { setPrefs({ ...prefs, musicMood: e.target.value || undefined }); setPrefsDirty(true); }} />
                </Field>
              </div>
              <p className="mt-3 text-xs text-slate">These apply the next time the AI rewrites this concept.</p>
            </section>

            {aiReady && (
              <section className="rounded-[var(--radius-card)] border-[1.5px] border-violet bg-white p-6">
                <h3 className="text-heading mb-4 text-lg">Rewrite specific parts</h3>
                <div className="flex flex-wrap gap-2">
                  {REGENERATABLE_FIELDS.map((f) => {
                    const on = selected.has(f);
                    return (
                      <button key={f} type="button" aria-pressed={on} onClick={() => setSelected((s) => { const n = new Set(s); if (on) n.delete(f); else n.add(f); return n; })} className={cn("rounded-full border-[1.5px] px-3 py-1 text-sm transition-colors duration-150", on ? "border-violet bg-lavender font-semibold text-violet-deep" : "border-line text-slate hover:border-violet")}>
                        {FIELD_LABELS[f]}
                      </button>
                    );
                  })}
                </div>
                <Button className="mt-4" disabled={!selected.size || !!busy || anyDirty} onClick={() => run("selected", () => regenerate({ fields: [...selected] }), () => setSelected(new Set()))}>
                  {busy === "selected" ? "Rewriting…" : `Rewrite ${selected.size || ""} selected`}
                </Button>
              </section>
            )}

            <section className="rounded-[var(--radius-card)] border-[1.5px] border-line bg-white p-6">
              <h3 className="text-heading mb-3 text-lg">Assets this ad needs</h3>
              <ul className="space-y-2 text-sm">
                {content.requiredAssets.length === 0 && <li className="text-slate">None listed.</li>}
                {content.requiredAssets.map((a, i) => <li key={i} className="flex gap-3"><Tag>{a.type.replace("_", " ")}</Tag><span>{a.description}</span></li>)}
              </ul>
            </section>

            <section className="rounded-[var(--radius-card)] border-[1.5px] border-line bg-white p-6">
              <h3 className="text-heading mb-3 text-lg">Storyboard history</h3>
              <ul className="divide-y divide-line text-sm">
                {versions.map((v) => (
                  <li key={v.version} className="flex items-center justify-between gap-3 py-2">
                    <span className="flex items-center gap-2">
                      <span className="font-semibold">v{v.version}</span>
                      <Tag tone={v.source === "user" ? "user" : "neutral"}>{v.source === "user" ? "your edit" : v.source === "ai_partial" ? "AI change" : "AI"}</Tag>
                      <span className="text-slate">{fmt.format(new Date(v.created_at))}</span>
                    </span>
                    {v.version === concept.version ? <span className="text-xs font-semibold text-lime-deep">Current</span> : (
                      <button className="text-xs font-semibold text-violet-deep hover:underline disabled:opacity-40" disabled={!!busy || anyDirty} onClick={() => run(`restore:${v.version}`, () => restoreSceneVersion(concept.id, v.version))}>Restore</button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section className="rounded-[var(--radius-card)] border-[1.5px] border-cyan bg-white p-6 lg:col-span-2">
            <h3 className="text-heading mb-1 text-lg">Motion details</h3>
            <p className="mb-4 text-sm text-slate">The exact plan the video renderer will follow.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-slate"><tr><th className="py-2 pr-3 font-medium">#</th><th className="pr-3 font-medium">Elements</th><th className="pr-3 font-medium">Animation</th><th className="pr-3 font-medium">Transition</th><th className="pr-3 font-medium">Audio</th><th className="font-medium">Footage</th></tr></thead>
                <tbody className="divide-y divide-line font-mono">
                  {scenes.map((s, i) => (
                    <tr key={s.id} className="align-top">
                      <td className="py-2 pr-3">{i + 1}</td>
                      <td className="pr-3">{s.visualElements.map((v) => v.type + (v.icon ? `(${v.icon})` : "")).join(", ")}</td>
                      <td className="pr-3">{s.animation.type} {s.animation.durationMs}ms</td>
                      <td className="pr-3">{s.transition.type}</td>
                      <td className="pr-3">{s.audioCues.map((a) => `${a.cue}@${a.atSec}s`).join(", ") || "—"}</td>
                      <td>{s.productFootage.required ? s.productFootage.description || "required" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </details>
    </div>
  );
}
