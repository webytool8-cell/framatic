import { z } from "zod";
import { ASPECT_RATIOS, ScenePlan } from "./scene-plan";
import { CampaignObjective } from "@/lib/brand/schema";

export const CONCEPT_KINDS = ["problem_solution", "product_in_motion", "brand_manifesto"] as const;
export type ConceptKind = (typeof CONCEPT_KINDS)[number];

export const CONCEPT_META: Record<ConceptKind, { slot: "A" | "B" | "C"; label: string; accent: "coral" | "cyan" | "violet"; brief: string }> = {
  problem_solution: {
    slot: "A",
    label: "Problem → Solution",
    accent: "coral",
    brief:
      "A narrative that opens on a real, specific problem the audience recognizes (from the brand profile), builds tension briefly, reveals the product as the answer, then communicates its value and ends on the CTA.",
  },
  product_in_motion: {
    slot: "B",
    label: "Product in Motion",
    accent: "cyan",
    brief:
      "A feature-focused ad centered on the actual product interface. Most scenes show screenshots or product recordings with feature callouts for the emphasized, verified features. Fast, clear, demonstrative.",
  },
  brand_manifesto: {
    slot: "C",
    label: "Brand Manifesto",
    accent: "violet",
    brief:
      "A visually expressive, music-driven concept led by bold kinetic typography and geometric animation. Short declarative lines that express what the brand believes, building to a memorable logo/product reveal and CTA.",
  },
};

export const PACING = ["calm", "steady", "punchy", "rapid"] as const;

export const CreativePreferences = z.object({
  aspectRatio: z.enum(ASPECT_RATIOS).default("16:9"),
  targetDurationSec: z.number().int().min(6).max(60).default(30),
  pacing: z.enum(PACING).optional(),
  musicMood: z.string().max(120).optional(),
  tone: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
  objective: CampaignObjective.optional(),
  /** Built-in music track chosen by the user ("none" = silent). */
  musicTrack: z.string().max(40).optional(),
});
export type CreativePreferences = z.infer<typeof CreativePreferences>;

export const RequiredAsset = z.object({
  type: z.enum(["logo", "screenshot", "product_recording", "product_image", "icon_set", "music_track"]),
  description: z.string().max(240),
});

/** The editable, human-facing part of a concept. */
export const ConceptContent = z.object({
  title: z.string().min(1).max(80),
  description: z.string().max(600),
  targetAudience: z.string().max(300),
  campaignObjective: CampaignObjective,
  rationale: z.string().max(800).describe("Why this concept fits this brand and audience"),
  headline: z.string().min(1).max(90),
  supportingCopy: z.string().max(300),
  cta: z.string().min(1).max(40),
  visualDirection: z.string().max(600),
  typographyDirection: z.string().max(400),
  musicMood: z.string().max(160),
  pacing: z.enum(PACING),
  estimatedDurationSec: z.number().min(5).max(90),
  requiredAssets: z.array(RequiredAsset).max(8),
});
export type ConceptContent = z.infer<typeof ConceptContent>;

/** What the model must return per concept. */
export const AIConcept = ConceptContent.extend({ scenePlan: ScenePlan });
export type AIConcept = z.infer<typeof AIConcept>;

/** Fields a user can edit or ask to regenerate individually. */
export const EDITABLE_FIELDS = [
  "title",
  "description",
  "targetAudience",
  "campaignObjective",
  "rationale",
  "headline",
  "supportingCopy",
  "cta",
  "visualDirection",
  "typographyDirection",
  "musicMood",
  "pacing",
] as const;
export type EditableField = (typeof EDITABLE_FIELDS)[number];

/** `scenes` is a pseudo-field: regenerating it rebuilds the scene plan. */
export const REGENERATABLE_FIELDS = [...EDITABLE_FIELDS, "scenes"] as const;
export type RegeneratableField = (typeof REGENERATABLE_FIELDS)[number];

export const FIELD_LABELS: Record<RegeneratableField, string> = {
  title: "Title",
  description: "Description",
  targetAudience: "Target audience",
  campaignObjective: "Campaign objective",
  rationale: "Creative rationale",
  headline: "Primary headline",
  supportingCopy: "Supporting copy",
  cta: "CTA",
  visualDirection: "Visual direction",
  typographyDirection: "Typography direction",
  musicMood: "Music mood",
  pacing: "Pacing",
  scenes: "Scene sequence",
};

/**
 * Merge a freshly generated concept with the existing one.
 * - Fields the user edited are preserved unless explicitly requested.
 * - When `only` is given, nothing outside it changes.
 */
export function mergeConcept(
  existing: { content: ConceptContent; scenePlan: ScenePlan; editedFields: string[] },
  fresh: AIConcept,
  only?: RegeneratableField[],
): { content: ConceptContent; scenePlan: ScenePlan; editedFields: string[]; changed: RegeneratableField[] } {
  const requested = new Set<string>(only ?? []);
  const edited = new Set(existing.editedFields);
  const content: ConceptContent = { ...existing.content };
  const changed: RegeneratableField[] = [];

  for (const f of EDITABLE_FIELDS) {
    const allowed = only ? requested.has(f) : !edited.has(f);
    if (!allowed) continue;
    if (JSON.stringify(content[f]) !== JSON.stringify(fresh[f])) changed.push(f);
    (content as Record<string, unknown>)[f] = fresh[f];
    if (requested.has(f)) edited.delete(f);
  }

  let scenePlan = existing.scenePlan;
  const scenesAllowed = only ? requested.has("scenes") : !edited.has("scenes");
  if (scenesAllowed) {
    scenePlan = fresh.scenePlan;
    changed.push("scenes");
    edited.delete("scenes");
    content.estimatedDurationSec = fresh.scenePlan.durationSec;
    content.requiredAssets = fresh.requiredAssets;
  }
  return { content, scenePlan, editedFields: [...edited], changed };
}
