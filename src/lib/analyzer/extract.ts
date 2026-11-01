import * as cheerio from "cheerio";

export type PageType = "home" | "about" | "product" | "features" | "pricing" | "landing" | "other";

export interface ExtractedPage {
  url: string;
  pageType: PageType;
  title: string | null;
  description: string | null;
  headings: string[];
  /** Cleaned readable text, capped. */
  text: string;
  ctas: string[];
  featureLists: string[][];
  og: Record<string, string>;
  themeColor: string | null;
  logoCandidates: Array<{ url: string; alt: string | null; score: number }>;
  images: Array<{ url: string; alt: string | null }>;
  favicon: string | null;
  internalLinks: Array<{ url: string; text: string }>;
  stylesheetUrls: string[];
  inlineCss: string[];
  googleFontFamilies: string[];
  /** Heuristic: page looks like a client-rendered shell with little server HTML. */
  looksClientRendered: boolean;
}

const MAX_TEXT = 8000;
const CTA_WORDS =
  /\b(get started|start|try|sign ?up|join|book|request|schedule|demo|buy|shop|order|subscribe|download|contact|talk to|create|free|install|claim|reserve|learn more|see pricing|get)\b/i;

export function classifyPage(url: URL, isRoot: boolean): PageType {
  if (isRoot) return "home";
  const p = url.pathname.toLowerCase();
  if (/(^|\/)(about|company|story|mission|team)(\/|$|-)/.test(p)) return "about";
  if (/(^|\/)(pricing|plans|price)(\/|$|-)/.test(p)) return "pricing";
  if (/(^|\/)(features?|capabilities|how-it-works|benefits)(\/|$|-)/.test(p)) return "features";
  if (/(^|\/)(products?|platform|solutions?|shop|collections?|tour|use-cases?)(\/|$|-)/.test(p)) return "product";
  if (/(^|\/)(lp|landing|get|start|try|why)(\/|$|-)/.test(p)) return "landing";
  return "other";
}

function clean(s: string | undefined | null): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

