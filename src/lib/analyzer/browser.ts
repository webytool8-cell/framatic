import { assertSafeUrl } from "./url-safety";
import type { FetchResult } from "./safe-fetch";

/**
 * Optional Playwright rendering for client-rendered sites.
 * Enabled with FRAMATIC_ENABLE_BROWSER=true and requires `playwright` to be
 * installed with a Chromium binary on the server (not available on most
 * serverless platforms — see README).
 *
 * Every request the page makes is checked against the SSRF guard; images,
 * media and fonts are blocked to keep renders fast.
 */
export function browserRenderingEnabled(): boolean {
  return process.env.FRAMATIC_ENABLE_BROWSER === "true";
}

export async function renderWithBrowser(url: URL, timeoutMs = 20_000): Promise<FetchResult> {
  await assertSafeUrl(url);
  // Typed loosely so the app builds without Playwright installed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let playwright: any;
  try {
    const mod = "playwright";
    playwright = await import(/* webpackIgnore: true */ mod);
  } catch {
    throw new Error("Browser rendering is enabled but Playwright is not installed on this server.");
  }
  const browser = await playwright.chromium.launch({ args: ["--disable-dev-shm-usage"] });
  try {
    const context = await browser.newContext({ userAgent: "FramaticBot/1.0 (+https://framatic.app/bot)", javaScriptEnabled: true });
    const page = await context.newPage();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await page.route("**/*", async (route: any) => {
      const req = route.request();
      const type = req.resourceType();
      if (type === "image" || type === "media" || type === "font" || type === "websocket") return route.abort();
      try {
        await assertSafeUrl(new URL(req.url()));
        return route.continue();
      } catch {
        return route.abort("blockedbyclient");
      }
    });
    const response = await page.goto(url.toString(), { waitUntil: "networkidle", timeout: timeoutMs });
    const finalUrl = new URL(page.url());
    await assertSafeUrl(finalUrl);
    const body = (await page.content()).slice(0, 2_000_000);
    return {
      url: finalUrl.toString(),
      status: response?.status() ?? 200,
      contentType: "text/html",
      body,
      truncated: false,
    };
  } finally {
    await browser.close();
  }
}
