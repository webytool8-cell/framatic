import type { StructuredLLM } from "@/lib/ai/llm";
import type { BrandProfile } from "@/lib/brand/schema";
import {
  AIConcept,
  CONCEPT_META,
  FIELD_LABELS,
  type ConceptContent,
  type ConceptKind,
  type CreativePreferences,
  type RegeneratableField,
} from "./concept";
import {
  ANIMATION_TYPES,
  ASSET_REFS,
  AUDIO_CUES,
  BACKGROUND_TYPES,
  ICONS,
  SCENE_PURPOSES,
  ScenePlan,
  TRANSITION_TYPES,
  VISUAL_ELEMENT_TYPES,
  normalizeScenePlan,
  snapToBeats,
  type ScenePlan as ScenePlanT,
} from "./scene-plan";
import { pickTrack, trackById } from "@/video/music";

const SYSTEM = `You are Framatic's creative director: an award-winning motion-design ad creative.
You turn a verified brand profile into a specific, polished video-ad concept and a structured scene plan for a programmatic motion-graphics renderer.

Hard rules:
- Use only facts from the brand profile. Never invent features, numbers, customers, testimonials, awards or prices. Items marked [AI interpretation] are not verified facts — use them as direction only, never as claims.
- Copy must be short, concrete and on-brand. On-screen headlines ideally ≤ 7 words.
- The scene plan uses ONLY the controlled vocabulary in the schema. Do not write code.
- Make the concept feel tailored to THIS brand (its tone, audience, category, colors) — not a generic template.
- Scene durations must add up to roughly the target duration. The final scene is a CTA end card.`;

function claimLine(label: string, c: { value: string; provenance: string }) {
  if (!c.value) return null;
  return `${label}: ${c.value}${c.provenance === "inferred" ? " [AI interpretation]" : ""}`;
}

export function brandBrief(b: BrandProfile): string {
  const list = (label: string, items: Array<{ value: string; provenance: string; emphasized?: boolean }>) => {
    if (!items.length) return null;
    const sorted = [...items].sort((x, y) => Number(!!y.emphasized) - Number(!!x.emphasized));
    return `${label}:\n${sorted
      .map((i) => `  - ${i.value}${i.emphasized ? " (EMPHASIZE)" : ""}${i.provenance === "inferred" ? " [AI interpretation]" : ""}`)
      .join("\n")}`;
  };
  return [
    claimLine("Product name", b.product.name),
    claimLine("Category", b.product.category),
    claimLine("Target audience", b.product.targetAudience),
    claimLine("Value proposition", b.product.valueProposition),
    claimLine("Description", b.product.description),
    list("Problems solved", b.product.problems),
    list("Features", b.product.features),
    list("Benefits", b.product.benefits),
    list("Use cases", b.product.useCases),
    claimLine("Brand tone", b.marketing.tone),
    list("Marketing messages", b.marketing.messages),
    list("CTAs on the site", b.marketing.ctas),
    list("Advertising angles", b.marketing.adAngles),
    `Campaign objective: ${b.campaign.objective}`,
    b.campaign.notes ? `Campaign notes from the user: ${b.campaign.notes}` : null,
    `Brand colors: primary ${b.identity.primaryColor}; secondary ${b.identity.secondaryColors.join(", ") || "—"}; accents ${b.identity.accentColors.join(", ") || "—"}`,
    `Typography: heading "${b.identity.typography.heading || "unknown"}", body "${b.identity.typography.body || "unknown"}"`,
    b.identity.visualStyle.value ? `Visual style: ${b.identity.visualStyle.value}` : null,
    `Theme: ${b.identity.themePreference}`,
    `Logo available: ${b.identity.logoUrl ? "yes" : "no"}`,
  ]
    .filter(Boolean)
    .join("\n");
}

const VOCAB = `Controlled vocabulary:
- scene purposes: ${SCENE_PURPOSES.join(", ")}
- visual element types: ${VISUAL_ELEMENT_TYPES.join(", ")}
- animation types: ${ANIMATION_TYPES.join(", ")}
- transitions: ${TRANSITION_TYPES.join(", ")}
- backgrounds: ${BACKGROUND_TYPES.join(", ")}; colors are palette refs (primary, secondary, accent, ink, paper) or hex
- icons: ${ICONS.join(", ")}
- audio cues: ${AUDIO_CUES.join(", ")}
- brand asset refs: ${ASSET_REFS.join(", ")}`;

export interface GenerateConceptInput {
  kind: ConceptKind;
  brand: BrandProfile;
  preferences: CreativePreferences;
  /** For regeneration: the current concept, so the model can stay consistent. */
  existing?: { content: ConceptContent; scenePlan: ScenePlanT };
  /** Only regenerate these fields (others are provided as fixed context). */
  only?: RegeneratableField[];
  /** Titles/headlines of sibling concepts — keep this one distinct. */
  siblings?: string[];
  /** Fields the user edited; the model should treat them as fixed. */
  lockedFields?: string[];
  /** Plain-language change request from the user ("make it punchier"). */
  instruction?: string;
}

