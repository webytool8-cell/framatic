import { z } from "zod";
import type { SiteAnalysis } from "@/lib/analyzer/crawl";
import type { StructuredLLM } from "@/lib/ai/llm";
import {
  BRAND_SCHEMA_VERSION,
  BrandProfileSchema,
  CAMPAIGN_OBJECTIVES,
  type BrandProfile,
  type Evidence,
  type ListClaim,
  type TextClaim,
} from "./schema";

/* ---------- What we ask the model for ---------- */

const AIClaim = z.object({
  value: z.string().min(1).max(600),
  evidence: z
    .array(
      z.object({
        url: z.string().describe("URL of the analyzed page the excerpt comes from"),
        excerpt: z.string().max(300).describe("Short VERBATIM excerpt copied from that page's content"),
      }),
    )
    .max(3)
    .describe("Verbatim support from the site. Empty if this is your interpretation."),
});
type AIClaim = z.infer<typeof AIClaim>;

export const AIBrandAnalysis = z.object({
  productName: AIClaim,
  category: AIClaim,
  targetAudience: AIClaim,
  valueProposition: AIClaim,
  description: AIClaim,
  visualStyle: z.string().max(400).describe("Short description of the site's visual style based on the extracted colors, fonts and copy"),
  tone: AIClaim,
  problems: z.array(AIClaim).max(8),
  features: z.array(AIClaim).max(12).describe("ONLY features explicitly stated on the site, each with a verbatim excerpt"),
  benefits: z.array(AIClaim).max(8),
  useCases: z.array(AIClaim).max(8),
  messages: z.array(AIClaim).max(8).describe("Key marketing messages / taglines found on the site"),
  ctas: z.array(AIClaim).max(8).describe("Calls to action that appear on the site"),
  conversionGoals: z.array(z.string().max(160)).max(5),
  adAngles: z.array(z.string().max(240)).min(1).max(6).describe("Promising angles for a video ad, grounded in the site content"),
  suggestedObjective: z.enum(CAMPAIGN_OBJECTIVES),
  missing: z.array(z.string().max(200)).max(15).describe("Important things you could not determine from the site"),
});
export type AIBrandAnalysis = z.infer<typeof AIBrandAnalysis>;

const SYSTEM = `You are Framatic's brand strategist. You analyze the content of a company's website and produce a structured brand and product profile that will be used to write video advertisements.

Rules:
- Use ONLY the website content provided. Never invent features, capabilities, prices, statistics, customers, testimonials or awards.
- For factual claims (product name, features, CTAs, messages, problems the site says it solves), include evidence: the page URL and a SHORT VERBATIM excerpt copied exactly from that page's content.
- Interpretations (audience, tone, angles, benefits you infer) may have empty evidence — they will be labeled as AI interpretation.
- If something can't be determined, leave it out and list it in "missing". Do not guess.
- Keep values concise and ad-ready.`;

export function buildSiteDigest(site: SiteAnalysis, budget = 24_000): string {
  const header = [
    `Root URL: ${site.rootUrl}`,
    site.siteName ? `Site name (from metadata): ${site.siteName}` : null,
    `Extracted colors: primary ${site.palette.primary ?? "none"}; secondary ${site.palette.secondary.join(", ") || "none"}; accents ${site.palette.accents.join(", ") || "none"}`,
    `Extracted fonts: ${site.fonts.join(", ") || "none detected"}`,
    `Theme: ${site.theme}`,
  ]
    .filter(Boolean)
    .join("\n");
  const perPage = Math.floor((budget - header.length) / Math.max(1, site.pages.length));
  const pages = site.pages.map((p) => {
    const lines = [
      `=== PAGE ${p.url} (${p.pageType}) ===`,
      p.title ? `Title: ${p.title}` : null,
      p.description ? `Meta description: ${p.description}` : null,
      p.headings.length ? `Headings: ${p.headings.slice(0, 20).join(" | ")}` : null,
      p.ctas.length ? `Buttons/CTAs: ${p.ctas.slice(0, 12).join(" | ")}` : null,
      `Content:\n${p.text}`,
    ]
      .filter(Boolean)
      .join("\n");
    return lines.slice(0, perPage);
  });
  return `${header}\n\n${pages.join("\n\n")}`;
}

/* ---------- Evidence verification ---------- */