function abs(href: string | undefined, base: URL): string | null {
  if (!href) return null;
  const h = href.trim();
  if (!h || h.startsWith("data:") || h.startsWith("javascript:") || h.startsWith("mailto:") || h.startsWith("tel:")) return null;
  try {
    const u = new URL(h, base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

export function sameSite(a: URL, b: URL): boolean {
  const strip = (h: string) => h.toLowerCase().replace(/^www\./, "");
  return strip(a.hostname) === strip(b.hostname);
}

export function extractPage(html: string, pageUrl: string, isRoot = false): ExtractedPage {
  const base = new URL(pageUrl);
  const $ = cheerio.load(html);

  const meta = (sel: string) => clean($(sel).attr("content")) || null;
  const og: Record<string, string> = {};
  $('meta[property^="og:"], meta[name^="og:"], meta[name^="twitter:"]').each((_, el) => {
    const key = ($(el).attr("property") || $(el).attr("name") || "").toLowerCase();
    const val = clean($(el).attr("content"));
    if (key && val && !og[key]) og[key] = val.slice(0, 500);
  });

  const inlineCss: string[] = [];
  $("style").each((_, el) => {
    inlineCss.push($(el).text().slice(0, 200_000));
  });
  const styleAttrs = $("[style]")
    .slice(0, 400)
    .map((_, el) => $(el).attr("style"))
    .get()
    .join(";\n");
  if (styleAttrs) inlineCss.push(`x{${styleAttrs}}`);

  const stylesheetUrls = $('link[rel~="stylesheet"]')
    .map((_, el) => abs($(el).attr("href"), base))
    .get()
    .filter((u): u is string => !!u);

  const googleFontFamilies: string[] = [];
  for (const href of [...stylesheetUrls, ...$('link[href*="fonts.googleapis.com"]').map((_, el) => $(el).attr("href")).get()]) {
    if (!href || !href.includes("fonts.googleapis.com")) continue;
    try {
      const u = new URL(href, base);
      for (const fam of u.searchParams.getAll("family")) {
        for (const f of fam.split("|")) googleFontFamilies.push(f.split(":")[0].replace(/\+/g, " "));
      }
    } catch {
      /* ignore */
    }
  }

  // Logo candidates
  const logoCandidates: ExtractedPage["logoCandidates"] = [];
  $("img").each((_, el) => {
    const $el = $(el);
    const src = abs($el.attr("src") || $el.attr("data-src") || ($el.attr("srcset") || "").split(" ")[0], base);
    if (!src) return;
    const alt = clean($el.attr("alt")) || null;
    const hay = `${src} ${alt ?? ""} ${$el.attr("class") ?? ""} ${$el.attr("id") ?? ""}`.toLowerCase();
    let score = 0;
    if (hay.includes("logo")) score += 5;
    if ($el.closest("header, nav, [class*=header], [class*=navbar]").length) score += 3;
    if ($el.closest("a[href='/'], a[href='./']").length) score += 3;
    if (/\.svg(\?|$)/.test(src)) score += 1;
    if (score >= 5) logoCandidates.push({ url: src, alt, score });
  });
  const ogImage = og["og:image"] ? abs(og["og:image"], base) : null;
  const favicon =
    abs($('link[rel="apple-touch-icon"]').attr("href"), base) ??
    abs($('link[rel~="icon"]').attr("href"), base) ??
    null;
  logoCandidates.sort((a, b) => b.score - a.score);

  const images = $("img")
    .map((_, el) => {
      const src = abs($(el).attr("src") || $(el).attr("data-src"), base);
      return src ? { url: src, alt: clean($(el).attr("alt")) || null } : null;
    })
    .get()
    .filter((x): x is { url: string; alt: string | null } => !!x && !x.url.includes("pixel") && !x.url.includes("tracking"))
    .slice(0, 24);
  if (ogImage && !images.some((i) => i.url === ogImage)) images.unshift({ url: ogImage, alt: "Open Graph image" });

  // Links
  const internalLinks: ExtractedPage["internalLinks"] = [];
  const seen = new Set<string>();
  $("a[href]").each((_, el) => {
    const u = abs($(el).attr("href"), base);
    if (!u) return;
    const parsed = new URL(u);
    if (!sameSite(parsed, base)) return;
    parsed.search = "";
    const key = parsed.toString().replace(/\/$/, "");
    if (seen.has(key)) return;
    seen.add(key);
    internalLinks.push({ url: parsed.toString(), text: clean($(el).text()).slice(0, 80) });
  });

  // CTAs (before stripping nav/footer)
  const ctaSet = new Set<string>();
  $("a, button").each((_, el) => {
    const $el = $(el);
    const t = clean($el.text());
    if (!t || t.length > 40 || t.length < 2) return;
    const cls = `${$el.attr("class") ?? ""} ${$el.attr("role") ?? ""}`.toLowerCase();
    if (CTA_WORDS.test(t) || /\b(btn|button|cta)\b/.test(cls)) ctaSet.add(t);
  });

  // Content
  $("script, noscript, style, svg, iframe, template, [aria-hidden=true]").remove();
  const headings = $("h1, h2, h3")
    .map((_, el) => clean($(el).text()))
    .get()
    .filter((h) => h.length > 1 && h.length < 200);

  const featureLists: string[][] = [];
  $("ul, ol").each((_, el) => {
    const $el = $(el);
    if ($el.closest("nav, footer, header").length) return;
    const items = $el
      .children("li")
      .map((_, li) => clean($(li).text()))
      .get()
      .filter((t) => t.length > 3 && t.length < 220);
    if (items.length >= 3 && items.length <= 15) featureLists.push(items);
  });

  const $body = $("body").clone();
  $body.find("nav, footer, header form, [role=navigation], [class*=cookie], [id*=cookie]").remove();
  const blocks: string[] = [];
  $body.find("h1, h2, h3, h4, p, li, blockquote, figcaption, td, dt, dd").each((_, el) => {
    const t = clean($(el).text());
    if (t.length > 2 && !blocks.includes(t)) blocks.push(t);
  });
  let text = blocks.join("\n");
  if (text.length > MAX_TEXT) text = text.slice(0, MAX_TEXT);

  const scriptCount = cheerio.load(html)("script").length;
  const looksClientRendered = text.length < 250 && (scriptCount >= 2 || /id=["'](root|__next|app|__nuxt)["']/.test(html));

  return {
    url: pageUrl,
    pageType: classifyPage(base, isRoot),
    title: clean($("title").first().text()) || og["og:title"] || null,
    description: meta('meta[name="description"]') ?? og["og:description"] ?? null,
    headings: headings.slice(0, 40),
    text,
    ctas: [...ctaSet].slice(0, 20),
    featureLists: featureLists.slice(0, 8),
    og,
    themeColor: meta('meta[name="theme-color"]'),
    logoCandidates: logoCandidates.slice(0, 5),
    images,
    favicon,
    internalLinks: internalLinks.slice(0, 200),
    stylesheetUrls: stylesheetUrls.slice(0, 10),
    inlineCss,
    googleFontFamilies: [...new Set(googleFontFamilies)],
    looksClientRendered,
  };
}

const PRIORITY: Array<[RegExp, number]> = [
  [/(^|\/)(features?|capabilities)(\/|$)/, 10],
  [/(^|\/)(pricing|plans)(\/|$)/, 9],
  [/(^|\/)(products?|platform|solutions?)(\/|$)/, 9],
  [/(^|\/)(about|company|story|mission)(\/|$)/, 8],
  [/(^|\/)(how-it-works|tour|use-cases?|why)(\/|$)/, 7],
  [/(^|\/)(shop|collections?)(\/|$)/, 6],
];
const SKIP =
  /(^|\/)(blog|news|press|careers|jobs|legal|privacy|terms|cookies?|login|log-in|signin|sign-in|signup|sign-up|register|account|cart|checkout|support|help|docs|status|changelog|community|events?|wp-|tag|category|author|feed|search)(\/|$)|\.(pdf|png|jpe?g|gif|svg|zip|xml|json|mp4|webp)$/i;

/** Pick the most informative internal pages to analyze next. */
export function prioritizeLinks(links: Array<{ url: string; text: string }>, rootUrl: URL, limit: number): string[] {
  const scored: Array<{ url: string; score: number }> = [];
  for (const l of links) {
    const u = new URL(l.url);
    const path = u.pathname.toLowerCase();
    if (path === "/" || path === rootUrl.pathname || SKIP.test(path)) continue;
    const depth = path.split("/").filter(Boolean).length;
    if (depth > 3) continue;
    let score = 0;
    for (const [re, s] of PRIORITY) if (re.test(path)) score = Math.max(score, s);
    if (/features?|pricing|product|about|how it works|platform|solutions?/i.test(l.text)) score += 2;
    if (score === 0) continue;
    score -= depth - 1;
    scored.push({ url: u.toString(), score });
  }
  scored.sort((a, b) => b.score - a.score);
  const out: string[] = [];
  const types = new Map<string, number>();
  for (const s of scored) {
    const t = classifyPage(new URL(s.url), false);
    // Diversity: at most 2 pages of the same type.
    if ((types.get(t) ?? 0) >= 2) continue;
    types.set(t, (types.get(t) ?? 0) + 1);
    out.push(s.url);
    if (out.length >= limit) break;
  }
  return out;
}