export function buildPrompt(input: GenerateConceptInput): string {
  const meta = CONCEPT_META[input.kind];
  const p = input.preferences;
  const parts = [
    `Create concept ${meta.slot}: "${meta.label}".`,
    `Concept brief: ${meta.brief}`,
    `\nBRAND PROFILE\n${brandBrief(input.brand)}`,
    `\nCREATIVE PREFERENCES${p.objective ? `\n- Campaign objective for this ad: ${p.objective}` : ""}\n- Aspect ratio: ${p.aspectRatio}\n- Target duration: ~${p.targetDurationSec}s${p.pacing ? `\n- Pacing: ${p.pacing}` : ""}${p.musicMood ? `\n- Music mood: ${p.musicMood}` : ""}${p.tone ? `\n- Tone: ${p.tone}` : ""}${p.notes ? `\n- Notes: ${p.notes}` : ""}`,
    `\n${VOCAB}`,
  ];
  if (input.siblings?.length) {
    parts.push(`\nOther concepts already proposed (make this one clearly different): ${input.siblings.join(" | ")}`);
  }
  if (input.existing) {
    const fixed = input.only
      ? Object.keys(FIELD_LABELS).filter((f) => !input.only!.includes(f as RegeneratableField))
      : (input.lockedFields ?? []);
    parts.push(
      `\nCURRENT VERSION OF THIS CONCEPT (JSON):\n${JSON.stringify({ ...input.existing.content, scenes: input.existing.scenePlan.scenes.map((s) => ({ purpose: s.purpose, headline: s.headline, supportingText: s.supportingText })) })}`,
    );
    if (input.instruction) {
      parts.push(
        `\nTHE USER ASKED FOR THESE CHANGES:\n"""${input.instruction.slice(0, 600)}"""\nApply them faithfully. Keep whatever already works and isn't affected by the request. Still never invent facts about the product.`,
      );
    } else if (input.only?.length) {
      parts.push(
        `\nRewrite ONLY these fields with a fresh, better take: ${input.only.map((f) => FIELD_LABELS[f]).join(", ")}. Keep every other field identical to the current version and keep the result coherent with it.`,
      );
    } else {
      parts.push(`\nProduce a fresh take on this concept.${fixed.length ? ` These fields were written by the user — keep them exactly and build around them: ${fixed.join(", ")}.` : ""}`);
    }
  }
  return parts.join("\n");
}

function paletteFor(b: BrandProfile): ScenePlanT["palette"] {
  const dark = b.identity.themePreference === "dark";
  const secondary = b.identity.secondaryColors[0] ?? b.identity.accentColors[0] ?? "#202124";
  const accent = b.identity.accentColors[0] ?? b.identity.secondaryColors[1] ?? secondary;
  return {
    primary: b.identity.primaryColor,
    secondary,
    accent,
    ink: dark ? "#FFFFFF" : "#202124",
    paper: dark ? "#111114" : "#FFFFFF",
  };
}

/**
 * Brand-controlled values (palette, fonts, aspect ratio, CTA) are set
 * deterministically from the profile/preferences rather than trusted from AI.
 */
export function finalizeConcept(ai: AIConcept, brand: BrandProfile, prefs: CreativePreferences): AIConcept {
  // Pick music from the built-in library (keeping an explicit choice) and cut scenes on the beat.
  const requested = prefs.musicTrack ?? ai.scenePlan.music.track;
  const track = requested === "none" ? null : (trackById(requested) ?? pickTrack([prefs.musicMood ?? "", ai.musicMood, ai.scenePlan.music.mood, ai.pacing], ai.scenePlan.music.bpm));
  const soundSet = prefs.soundSet ?? track?.soundSet ?? "airy";
  const withMusic: ScenePlanT = track
    ? snapToBeats({ ...ai.scenePlan, music: { ...ai.scenePlan.music, track: track.id, soundSet } }, track.bpm)
    : { ...ai.scenePlan, music: { ...ai.scenePlan.music, track: "none", soundSet } };
  const plan: ScenePlanT = normalizeScenePlan(
    {
      ...withMusic,
      aspectRatio: prefs.aspectRatio,
      palette: paletteFor(brand),
      fonts: {
        heading: brand.identity.typography.heading || "Space Grotesk",
        body: brand.identity.typography.body || brand.identity.typography.heading || "Inter",
      },
    },
    ai.cta,
  );
  const validated = ScenePlan.parse(plan);
  return { ...ai, estimatedDurationSec: validated.durationSec, scenePlan: validated };
}

export async function generateConcept(llm: StructuredLLM, input: GenerateConceptInput): Promise<AIConcept> {
  const ai = await llm.generate({
    system: SYSTEM,
    prompt: buildPrompt(input),
    schema: AIConcept,
    toolName: "save_ad_concept",
    toolDescription: "Save the complete advertising concept and its structured scene plan.",
    maxTokens: 9000,
  });
  return finalizeConcept(ai, input.brand, input.preferences);
}
