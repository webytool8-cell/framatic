import { collectColors, collectFonts, inferTheme, rankPalette, type BrandPalette } from "./colors";
import { extractPage, prioritizeLinks, sameSite, type ExtractedPage } from "./extract";
import { isAllowed, parseRobots, type RobotsRules } from "./robots";
import { FetchFailedError, safeFetch, type Fetcher, type FetchResult } from "./safe-fetch";
import { normalizeUserUrl, UnsafeUrlError } from "./url-safety";
import { browserRenderingEnabled, renderWithBrowser } from "./browser";
import { log } from "@/lib/log";

export interface CrawlOptions {
  maxPages?: number;
  maxStylesheets?: number;
  /** Overall budget for the crawl. */
  totalTimeoutMs?: number;
  fetcher?: Fetcher;
  render?: ((url: URL) => Promise<FetchResult>) | null;
}

export interface SiteAnalysis {
  rootUrl: string;
  pages: Array<ExtractedPage & { fetchedVia: "http" | "browser"; status: number }>;
  palette: BrandPalette;
  fonts: string[];
  theme: "light" | "dark" | "mixed";
  logo: { url: string; alt: string | null; source: string } | null;
  favicon: string | null;
  siteName: string | null;
  warnings: string[];
}

export class CrawlError extends Error {
  constructor(
    message: string,
    public readonly userMessage: string,
  ) {
    super(message);
    this.name = "CrawlError";
  }
}

/**
 * Analyze a small, prioritized set of public pages:
 * homepage → features / pricing / product / about / landing pages.
 * Never crawls the whole site.
 */
export async function crawlSite(inputUrl: string, opts: CrawlOptions = {}): Promise<SiteAnalysis> {
  const {
    maxPages = 6,
    maxStylesheets = 4,
    totalTimeoutMs = 60_000,
    fetcher = safeFetch,
    render = browserRenderingEnabled() ? (u: URL) => renderWithBrowser(u) : null,
  } = opts;
  const deadline = Date.now() + totalTimeoutMs;
  const warnings: string[] = [];

  let root: URL;
  try {
    root = normalizeUserUrl(inputUrl);
  } catch (e) {
    throw new CrawlError(String(e), (e as Error).message);
  }

  // Homepage (required)
  let home: FetchResult;
  try {
    home = await withRetry(() => fetcher(root, { accept: "html" }), 2);
  } catch (e) {
    const msg = e instanceof UnsafeUrlError || e instanceof FetchFailedError ? e.message : "We couldn't load that website.";
    throw new CrawlError(`homepage fetch failed: ${(e as Error).message}`, msg);
  }
  const finalRoot = new URL(home.url);
  if (!sameSite(finalRoot, root)) warnings.push(`The site redirected to ${finalRoot.hostname}; analyzing that instead.`);

  let homePage = extractPage(home.body, home.url, true);
  let homeVia: "http" | "browser" = "http";
  if (homePage.looksClientRendered) {
    if (render) {
      try {
        const rendered = await render(finalRoot);
        homePage = extractPage(rendered.body, rendered.url, true);
        homeVia = "browser";
      } catch (e) {
        log.warn("browser render failed", { url: finalRoot.toString(), error: (e as Error).message });
        warnings.push("This site renders mostly in the browser and full rendering wasn't available, so some content may be missing.");
      }
    } else {
      warnings.push("This site renders mostly in the browser; only server-delivered content was analyzed.");
    }
  }

  // robots.txt (best effort)
  let robots: RobotsRules = { allow: [], disallow: [] };
  try {
    const r = await fetcher(new URL("/robots.txt", finalRoot), { accept: "text", maxBytes: 200_000, timeoutMs: 5000 });
    robots = parseRobots(r.body);
  } catch {
    /* no robots.txt → allowed */
  }

  const pages: SiteAnalysis["pages"] = [{ ...homePage, fetchedVia: homeVia, status: home.status }];
  const candidates = prioritizeLinks(homePage.internalLinks, finalRoot, maxPages * 2).filter((u) => isAllowed(robots, new URL(u).pathname));

  const queue = [...candidates];
  const visited = new Set([home.url.replace(/\/$/, "")]);
  const worker = async () => {
    while (queue.length && pages.length < maxPages && Date.now() < deadline) {
      const next = queue.shift()!;
      const key = next.replace(/\/$/, "");
      if (visited.has(key)) continue;
      visited.add(key);
      try {
        const res = await fetcher(new URL(next), { accept: "html" });
        if (!sameSite(new URL(res.url), finalRoot)) continue;
        if (pages.length >= maxPages) break;
        pages.push({ ...extractPage(res.body, res.url, false), fetchedVia: "http", status: res.status });
      } catch (e) {
        log.info("subpage skipped", { url: next, error: (e as Error).message });
      }
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  if (Date.now() >= deadline) warnings.push("Analysis hit its time limit; fewer pages were analyzed.");

  // Stylesheets from the homepage (same-site or common CDNs only), size-capped.
  const cssChunks = pages.flatMap((p) => p.inlineCss);
  const sheetUrls = [...new Set(pages.flatMap((p) => p.stylesheetUrls))]
    .filter((u) => !u.includes("fonts.googleapis.com"))
    .slice(0, maxStylesheets);
  await Promise.all(
    sheetUrls.map(async (u) => {
      if (Date.now() >= deadline) return;
      try {
        const res = await fetcher(new URL(u), { accept: "css", maxBytes: 800_000, timeoutMs: 8000 });
        cssChunks.push(res.body);
      } catch {
        /* ignore individual stylesheet failures */
      }
    }),
  );

  const boosted = pages.map((p) => p.themeColor).filter((c): c is string => !!c);
  const palette = rankPalette(collectColors(cssChunks, boosted));
  const fonts = collectFonts(cssChunks, pages.flatMap((p) => p.googleFontFamilies));
  const theme = inferTheme(cssChunks);

  const logoCand = pages.flatMap((p) => p.logoCandidates.map((l) => ({ ...l, source: p.url }))).sort((a, b) => b.score - a.score)[0];
  const siteName = homePage.og["og:site_name"] ?? deriveSiteName(homePage.title);

  return {
    rootUrl: finalRoot.toString(),
    pages,
    palette,
    fonts: fonts.slice(0, 6),
    theme,
    logo: logoCand ? { url: logoCand.url, alt: logoCand.alt, source: logoCand.source } : null,
    favicon: homePage.favicon,
    siteName,
    warnings,
  };
}

function deriveSiteName(title: string | null): string | null {
  if (!title) return null;
  const parts = title.split(/\s[|\-–—:·]\s/).map((s) => s.trim()).filter(Boolean);
  if (parts.length > 1) return parts.sort((a, b) => a.length - b.length)[0];
  return title.length <= 40 ? title : null;
}

async function withRetry<T>(fn: () => Promise<T>, attempts: number): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      // Don't retry on definitive errors.
      if (e instanceof UnsafeUrlError) throw e;
      if (e instanceof FetchFailedError && e.status && e.status >= 400 && e.status < 500 && e.status !== 429) throw e;
      await new Promise((r) => setTimeout(r, 600 * (i + 1)));
    }
  }
  throw last;
}
