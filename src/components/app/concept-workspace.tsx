"use client";
import { CREDIT_COST, type CreditCosts } from "@/lib/plans";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { restoreSceneVersion, saveManualEdits, setPreferredConcept, updateConceptPreferences, updateMusic } from "@/app/actions/concepts";
import { MusicPicker } from "@/components/app/music-picker";
import { Button } from "@/components/ui/button";
import { accentBorder } from "@/components/ui/card";
import { Alert, Field, Input, Select, Textarea } from "@/components/ui/form";
import { Tag } from "@/components/ui/status";
import { SceneStrip } from "@/components/app/storyboard";
import { SceneInspector, SceneList } from "@/components/app/scene-editor";
import { StylePanel, type StyleState } from "@/components/app/style-panel";
import { ScenePreview } from "@/components/app/scene-preview";
import { ExportPanel, type RenderItem } from "@/components/app/export-panel";
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
import type { Scene, ScenePlan } from "@/lib/creative/scene-plan";
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
  /** Live credit costs (from billing config). */
  creditCosts?: CreditCosts;
  logoUrl: string | null;
  productName?: string;
  aiReady: boolean;
  renderReady?: boolean;
  renders?: RenderItem[];
  /** Read-only sample: edits stay in the browser, nothing saves, no exports, no AI. */
  sample?: boolean;
};

