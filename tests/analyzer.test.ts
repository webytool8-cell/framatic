import { describe, expect, it } from "vitest";
import { assertSafeUrl, isPublicIp, normalizeUserUrl, UnsafeUrlError } from "@/lib/analyzer/url-safety";
import { safeFetch } from "@/lib/analyzer/safe-fetch";
import { extractPage, prioritizeLinks } from "@/lib/analyzer/extract";
import { collectColors, collectFonts, parseColor, rankPalette, inferTheme } from "@/lib/analyzer/colors";
import { isAllowed, parseRobots } from "@/lib/analyzer/robots";
import { crawlSite, CrawlError } from "@/lib/analyzer/crawl";
import { fixtureFetcher, HOME } from "./helpers";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("URL safety (SSRF)", () => {
  it("normalizes bare domains to https", () => {
    expect(normalizeUserUrl("stripe.com").toString()).toBe("https://stripe.com/");
    expect(normalizeUserUrl(" https://Example.org/a#x ").toString()).toBe("https://example.org/a");
  });

  it.each([
    "http://localhost:3000",
    "http://127.0.0.1",
    "http://10.0.0.5",
    "http://192.168.1.1",
    "http://172.16.0.1",
    "http://169.254.169.254/latest/meta-data",
    "http://[::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://100.64.0.1",
    "http://0.0.0.0",
    "http://metadata.google.internal",
    "http://printer.local",
    "ftp://example.com",
    "file:///etc/passwd",
    "http://user:pass@example.com",
    "http://example.com:8080",
    "http://intranet",
  ])("rejects %s", (u) => {
    expect(() => normalizeUserUrl(u)).toThrow(UnsafeUrlError);
  });

  it("classifies IPs", () => {
    expect(isPublicIp("8.8.8.8")).toBe(true);
    expect(isPublicIp("2606:4700:4700::1111")).toBe(true);
    expect(isPublicIp("10.1.2.3")).toBe(false);
    expect(isPublicIp("fd00::1")).toBe(false);
    expect(isPublicIp("fe80::1")).toBe(false);
  });

  it("rejects public hostnames that resolve to private IPs (DNS rebinding)", async () => {
    const evilResolver = async () => [{ address: "127.0.0.1", family: 4 }];
    await expect(assertSafeUrl(new URL("https://evil.example.com"), evilResolver)).rejects.toThrow(UnsafeUrlError);
    const mixed = async () => [{ address: "93.184.216.34", family: 4 }, { address: "10.0.0.1", family: 4 }];
    await expect(assertSafeUrl(new URL("https://mixed.example.com"), mixed)).rejects.toThrow(UnsafeUrlError);
    const ok = async () => [{ address: "93.184.216.34", family: 4 }];
    await expect(assertSafeUrl(new URL("https://fine.example.com"), ok)).resolves.toBeUndefined();
  });

  it("safeFetch refuses private targets before any network I/O", async () => {
    await expect(safeFetch(new URL("http://169.254.169.254/"))).rejects.toThrow(UnsafeUrlError);
    await expect(safeFetch(new URL("http://127.0.0.1/"))).rejects.toThrow(UnsafeUrlError);
  });
});

describe("HTML extraction", () => {
  const html = readFileSync(join(__dirname, "fixtures/home.html"), "utf8");
  const page = extractPage(html, HOME, true);

  it("extracts metadata, headings, CTAs and lists", () => {
    expect(page.pageType).toBe("home");
    expect(page.title).toContain("Tidyflow");
    expect(page.description).toMatch(/routes, tags and drafts/);
    expect(page.og["og:site_name"]).toBe("Tidyflow");
    expect(page.headings[0]).toBe("Inbox zero for support teams");
    expect(page.ctas).toEqual(expect.arrayContaining(["Start free trial", "Book a demo"]));
    expect(page.featureLists[0]).toContain("Works with Gmail and Outlook");
    expect(page.themeColor).toBe("#14B88A");
    expect(page.googleFontFamilies).toEqual(["Sora", "Inter"]);
  });

  it("finds the logo and excludes nav/footer from body text", () => {
    expect(page.logoCandidates[0].url).toBe("https://tidyflow.example/img/tidyflow-logo.svg");
    expect(page.text).not.toContain("Privacy");
    expect(page.text).toContain("Support teams lose hours");
  });

  it("prioritizes informative internal pages and skips noise", () => {
    const links = prioritizeLinks(page.internalLinks, new URL(HOME), 5);
    expect(links).toEqual(expect.arrayContaining(["https://tidyflow.example/features", "https://tidyflow.example/pricing"]));
    expect(links.some((l) => /blog|login|privacy|twitter/.test(l))).toBe(false);
    expect(links[0]).toBe("https://tidyflow.example/features");
  });
});

