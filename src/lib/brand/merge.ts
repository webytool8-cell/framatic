import type { BrandProfile, ListClaim, TextClaim } from "./schema";

/**
 * When a site is re-analyzed, keep everything the user wrote or edited and
 * take fresh values for the rest.
 */
export function mergeReanalysis(existing: BrandProfile, fresh: BrandProfile): BrandProfile {
  const keep = (a: TextClaim, b: TextClaim) => (a.provenance === "user" && a.value ? a : b);
  const keepList = (a: ListClaim[], b: ListClaim[]) => {
    const mine = a.filter((i) => i.provenance === "user");
    const emphasized = new Set(a.filter((i) => i.emphasized).map((i) => i.value.toLowerCase()));
    const theirs = b
      .filter((i) => !mine.some((m) => m.value.toLowerCase() === i.value.toLowerCase()))
      .map((i) => (emphasized.size ? { ...i, emphasized: emphasized.has(i.value.toLowerCase()) } : i));
    return [...mine, ...theirs];
  };
  const userColors = existing.identity.colorProvenance === "user";
  const userType = existing.identity.typography.provenance === "user" && !!existing.identity.typography.heading;
  const userLogo = existing.identity.logoProvenance === "user" && !!existing.identity.logoUrl;
  return {
    ...fresh,
    identity: {
      ...fresh.identity,
      ...(userColors
        ? {
            primaryColor: existing.identity.primaryColor,
            secondaryColors: existing.identity.secondaryColors,
            accentColors: existing.identity.accentColors,
            colorProvenance: "user" as const,
          }
        : {}),
      typography: userType ? existing.identity.typography : fresh.identity.typography,
      logoUrl: userLogo ? existing.identity.logoUrl : fresh.identity.logoUrl,
      logoProvenance: userLogo ? "user" : fresh.identity.logoProvenance,
      visualStyle: keep(existing.identity.visualStyle, fresh.identity.visualStyle),
    },
    product: {
      name: keep(existing.product.name, fresh.product.name),
      category: keep(existing.product.category, fresh.product.category),
      targetAudience: keep(existing.product.targetAudience, fresh.product.targetAudience),
      valueProposition: keep(existing.product.valueProposition, fresh.product.valueProposition),
      description: keep(existing.product.description, fresh.product.description),
      problems: keepList(existing.product.problems, fresh.product.problems),
      features: keepList(existing.product.features, fresh.product.features),
      benefits: keepList(existing.product.benefits, fresh.product.benefits),
      useCases: keepList(existing.product.useCases, fresh.product.useCases),
    },
    marketing: {
      tone: keep(existing.marketing.tone, fresh.marketing.tone),
      messages: keepList(existing.marketing.messages, fresh.marketing.messages),
      ctas: keepList(existing.marketing.ctas, fresh.marketing.ctas),
      conversionGoals: keepList(existing.marketing.conversionGoals, fresh.marketing.conversionGoals),
      adAngles: keepList(existing.marketing.adAngles, fresh.marketing.adAngles),
    },
    campaign: existing.campaign,
  };
}
