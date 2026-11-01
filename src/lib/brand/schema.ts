import { z } from "zod";

/**
 * Brand profile — the single source of truth fed into the creative director
 * (Phase 1) and the renderer (Phase 2).
 *
 * Every claim carries provenance so the UI can distinguish:
 *   extracted → found verbatim on the analyzed website (has evidence)
 *   inferred  → AI interpretation (no verbatim evidence)
 *   user      → supplied or edited by the user
 */
export const BRAND_SCHEMA_VERSION = 1;

export const Provenance = z.enum(["extracted", "inferred", "user"]);
export type Provenance = z.infer<typeof Provenance>;

export const Evidence = z.object({
  url: z.string().max(2048),
  excerpt: z.string().max(500),
});
export type Evidence = z.infer<typeof Evidence>;

export const TextClaim = z.object({
  value: z.string().max(2000),
  provenance: Provenance,
  evidence: z.array(Evidence).max(5).default([]),
});
export type TextClaim = z.infer<typeof TextClaim>;

export const ListClaim = TextClaim.extend({
  id: z.string().min(1).max(64),
  emphasized: z.boolean().default(false),
});
export type ListClaim = z.infer<typeof ListClaim>;

export const HexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Expected a 6-digit hex color like #7957FF")
  .transform((v) => v.toUpperCase());

export const CAMPAIGN_OBJECTIVES = [
  "awareness",
  "signups",
  "free_trial",
  "demo_requests",
  "purchases",
  "feature_launch",
  "retargeting",
] as const;
export const CampaignObjective = z.enum(CAMPAIGN_OBJECTIVES);
export type CampaignObjective = z.infer<typeof CampaignObjective>;

export const BrandProfileSchema = z.object({
  schemaVersion: z.literal(BRAND_SCHEMA_VERSION),
  identity: z.object({
    primaryColor: HexColor,
    secondaryColors: z.array(HexColor).max(4),
    accentColors: z.array(HexColor).max(4),
    colorProvenance: Provenance,
    typography: z.object({
      heading: z.string().max(120),
      body: z.string().max(120),
      provenance: Provenance,
    }),
    logoUrl: z.string().max(2048).nullable(),
    logoProvenance: Provenance,
    visualStyle: TextClaim,
    themePreference: z.enum(["light", "dark", "mixed"]),
  }),
  product: z.object({
    name: TextClaim,
    category: TextClaim,
    targetAudience: TextClaim,
    valueProposition: TextClaim,
    description: TextClaim,
    problems: z.array(ListClaim).max(12),
    features: z.array(ListClaim).max(20),
    benefits: z.array(ListClaim).max(12),
    useCases: z.array(ListClaim).max(12),
  }),
  marketing: z.object({
    tone: TextClaim,
    messages: z.array(ListClaim).max(12),
    ctas: z.array(ListClaim).max(10),
    conversionGoals: z.array(ListClaim).max(8),
    adAngles: z.array(ListClaim).max(10),
  }),
  campaign: z.object({
    objective: CampaignObjective,
    notes: z.string().max(2000),
  }),
  /** Human-readable list of things the analysis could not determine. */
  missing: z.array(z.string().max(200)).max(30),
});
export type BrandProfile = z.infer<typeof BrandProfileSchema>;

export function emptyClaim(value = "", provenance: Provenance = "user"): TextClaim {
  return { value, provenance, evidence: [] };
}

/** A blank profile used for manual entry when a site can't be analyzed. */
export function blankBrandProfile(name = ""): BrandProfile {
  return {
    schemaVersion: BRAND_SCHEMA_VERSION,
    identity: {
      primaryColor: "#7957FF",
      secondaryColors: [],
      accentColors: [],
      colorProvenance: "user",
      typography: { heading: "", body: "", provenance: "user" },
      logoUrl: null,
      logoProvenance: "user",
      visualStyle: emptyClaim(),
      themePreference: "light",
    },
    product: {
      name: emptyClaim(name),
      category: emptyClaim(),
      targetAudience: emptyClaim(),
      valueProposition: emptyClaim(),
      description: emptyClaim(),
      problems: [],
      features: [],
      benefits: [],
      useCases: [],
    },
    marketing: {
      tone: emptyClaim(),
      messages: [],
      ctas: [],
      conversionGoals: [],
      adAngles: [],
    },
    campaign: { objective: "signups", notes: "" },
    missing: [],
  };
}

export const LIST_SECTIONS = {
  "product.problems": "Problems solved",
  "product.features": "Core features",
  "product.benefits": "Benefits",
  "product.useCases": "Use cases",
  "marketing.messages": "Marketing messages",
  "marketing.ctas": "Calls to action",
  "marketing.conversionGoals": "Conversion goals",
  "marketing.adAngles": "Advertising angles",
} as const;