describe("colors, fonts, robots", () => {
  it("parses color formats", () => {
    expect(parseColor("#abc")).toEqual({ r: 170, g: 187, b: 204 });
    expect(parseColor("rgb(20, 184, 138)")).toEqual({ r: 20, g: 184, b: 138 });
    expect(parseColor("rgba(0,0,0,0.1)")).toBeNull();
    expect(parseColor("hsl(0, 100%, 50%)")).toMatchObject({ r: 255, g: 0, b: 0 });
  });

  it("ranks brand colors above neutrals and merges near-duplicates", () => {
    const css = ".a{color:#14B88A}.b{color:#15b98b}.c{background:#fff}.d{color:#111}:root{--brand:#FF7A1A}";
    const p = rankPalette(collectColors([css], []));
    expect(p.primary).toBe("#FF7A1A"); // custom property named brand weighs most
    expect(p.secondary).toContain("#14B88A");
    expect(p.neutrals.length).toBeGreaterThan(0);
  });

  it("detects fonts, ignoring generic stacks and Next.js hashed names", () => {
    const fonts = collectFonts(['body{font-family:-apple-system,"Segoe UI",sans-serif} h1{font-family:"__Sora_ab12cd", "__Sora_Fallback_ab12cd"}'], ["Inter"]);
    expect(fonts).toEqual(["Inter", "Sora"]);
  });

  it("infers dark themes", () => {
    expect(inferTheme(["body{background:#0b0b0f}"])).toBe("dark");
    expect(inferTheme(["body{background-color:#fff}"])).toBe("light");
  });

  it("honors robots.txt", () => {
    const r = parseRobots("User-agent: *\nDisallow: /private\nAllow: /private/ok\n\nUser-agent: Googlebot\nDisallow: /");
    expect(isAllowed(r, "/private/x")).toBe(false);
    expect(isAllowed(r, "/private/ok")).toBe(true);
    expect(isAllowed(r, "/features")).toBe(true);
  });
});

describe("crawlSite", () => {
  it("analyzes a limited, prioritized set of pages", async () => {
    const hits: string[] = [];
    const site = await crawlSite("tidyflow.example", { fetcher: fixtureFetcher(hits), render: null, maxPages: 4 });
    const paths = site.pages.map((p) => new URL(p.url).pathname);
    expect(paths[0]).toBe("/");
    expect(paths).toEqual(expect.arrayContaining(["/features", "/pricing"]));
    expect(paths).not.toContain("/about"); // disallowed by robots.txt
    expect(hits).not.toContain("/blog");
    expect(site.palette.primary).toBe("#14B88A");
    expect(site.palette.secondary).toContain("#FF7A1A");
    expect(site.fonts[0]).toBe("Sora");
    expect(site.logo?.url).toContain("tidyflow-logo.svg");
    expect(site.siteName).toBe("Tidyflow");
    expect(site.theme).toBe("light");
  });

  it("explains failures in user-friendly terms", async () => {
    await expect(crawlSite("http://localhost:3000")).rejects.toThrow(CrawlError);
    const failing = async () => {
      throw new Error("ECONNREFUSED");
    };
    await expect(crawlSite("https://down.example", { fetcher: failing, render: null })).rejects.toMatchObject({
      userMessage: expect.stringContaining("couldn't"),
    });
  });
});