export function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/ /g, " ")
    .replace(/[^\p{L}\p{N}'"$%&+-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function corpusFor(site: SiteAnalysis): Map<string, string> {
  const m = new Map<string, string>();
  for (const p of site.pages) {
    m.set(
      p.url.replace(/\/$/, ""),
      normalizeForMatch([p.title, p.description, ...p.headings, ...p.ctas, p.text, ...Object.values(p.og)].filter(Boolean).join(" \n ")),
    );
  }
  return m;
}

/** Keep only evidence whose excerpt actually appears on an analyzed page. */
export function verifyEvidence(evidence: AIClaim["evidence"], corpus: Map<string, string>): Evidence[] {
  const out: Evidence[] = [];
  for (const ev of evidence) {
    const needle = normalizeForMatch(ev.excerpt);
    if (needle.length < 6) continue;
    const key = ev.url.replace(/\/$/, "");
    const direct = corpus.get(key);
    if (direct?.includes(needle)) {
      out.push({ url: key, excerpt: ev.excerpt.slice(0, 300) });
      continue;
    }
    for (const [url, text] of corpus) {
      if (text.includes(needle)) {
        out.push({ url, excerpt: ev.excerpt.slice(0, 300) });
        break;
      }
    }
  }
  return out;
}

let idCounter = 0;
function newId(prefix: string) {
  idCounter = (idCounter + 1) % 1e6;
  return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function toClaim(c: AIClaim | undefined, corpus: Map<string, string>): TextClaim {
  if (!c) return { value: "", provenance: "inferred", evidence: [] };
  const evidence = verifyEvidence(c.evidence, corpus);
  return { value: c.value.trim(), provenance: evidence.length ? "extracted" : "inferred", evidence };
}

function toList(
  items: AIClaim[],
  corpus: Map<string, string>,
  prefix: string,
  requireEvidence: boolean,
  dropped: { count: number },
): ListClaim[] {
  const out: ListClaim[] = [];
  for (const it of items) {
    const claim = toClaim(it, corpus);
    if (!claim.value) continue;
    if (requireEvidence && claim.provenance !== "extracted") {
      dropped.count++;
      continue;
    }
    if (out.some((o) => o.value.toLowerCase() === claim.value.toLowerCase())) continue;
    out.push({ ...claim, id: newId(prefix), emphasized: false });
  }
  return out;
}

/* ---------- Assembling the profile ---------- */

function identityFrom(site: SiteAnalysis, visualStyle: TextClaim): BrandProfile["identity"] {
  const hasColors = !!site.palette.primary;
  const heading = site.fonts[0] ?? "";
  const body = site.fonts[1] ?? site.fonts[0] ?? "";
  const logo = site.logo?.url ?? site.favicon ?? null;
  return {
    primaryColor: site.palette.primary ?? "#7957FF",
    secondaryColors: site.palette.secondary,
    accentColors: site.palette.accents,
    colorProvenance: hasColors ? "extracted" : "inferred",
    typography: { heading, body, provenance: heading ? "extracted" : "inferred" },
    logoUrl: logo,
    logoProvenance: logo ? "extracted" : "inferred",
    visualStyle,
    themePreference: site.theme,
  };
}

function deterministicMissing(site: SiteAnalysis): string[] {
  const m: string[] = [];
  if (!site.palette.primary) m.push("Brand colors couldn't be detected — a default was used. Set your brand colors.");
  if (!site.fonts.length) m.push("Brand fonts couldn't be detected.");
  if (!site.logo && !site.favicon) m.push("No logo was found. Upload one.");
  return m;
}

/** AI-assisted brand profile, with evidence verified against the crawled pages. */
export async function buildBrandProfile(site: SiteAnalysis, llm: StructuredLLM): Promise<BrandProfile> {
  const ai = await llm.generate({
    system: SYSTEM,
    prompt: `Analyze this website and fill in the brand profile.\n\n${buildSiteDigest(site)}`,
    schema: AIBrandAnalysis,
    toolName: "save_brand_profile",
    toolDescription: "Save the structured brand and product profile for this website.",
    maxTokens: 6000,
  });
  return assembleProfile(site, ai);
}

export function assembleProfile(site: SiteAnalysis, ai: AIBrandAnalysis): BrandProfile {
  const corpus = corpusFor(site);
  const droppedFeatures = { count: 0 };
  const droppedCtas = { count: 0 };
  const noop = { count: 0 };

  const missing = [...deterministicMissing(site), ...ai.missing];
  const profile: BrandProfile = {
    schemaVersion: BRAND_SCHEMA_VERSION,
    identity: identityFrom(site, { value: ai.visualStyle, provenance: "inferred", evidence: [] }),
    product: {
      name: toClaim(ai.productName, corpus),
      category: toClaim(ai.category, corpus),
      targetAudience: toClaim(ai.targetAudience, corpus),
      valueProposition: toClaim(ai.valueProposition, corpus),
      description: toClaim(ai.description, corpus),
      problems: toList(ai.problems, corpus, "prb", false, noop),
      features: toList(ai.features, corpus, "ftr", true, droppedFeatures),
      benefits: toList(ai.benefits, corpus, "bnf", false, noop),
      useCases: toList(ai.useCases, corpus, "use", false, noop),
    },
    marketing: {
      tone: toClaim(ai.tone, corpus),
      messages: toList(ai.messages, corpus, "msg", false, noop),
      ctas: toList(ai.ctas, corpus, "cta", true, droppedCtas),
      conversionGoals: ai.conversionGoals.map((g) => ({ id: newId("cvg"), value: g, provenance: "inferred" as const, evidence: [], emphasized: false })),
      adAngles: ai.adAngles.map((a) => ({ id: newId("ang"), value: a, provenance: "inferred" as const, evidence: [], emphasized: false })),
    },
    campaign: { objective: ai.suggestedObjective, notes: "" },
    missing: [],
  };

  // Emphasize the first three verified features by default.
  profile.product.features.slice(0, 3).forEach((f) => (f.emphasized = true));
  if (droppedFeatures.count) missing.push(`${droppedFeatures.count} suggested feature(s) were left out because they couldn't be found on the site.`);
  if (droppedCtas.count) missing.push(`${droppedCtas.count} suggested CTA(s) were left out because they don't appear on the site.`);
  if (!profile.product.features.length) missing.push("No product features could be verified — add the features you want to highlight.");
  profile.missing = [...new Set(missing)].slice(0, 30);
  return BrandProfileSchema.parse(profile);
}

/**
 * Extraction-only profile used when the AI service is unavailable.
 * Contains only what was found verbatim on the site; everything else is left
 * blank for the user, and the gap is stated explicitly.
 */
export function extractionOnlyProfile(site: SiteAnalysis): BrandProfile {
  const home = site.pages[0];
  const ev = (excerpt: string, url = home.url): Evidence[] => [{ url, excerpt: excerpt.slice(0, 300) }];
  const fromText = (v: string | null | undefined, url = home.url): TextClaim =>
    v ? { value: v, provenance: "extracted", evidence: ev(v, url) } : { value: "", provenance: "user", evidence: [] };
  const h1 = home.headings[0] ?? null;

  const featureSource = site.pages.find((p) => p.pageType === "features") ?? site.pages.find((p) => p.featureLists.length) ?? home;
  const features: ListClaim[] = (featureSource.featureLists[0] ?? []).slice(0, 8).map((f) => ({
    id: newId("ftr"),
    value: f,
    provenance: "extracted",
    evidence: ev(f, featureSource.url),
    emphasized: false,
  }));
  const ctas: ListClaim[] = [...new Set(site.pages.flatMap((p) => p.ctas))].slice(0, 6).map((c) => ({
    id: newId("cta"),
    value: c,
    provenance: "extracted",
    evidence: ev(c),
    emphasized: false,
  }));

  return BrandProfileSchema.parse({
    schemaVersion: BRAND_SCHEMA_VERSION,
    identity: identityFrom(site, { value: "", provenance: "user", evidence: [] }),
    product: {
      name: fromText(site.siteName),
      category: { value: "", provenance: "user", evidence: [] },
      targetAudience: { value: "", provenance: "user", evidence: [] },
      valueProposition: fromText(h1),
      description: fromText(home.description),
      problems: [],
      features,
      benefits: [],
      useCases: [],
    },
    marketing: {
      tone: { value: "", provenance: "user", evidence: [] },
      messages: home.headings.slice(1, 4).map((h) => ({ id: newId("msg"), value: h, provenance: "extracted", evidence: ev(h), emphasized: false })),
      ctas,
      conversionGoals: [],
      adAngles: [],
    },
    campaign: { objective: "signups", notes: "" },
    missing: [
      "AI interpretation was unavailable, so only content found directly on the site was filled in. Add the audience, category, tone and benefits manually.",
      ...deterministicMissing(site),
    ],
  });
}
