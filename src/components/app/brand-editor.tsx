"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { saveBrandProfile, uploadLogo } from "@/app/actions/brand";
import { Button, buttonClass } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/card";
import { Alert, Field, Input, Select, Textarea } from "@/components/ui/form";
import { Tag } from "@/components/ui/status";
import { cn } from "@/lib/cn";
import { CAMPAIGN_OBJECTIVES, type BrandProfile, type ListClaim, type Provenance, type TextClaim } from "@/lib/brand/schema";

const OBJECTIVE_LABELS: Record<(typeof CAMPAIGN_OBJECTIVES)[number], string> = {
  awareness: "Brand awareness",
  signups: "Sign-ups",
  free_trial: "Free-trial starts",
  demo_requests: "Demo requests",
  purchases: "Purchases",
  feature_launch: "Feature launch",
  retargeting: "Retargeting",
};

function ProvenanceTag({ p }: { p: Provenance }) {
  if (p === "extracted") return <Tag tone="verified">From site</Tag>;
  if (p === "inferred") return <Tag tone="inferred">AI interpretation</Tag>;
  return <Tag tone="user">Yours</Tag>;
}

function EvidenceList({ claim }: { claim: TextClaim }) {
  if (!claim.evidence.length) return null;
  return (
    <details className="group mt-1.5 text-xs">
      <summary className="cursor-pointer select-none text-slate hover:text-ink">Source evidence ({claim.evidence.length})</summary>
      <ul className="mt-2 space-y-2 border-l-2 border-lime pl-3">
        {claim.evidence.map((e, i) => (
          <li key={i}>
            <q className="text-ink">{e.excerpt}</q>
            <a href={e.url} target="_blank" rel="noreferrer noopener" className="block truncate font-mono text-[10.5px] text-slate hover:text-violet-deep">{e.url}</a>
          </li>
        ))}
      </ul>
    </details>
  );
}

function ClaimField({ label, claim, onChange, multiline, placeholder }: { label: string; claim: TextClaim; onChange: (c: TextClaim) => void; multiline?: boolean; placeholder?: string }) {
  const id = label.toLowerCase().replace(/\W+/g, "-");
  const set = (value: string) => onChange({ value, provenance: "user", evidence: claim.provenance === "extracted" && value === claim.value ? claim.evidence : [] });
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-semibold">{label}</label>
        {claim.value ? <ProvenanceTag p={claim.provenance} /> : <Tag>Missing</Tag>}
      </div>
      {multiline ? (
        <Textarea id={id} value={claim.value} placeholder={placeholder} onChange={(e) => set(e.target.value)} className={cn(!claim.value && "border-dashed")} />
      ) : (
        <Input id={id} value={claim.value} placeholder={placeholder} onChange={(e) => set(e.target.value)} className={cn(!claim.value && "border-dashed")} />
      )}
      <EvidenceList claim={claim} />
    </div>
  );
}

function newItem(value = ""): ListClaim {
  return { id: `usr_${Math.random().toString(36).slice(2, 10)}`, value, provenance: "user", evidence: [], emphasized: false };
}

function ListEditor({ label, items, onChange, emphasize, placeholder, max = 12 }: { label: string; items: ListClaim[]; onChange: (v: ListClaim[]) => void; emphasize?: boolean; placeholder: string; max?: number }) {
  const update = (id: string, patch: Partial<ListClaim>) => onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold">{label}</p>
        {emphasize && <p className="text-xs text-slate">★ = emphasize in ads</p>}
      </div>
      {items.length === 0 && <p className="mb-2 rounded-lg border border-dashed border-line px-3 py-2 text-sm text-slate">Nothing yet.</p>}
      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.id} className="animate-rise">
            <div className="flex items-center gap-2">
              {emphasize && (
                <button
                  type="button"
                  aria-pressed={it.emphasized}
                  aria-label={it.emphasized ? `Stop emphasizing ${it.value}` : `Emphasize ${it.value}`}
                  onClick={() => update(it.id, { emphasized: !it.emphasized })}
                  className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg border-[1.5px] text-lg transition-all duration-200", it.emphasized ? "border-yellow bg-butter text-yellow-deep" : "border-line text-line-strong hover:border-yellow hover:text-yellow-deep")}
                >
                  ★
                </button>
              )}
              <Input
                aria-label={`${label} item`}
                value={it.value}
                onChange={(e) => update(it.id, { value: e.target.value, provenance: "user", evidence: [] })}
                className="h-9 text-sm"
              />
              <span className="hidden shrink-0 sm:block"><ProvenanceTag p={it.provenance} /></span>
              <button type="button" aria-label={`Remove ${it.value}`} onClick={() => onChange(items.filter((i) => i.id !== it.id))} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate hover:bg-peach hover:text-coral-deep">×</button>
            </div>
            {it.evidence[0] && <p className="ml-11 mt-1 truncate text-xs text-slate">“{it.evidence[0].excerpt}”</p>}
          </li>
        ))}
      </ul>
      {items.length < max && (
        <button type="button" onClick={() => onChange([...items, newItem()])} className="mt-2 text-sm font-semibold text-violet-deep hover:underline">
          + Add {placeholder}
        </button>
      )}
    </div>
  );
}