const QUICK_ASKS = ["Make it punchier", "Shorter: 15 seconds", "Vertical 9:16 for Reels", "More playful", "Focus on one feature", "Stronger call to action"];
const LONG: EditableField[] = ["description", "rationale", "supportingCopy", "visualDirection", "typographyDirection", "targetAudience"];
const ADVANCED_FIELDS: EditableField[] = ["title", "campaignObjective", "description", "targetAudience", "rationale", "visualDirection", "typographyDirection", "musicMood", "pacing"];
const fmt = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function ConceptWorkspace({ concept, versions, logoUrl, productName, aiReady, renderReady = false, renders = [], creditCosts = CREDIT_COST, sample = false }: Props) {
  const router = useRouter();
  const meta = CONCEPT_META[concept.kind];
  const [content, setContent] = useState(concept.content);
  const [dirtyFields, setDirtyFields] = useState<Set<string>>(new Set());
  const [scenes, setScenes] = useState(concept.plan.scenes);
  const [scenesDirty, setScenesDirty] = useState(false);
  const originalStyle: StyleState = { aspectRatio: concept.plan.aspectRatio, palette: concept.plan.palette, fonts: concept.plan.fonts };
  const [style, setStyle] = useState<StyleState>(originalStyle);
  const [selectedScene, setSelectedScene] = useState(0);
  const [tab, setTab] = useState<"scene" | "style" | "copy">("scene");
  const [prefs, setPrefs] = useState(concept.preferences);
  const [prefsDirty, setPrefsDirty] = useState(false);
  const [ask, setAsk] = useState("");
  const [selected, setSelected] = useState<Set<RegeneratableField>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [, start] = useTransition();
  const planPreview: ScenePlan = { ...concept.plan, ...style, scenes, durationSec: scenes.reduce((n, s) => n + s.durationSec, 0) };
  const styleDirty = JSON.stringify(style) !== JSON.stringify(originalStyle);
  const planDirty = scenesDirty || styleDirty;
  const anyDirty = dirtyFields.size > 0 || planDirty || prefsDirty;
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
      // A fresh key per click: a retried request can't be charged twice.
      headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { error: json.error ?? "That didn't work. Please try again." };
    const changed = (json.changed ?? []) as string[];
    if (body.instruction) return { message: "Done. Here's the new version." };
    return { message: changed.length ? `Updated: ${changed.map((c) => FIELD_LABELS[c as RegeneratableField] ?? c).join(", ")}` : "Nothing changed. Everything is locked by your edits." };
  }

  /** Save every manual edit as one new version. Always free. */
  async function saveAll() {
    if (dirtyFields.size || planDirty) {
      const r = await saveManualEdits(concept.id, {
        content: dirtyFields.size ? Object.fromEntries([...dirtyFields].map((f) => [f, content[f as EditableField]])) : undefined,
        plan: planDirty ? { scenes, ...style } : undefined,
      });
      if (r?.error) return r;
    }
    if (prefsDirty) {
      const r = await updateConceptPreferences(concept.id, prefs);
      if (r?.error) return r;
    }
    return { message: "Saved. Editing is always free." };
  }

  function changeScenes(next: Scene[], select?: number) {
    setScenes(next);
    setScenesDirty(true);
    setNotice(null);
    if (select !== undefined) setSelectedScene(Math.max(0, Math.min(next.length - 1, select)));
  }

  function undoAll() {
    setContent(concept.content);
    setScenes(concept.plan.scenes);
    setStyle(originalStyle);
    setPrefs(concept.preferences);
    setDirtyFields(new Set());
    setScenesDirty(false);
    setPrefsDirty(false);
    setSelectedScene((i) => Math.min(i, concept.plan.scenes.length - 1));
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
                title={anyDirty ? "Save your changes first" : `Let the AI rewrite ${label.toLowerCase()} (${creditCosts.regenerate} credits)`}
                aria-label={`AI rewrite ${label.toLowerCase()}`}
                onClick={() => run(`field:${f}`, () => regenerate({ fields: [f] }))}
                className="rounded-md px-1.5 py-0.5 text-xs font-semibold text-violet-deep hover:bg-lavender disabled:opacity-40"
              >
                {busy === `field:${f}` ? "…" : "✦ AI"}
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
      <div className={cn("mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border-[1.5px] bg-white p-6", accentBorder[meta.accent])}>
        <div className="min-w-0">
          <p className="text-sm text-slate">Concept {meta.slot} · {meta.label}</p>
          <h2 className="text-heading truncate text-2xl">{content.title}</h2>
          <SceneStrip plan={planPreview} className="mt-3 h-2 max-w-md" />
          <p className="mt-2 text-sm text-slate">{planPreview.aspectRatio} · {planPreview.durationSec.toFixed(0)}s · {planPreview.scenes.length} scenes · {content.pacing} · {content.musicMood}</p>
        </div>
        {sample ? (
          <span className="rounded-full bg-butter px-3 py-1 text-sm font-semibold text-yellow-deep">Sample project · view only</span>
        ) : (
          <Button variant={concept.isPreferred ? "ink" : "secondary"} disabled={!!busy} onClick={() => run("pref", () => setPreferredConcept(concept.id, !concept.isPreferred))}>
            {concept.isPreferred ? "★ This is my pick" : "☆ Choose this one"}
          </Button>
        )}
      </div>

      {notice && <Alert tone={notice.tone} className="mb-6">{notice.text}</Alert>}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* Preview + scenes */}
        <section aria-labelledby="sb-title" className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 id="sb-title" className="text-heading text-lg">Your ad</h3>
            <p className="text-xs text-slate">{anyDirty ? "Preview shows your unsaved changes." : "Live preview with music. Press play to hear it."}</p>
          </div>
          <div className="rounded-xl border border-line bg-white p-3">
            <ScenePreview key={`${style.aspectRatio}-${scenes.length}`} plan={planPreview} logoUrl={logoUrl} productName={productName} />
          </div>
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-semibold">Scenes</h4>
              <p className="text-xs text-slate">Pick a scene to edit it. {planPreview.durationSec.toFixed(1)}s in total.</p>
            </div>
            <SceneList
              scenes={scenes}
              plan={planPreview}
              selected={selectedScene}
              logoUrl={logoUrl}
              onSelect={(i) => { setSelectedScene(i); setTab("scene"); }}
              onChange={(next, sel) => { changeScenes(next, sel); setTab("scene"); }}
            />
          </div>
        </section>

        {/* Right rail: manual editor first, AI second */}
        <div className="space-y-6 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:self-start lg:overflow-y-auto lg:pb-2">
          <section className="rounded-[var(--radius-card)] border-2 border-ink bg-white shadow-[5px_5px_0_0_#7957FF]" aria-labelledby="edit-title">
            <div className="flex items-center justify-between gap-2 border-b border-line px-4 pt-4">
              <h3 id="edit-title" className="text-heading pb-3 text-lg">Edit</h3>
              <span className="mb-3 rounded-full bg-mint px-2 py-0.5 text-[11px] font-semibold text-lime-deep">{sample ? "Try it · nothing is saved" : "Free · no credits"}</span>
            </div>
            <div role="tablist" aria-label="Edit" className="flex gap-1 border-b border-line px-3">
              {([["scene", `Scene ${selectedScene + 1}`], ["style", "Look & format"], ["copy", "Copy"]] as const).map(([k, label]) => (
                <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn("-mb-px border-b-2 px-2.5 py-2 text-sm font-medium", tab === k ? "border-violet text-ink" : "border-transparent text-slate hover:text-ink")}>
                  {label}
                </button>
              ))}
            </div>
            <div className="p-4">
              {tab === "scene" && <SceneInspector scenes={scenes} index={Math.min(selectedScene, scenes.length - 1)} plan={planPreview} onChange={changeScenes} />}
              {tab === "style" && (
                <div className="space-y-6">
                  <StylePanel value={style} original={originalStyle} onChange={(v) => { setStyle(v); setNotice(null); }} />
                  <div>
                    <p className="mb-1.5 text-sm font-semibold">Music & sound</p>
                    <MusicPicker
                      track={concept.plan.music.track}
                      volume={concept.plan.music.volume ?? 0.7}
                      soundSet={concept.plan.music.soundSet}
                      disabled={sample || !!busy || anyDirty}
                      stacked
                      onChange={(t, v, set) => run("music", () => updateMusic(concept.id, t, v, set))}
                    />
                    {sample ? <p className="mt-1 text-xs text-slate">Music can be changed in your own projects.</p> : anyDirty && <p className="mt-1 text-xs text-slate">Save your other changes before switching music.</p>}
                  </div>
                </div>
              )}
              {tab === "copy" && (
                <div className="space-y-4">
                  {fieldEditor("headline")}
                  {fieldEditor("supportingCopy")}
                  {fieldEditor("cta")}
                  <p className="text-xs text-slate">This is the concept&apos;s main copy. On-screen text for each scene is under Scene.</p>
                </div>
              )}
            </div>
          </section>

          {sample ? (
            <section className="rounded-[var(--radius-card)] border-[1.5px] border-dashed border-line-strong bg-white p-4">
              <h3 className="text-heading text-lg">Export</h3>
              <p className="mt-1 text-sm text-slate">Exports are turned off for the sample project. Make your own project to export MP4s of your ads.</p>
              <a href="/projects/new" className="mt-3 inline-flex rounded-lg bg-violet px-4 py-2 text-sm font-semibold text-white hover:bg-violet-deep">Start your own project</a>
            </section>
          ) : (
          <ExportPanel renderCost={creditCosts.render} conceptId={concept.id} enabled={renderReady} initial={renders} version={concept.version} aspectRatio={concept.plan.aspectRatio} durationSec={concept.plan.durationSec} hasUnsaved={anyDirty} />
          )}

          {aiReady && !sample && (
            <details className="group rounded-[var(--radius-card)] border-[1.5px] border-line bg-white" aria-labelledby="ask-title">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-4">
                <span>
                  <span id="ask-title" className="text-heading block text-lg">✦ Ask the AI instead</span>
                  <span className="text-xs text-slate">Describe a bigger change and the AI reworks the concept · {creditCosts.regenerate} credits</span>
                </span>
                <span aria-hidden className="text-slate transition-transform duration-200 group-open:rotate-45">+</span>
              </summary>
              <form
                className="border-t border-line p-4"
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
                <Button type="submit" variant="secondary" className="w-full" disabled={aiBusy || anyDirty || ask.trim().length < 2}>
                  {busy === "ask" ? "Reworking the concept…" : `Rework with AI · ${creditCosts.regenerate} credits`}
                </Button>
                <Button type="button" variant="ghost" className="mt-2 w-full" disabled={!!busy || anyDirty} onClick={() => run("fresh", () => regenerate({}))}>
                  {busy === "fresh" ? "Writing a fresh take…" : `Fresh take, keeping your edits · ${creditCosts.regenerate} credits`}
                </Button>
                {anyDirty && <p className="mt-2 text-xs text-slate">Save your edits first.</p>}
              </form>
            </details>
          )}
        </div>
      </div>

      {/* Unsaved changes bar */}
      {anyDirty && (
        <div role="region" aria-label="Unsaved changes" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 backdrop-blur lg:left-60">
          <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 py-3 sm:px-8 lg:px-12">
            {sample ? (
              <p className="text-sm"><span className="font-semibold">This is a sample project.</span> <span className="text-slate">Your changes show in the preview but aren&apos;t saved.</span></p>
            ) : (
              <p className="text-sm"><span className="font-semibold">Unsaved changes.</span> <span className="text-slate">Saving is free{concept.plan.music.track && concept.plan.music.track !== "none" ? "; scene lengths snap to the beat" : ""}.</span></p>
            )}
            <div className="flex gap-2">
              <Button variant="ghost" disabled={!!busy} onClick={undoAll}>{sample ? "Reset" : "Undo all"}</Button>
              {sample ? (
                <a href="/projects/new" className="inline-flex items-center rounded-lg bg-violet px-4 text-sm font-semibold text-white hover:bg-violet-deep">Start your own project</a>
              ) : (
                <Button disabled={!!busy} onClick={() => run("save", saveAll, () => { setDirtyFields(new Set()); setScenesDirty(false); setPrefsDirty(false); })}>
                  {busy === "save" ? "Saving…" : "Save changes"}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Advanced */}
      <details className="group mt-10">
        <summary className="flex cursor-pointer select-none items-center justify-between rounded-[var(--radius-card)] border-[1.5px] border-dashed border-line-strong px-6 py-4 font-semibold hover:border-ink">
          More: all copy, AI preferences, version history, motion details
          <span aria-hidden className="text-slate transition-transform duration-200 group-open:rotate-45">+</span>
        </summary>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-[var(--radius-card)] border-[1.5px] border-coral bg-white p-6">
            <h3 className="text-heading mb-4 text-lg">All copy & direction</h3>
            <div className="grid gap-4">{ADVANCED_FIELDS.map((f) => fieldEditor(f))}</div>
          </section>

          <div className="space-y-6">
            <section className="rounded-[var(--radius-card)] border-[1.5px] border-yellow bg-white p-6">
              <h3 className="text-heading mb-1 text-lg">AI preferences</h3>
              <p className="mb-4 text-sm text-slate">Only used when the AI writes or reworks this concept. To change the ad now, use Edit.</p>
              <div className="grid gap-4 sm:grid-cols-2">
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
            </section>

            {aiReady && (
              <section className="rounded-[var(--radius-card)] border-[1.5px] border-violet bg-white p-6">
                <h3 className="text-heading mb-1 text-lg">AI: rewrite specific parts</h3>
                <p className="mb-4 text-sm text-slate">{creditCosts.regenerate} credits per rewrite. Anything you edited yourself stays as it is.</p>
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
                    {v.version === concept.version || sample ? <span className="text-xs font-semibold text-lime-deep">Current</span> : (
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