function ColorInput({ value, onChange, onRemove, label }: { value: string; onChange: (v: string) => void; onRemove?: () => void; label: string }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <div className="flex items-center gap-2 rounded-xl border-[1.5px] border-line p-1.5 pr-2">
      <label className="relative h-9 w-9 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-black/10" style={{ background: value }}>
        <span className="sr-only">{label}</span>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} className="absolute inset-0 cursor-pointer opacity-0" />
      </label>
      <input
        aria-label={`${label} hex`}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) onChange(e.target.value.toUpperCase());
        }}
        className="w-20 bg-transparent font-mono text-sm uppercase focus:outline-none"
      />
      {onRemove && <button type="button" aria-label={`Remove ${label}`} onClick={onRemove} className="text-slate hover:text-coral-deep">×</button>}
    </div>
  );
}

export function BrandEditor({ projectId, initial, aiReady = false }: { projectId: string; initial: BrandProfile; aiReady?: boolean }) {
  const router = useRouter();
  const [profile, setProfile] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [saving, startSave] = useTransition();
  const [uploading, startUpload] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function edit(fn: (p: BrandProfile) => BrandProfile) {
    setProfile((p) => fn(structuredClone(p)));
    setDirty(true);
    setStatus(null);
  }
  const id = profile.identity;

  function save(thenRefresh = false) {
    startSave(async () => {
      if (dirty) {
        const r = await saveBrandProfile(projectId, profile);
        if (r?.error) return setStatus({ tone: "error", text: r.error });
        setDirty(false);
        setStatus({ tone: "success", text: "Saved." });
      }
      if (thenRefresh) {
        const res = await fetch(`/api/projects/${projectId}/concepts`, { method: "POST" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          return setStatus({ tone: "error", text: body.error ?? "Couldn't refresh the concepts." });
        }
        router.push(`/projects/${projectId}`);
        router.refresh();
      }
    });
  }

  return (
    <div className="pb-28">
      {profile.missing.length > 0 && (
        <Alert tone="warning" className="mb-4">
          <p className="mb-1 font-semibold">A few things need your input</p>
          <ul className="list-disc space-y-0.5 pl-4">{profile.missing.map((m) => <li key={m}>{m}</li>)}</ul>
        </Alert>
      )}
      <p className="mb-4 flex flex-wrap items-center gap-2 text-xs text-slate">
        Labels: <Tag tone="verified">From site</Tag> found word-for-word on your pages · <Tag tone="inferred">AI interpretation</Tag> our read, not a fact · <Tag tone="user">Yours</Tag> written or edited by you
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard accent="violet" eyebrow="Look" title="Look & feel" >
          <div className="space-y-6">
            <div>
              <div className="mb-2 flex items-center justify-between"><p className="text-sm font-semibold">Colors</p><ProvenanceTag p={id.colorProvenance} /></div>
              <div className="mb-3 flex h-16 overflow-hidden rounded-xl border border-line" aria-hidden>
                <span className="flex-[3]" style={{ background: id.primaryColor }} />
                {id.secondaryColors.map((c, i) => <span key={`s${i}`} className="flex-[2]" style={{ background: c }} />)}
                {id.accentColors.map((c, i) => <span key={`a${i}`} className="flex-1" style={{ background: c }} />)}
              </div>
              <div className="space-y-3">
                <div><p className="label-tech mb-1.5">Primary</p><ColorInput label="Primary color" value={id.primaryColor} onChange={(v) => edit((p) => ({ ...p, identity: { ...p.identity, primaryColor: v, colorProvenance: "user" } }))} /></div>
                {(["secondaryColors", "accentColors"] as const).map((key) => (
                  <div key={key}>
                    <p className="label-tech mb-1.5">{key === "secondaryColors" ? "Secondary" : "Accents"}</p>
                    <div className="flex flex-wrap gap-2">
                      {id[key].map((c, i) => (
                        <ColorInput
                          key={i}
                          label={`${key === "secondaryColors" ? "Secondary" : "Accent"} color ${i + 1}`}
                          value={c}
                          onChange={(v) => edit((p) => { p.identity[key][i] = v; p.identity.colorProvenance = "user"; return p; })}
                          onRemove={() => edit((p) => { p.identity[key].splice(i, 1); p.identity.colorProvenance = "user"; return p; })}
                        />
                      ))}
                      {id[key].length < 4 && (
                        <button type="button" onClick={() => edit((p) => { p.identity[key].push("#39C6E8"); p.identity.colorProvenance = "user"; return p; })} className="h-12 rounded-xl border-[1.5px] border-dashed border-line px-4 text-sm font-semibold text-slate hover:border-violet hover:text-violet-deep">+ Add</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between"><p className="text-sm font-semibold">Typography</p><ProvenanceTag p={id.typography.provenance} /></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Heading font" htmlFor="font-h"><Input id="font-h" value={id.typography.heading} placeholder="e.g. Sora" onChange={(e) => edit((p) => ({ ...p, identity: { ...p.identity, typography: { ...p.identity.typography, heading: e.target.value, provenance: "user" } } }))} /></Field>
                <Field label="Body font" htmlFor="font-b"><Input id="font-b" value={id.typography.body} placeholder="e.g. Inter" onChange={(e) => edit((p) => ({ ...p, identity: { ...p.identity, typography: { ...p.identity.typography, body: e.target.value, provenance: "user" } } }))} /></Field>
              </div>
              <div className="mt-3 rounded-xl bg-lavender/60 p-4">
                <p className="text-2xl font-bold leading-tight" style={{ fontFamily: `"${id.typography.heading}", var(--font-sans)` }}>{profile.product.valueProposition.value || "Your headline here"}</p>
                <p className="mt-1 text-sm text-slate" style={{ fontFamily: `"${id.typography.body}", var(--font-sans)` }}>Preview uses the font if it&apos;s installed on this device.</p>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between"><p className="text-sm font-semibold">Logo</p>{id.logoUrl ? <ProvenanceTag p={id.logoProvenance} /> : <Tag>Missing</Tag>}</div>
              <div className="flex items-center gap-4">
                <div className="grid h-20 w-32 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-[repeating-conic-gradient(#F5F5F8_0_25%,#fff_0_50%)] bg-[length:14px_14px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {id.logoUrl ? <img src={id.logoUrl} alt="Current logo" referrerPolicy="no-referrer" className="max-h-16 max-w-28 object-contain" /> : <span className="text-xs text-slate">No logo</span>}
                </div>
                <div className="space-y-2">
                  <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" id="logo-upload"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const fd = new FormData();
                      fd.set("logo", f);
                      startUpload(async () => {
                        const r = await uploadLogo(projectId, fd);
                        if (r.error) setStatus({ tone: "error", text: r.error });
                        else if (r.url) {
                          setProfile((p) => ({ ...p, identity: { ...p.identity, logoUrl: r.url!, logoProvenance: "user" } }));
                          setStatus({ tone: "success", text: "Logo replaced." });
                        }
                        if (fileRef.current) fileRef.current.value = "";
                      });
                    }} />
                  <label htmlFor="logo-upload" className={buttonClass("secondary", "sm", "cursor-pointer")}>{uploading ? "Uploading…" : "Replace logo"}</label>
                  <p className="text-xs text-slate">PNG, JPG, WebP or SVG · up to 5 MB</p>
                </div>
              </div>
            </div>

            <ClaimField label="Visual style" claim={id.visualStyle} multiline placeholder="e.g. Clean, white, playful illustrations" onChange={(c) => edit((p) => ({ ...p, identity: { ...p.identity, visualStyle: c } }))} />
            <Field label="Design preference" htmlFor="theme">
              <Select id="theme" value={id.themePreference} onChange={(e) => edit((p) => ({ ...p, identity: { ...p.identity, themePreference: e.target.value as BrandProfile["identity"]["themePreference"] } }))}>
                <option value="light">Light</option><option value="dark">Dark</option><option value="mixed">Mixed</option>
              </Select>
            </Field>
          </div>
        </SectionCard>

        <SectionCard accent="cyan" eyebrow="Product" title="What you sell">
          <div className="space-y-5">
            <ClaimField label="Product name" claim={profile.product.name} onChange={(c) => edit((p) => ({ ...p, product: { ...p.product, name: c } }))} />
            <ClaimField label="Category" claim={profile.product.category} placeholder="e.g. Email automation for support teams" onChange={(c) => edit((p) => ({ ...p, product: { ...p.product, category: c } }))} />
            <ClaimField label="Product description" claim={profile.product.description} multiline onChange={(c) => edit((p) => ({ ...p, product: { ...p.product, description: c } }))} />
            <ClaimField label="Value proposition" claim={profile.product.valueProposition} multiline onChange={(c) => edit((p) => ({ ...p, product: { ...p.product, valueProposition: c } }))} />
            <ClaimField label="Target audience" claim={profile.product.targetAudience} multiline placeholder="Who is this ad for?" onChange={(c) => edit((p) => ({ ...p, product: { ...p.product, targetAudience: c } }))} />
            <ListEditor label="Core features" placeholder="feature" emphasize max={20} items={profile.product.features} onChange={(v) => edit((p) => ({ ...p, product: { ...p.product, features: v } }))} />
            <ListEditor label="Problems solved" placeholder="problem" items={profile.product.problems} onChange={(v) => edit((p) => ({ ...p, product: { ...p.product, problems: v } }))} />
            <ListEditor label="Benefits" placeholder="benefit" items={profile.product.benefits} onChange={(v) => edit((p) => ({ ...p, product: { ...p.product, benefits: v } }))} />
            <ListEditor label="Use cases" placeholder="use case" items={profile.product.useCases} onChange={(v) => edit((p) => ({ ...p, product: { ...p.product, useCases: v } }))} />
          </div>
        </SectionCard>

        <details className="group lg:col-span-2" open={false}>
          <summary className="flex cursor-pointer select-none items-center justify-between rounded-[var(--radius-card)] border-[1.5px] border-dashed border-line-strong px-6 py-4 font-semibold hover:border-ink">
            More details: tone, messages, CTAs and campaign goal
            <span aria-hidden className="text-slate transition-transform duration-200 group-open:rotate-45">+</span>
          </summary>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <SectionCard accent="coral" eyebrow="Marketing" title="How you talk">
          <div className="space-y-5">
            <ClaimField label="Brand tone" claim={profile.marketing.tone} placeholder="e.g. Confident, warm, a little cheeky" onChange={(c) => edit((p) => ({ ...p, marketing: { ...p.marketing, tone: c } }))} />
            <ListEditor label="Marketing messages" placeholder="message" items={profile.marketing.messages} onChange={(v) => edit((p) => ({ ...p, marketing: { ...p.marketing, messages: v } }))} />
            <ListEditor label="Calls to action" placeholder="CTA" max={10} items={profile.marketing.ctas} onChange={(v) => edit((p) => ({ ...p, marketing: { ...p.marketing, ctas: v } }))} />
            <ListEditor label="Conversion goals" placeholder="goal" max={8} items={profile.marketing.conversionGoals} onChange={(v) => edit((p) => ({ ...p, marketing: { ...p.marketing, conversionGoals: v } }))} />
            <ListEditor label="Advertising angles" placeholder="angle" max={10} items={profile.marketing.adAngles} onChange={(v) => edit((p) => ({ ...p, marketing: { ...p.marketing, adAngles: v } }))} />
          </div>
        </SectionCard>

        <SectionCard accent="lime" eyebrow="Campaign" title="What this ad should do">
          <div className="grid gap-5">
            <Field label="Campaign objective" htmlFor="objective">
              <Select id="objective" value={profile.campaign.objective} onChange={(e) => edit((p) => ({ ...p, campaign: { ...p.campaign, objective: e.target.value as BrandProfile["campaign"]["objective"] } }))}>
                {CAMPAIGN_OBJECTIVES.map((o) => <option key={o} value={o}>{OBJECTIVE_LABELS[o]}</option>)}
              </Select>
            </Field>
            <Field label="Notes for the creative director" htmlFor="notes" hint="Offers, launch details, things to avoid. Only include facts that are true.">
              <Textarea id="notes" value={profile.campaign.notes} maxLength={2000} onChange={(e) => edit((p) => ({ ...p, campaign: { ...p.campaign, notes: e.target.value } }))} />
            </Field>
          </div>
        </SectionCard>
          </div>
        </details>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 backdrop-blur lg:left-60">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
          <div className="text-sm" aria-live="polite">
            {status ? (
              <span className={status.tone === "error" ? "text-coral-deep" : "text-lime-deep"}>{status.text}</span>
            ) : dirty ? (
              <span className="flex items-center gap-2 text-slate"><span className="h-2 w-2 rounded-full bg-yellow" /> Unsaved changes</span>
            ) : (
              <span className="text-slate">All changes saved</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => save(false)} disabled={saving || !dirty}>{saving ? "Saving…" : "Save"}</Button>
            {aiReady && <Button onClick={() => save(true)} disabled={saving}>{dirty ? "Save & update my ads" : "Update my ads"}</Button>}
          </div>
        </div>
      </div>
    </div>
  );
}
