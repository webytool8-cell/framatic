import { lookup as dnsLookupCb, type LookupAddress } from "node:dns";
import { Agent, fetch as undiciFetch, type Response } from "undici";
import { assertSafeUrl, isPublicIp, UnsafeUrlError } from "./url-safety";

export interface FetchResult {
  /** Final URL after redirects. */
  url: string;
  status: number;
  contentType: string;
  body: string;
  truncated: boolean;
}

export interface FetchOptions {
  accept?: "html" | "css" | "text";
  maxBytes?: number;
  timeoutMs?: number;
}

export type Fetcher = (url: URL, opts?: FetchOptions) => Promise<FetchResult>;

export class FetchFailedError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "FetchFailedError";
  }
}

export const USER_AGENT = "FramaticBot/1.0 (+https://framatic.app/bot; brand analysis on behalf of the site owner)";
const MAX_REDIRECTS = 5;

/**
 * undici dispatcher whose DNS lookup refuses non-public addresses at connect
 * time — protects against DNS rebinding between validation and connection.
 */
const guardedAgent = new Agent({
  connect: {
    lookup(hostname, options, callback) {
      dnsLookupCb(hostname, { ...options, all: true, verbatim: true }, (err, addresses) => {
        if (err) return callback(err, "", 0);
        const list = (addresses as unknown as LookupAddress[]) ?? [];
        const unsafe = list.find((a) => !isPublicIp(a.address));
        if (unsafe || list.length === 0) {
          return callback(new UnsafeUrlError("Blocked connection to a non-public address."), "", 0);
        }
        if ((options as { all?: boolean }).all) {
          (callback as unknown as (e: null, a: LookupAddress[]) => void)(null, list);
        } else {
          callback(null, list[0].address, list[0].family);
        }
      });
    },
  },
  headersTimeout: 10_000,
  bodyTimeout: 10_000,
});

const ACCEPT: Record<NonNullable<FetchOptions["accept"]>, string> = {
  html: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
  css: "text/css,*/*;q=0.1",
  text: "text/plain,*/*;q=0.1",
};

/** Fetch a public URL with SSRF guards, manual redirect validation, timeouts and a size cap. */
export const safeFetch: Fetcher = async (input, opts = {}) => {
  const { accept = "html", maxBytes = 2_000_000, timeoutMs = 12_000 } = opts;
  let current = new URL(input.toString());
  const signal = AbortSignal.timeout(timeoutMs);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertSafeUrl(current);
    let res: Response;
    try {
      res = await undiciFetch(current, {
        redirect: "manual",
        signal,
        headers: { "user-agent": USER_AGENT, accept: ACCEPT[accept], "accept-language": "en;q=0.9,*;q=0.5" },
        dispatcher: guardedAgent,
      });
    } catch (err) {
      if (err instanceof UnsafeUrlError || (err as { cause?: unknown }).cause instanceof UnsafeUrlError) {
        throw new UnsafeUrlError("That website redirected to or resolved to a private address.");
      }
      if ((err as Error).name === "TimeoutError" || (err as Error).name === "AbortError") {
        throw new FetchFailedError("The website took too long to respond.");
      }
      throw new FetchFailedError("We couldn't connect to that website.");
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      await res.body?.cancel();
      if (!location) throw new FetchFailedError("The website sent a redirect without a destination.", res.status);
      current = new URL(location, current);
      current.hash = "";
      continue;
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!res.ok) {
      await res.body?.cancel();
      throw new FetchFailedError(`The website responded with HTTP ${res.status}.`, res.status);
    }
    if (accept === "html" && contentType && !/html|xml/i.test(contentType)) {
      await res.body?.cancel();
      throw new FetchFailedError("That URL isn't a web page.", res.status);
    }
    const declared = Number(res.headers.get("content-length") ?? "0");
    if (declared > maxBytes * 4) {
      await res.body?.cancel();
      throw new FetchFailedError("That page is too large to analyze.", res.status);
    }
    const { text, truncated } = await readCapped(res, maxBytes);
    return { url: current.toString(), status: res.status, contentType, body: text, truncated };
  }
  throw new FetchFailedError("The website redirected too many times.");
};

async function readCapped(res: Response, maxBytes: number): Promise<{ text: string; truncated: boolean }> {
  if (!res.body) return { text: "", truncated: false };
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (total + value.byteLength > maxBytes) {
      chunks.push(value.subarray(0, maxBytes - total));
      truncated = true;
      await reader.cancel();
      break;
    }
    chunks.push(value);
    total += value.byteLength;
  }
  const merged = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0));
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.byteLength;
  }
  return { text: new TextDecoder("utf-8", { fatal: false }).decode(merged), truncated };
}

export interface ImageResult {
  url: string;
  contentType: string;
  bytes: Uint8Array;
}

const IMAGE_TYPES = /^image\/(jpeg|png|webp)\b/i;

/**
 * Download a public image with the same SSRF guards as page fetches. Only
 * JPEG, PNG and WebP up to `maxBytes` are accepted; anything else throws.
 */
export async function safeFetchImage(input: URL, { maxBytes = 5_000_000, timeoutMs = 12_000 }: { maxBytes?: number; timeoutMs?: number } = {}): Promise<ImageResult> {
  let current = new URL(input.toString());
  const signal = AbortSignal.timeout(timeoutMs);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertSafeUrl(current);
    let res: Response;
    try {
      res = await undiciFetch(current, { redirect: "manual", signal, headers: { "user-agent": USER_AGENT, accept: "image/webp,image/png,image/jpeg;q=0.9,*/*;q=0.1" }, dispatcher: guardedAgent });
    } catch (err) {
      if (err instanceof UnsafeUrlError || (err as { cause?: unknown }).cause instanceof UnsafeUrlError) throw new UnsafeUrlError("That image is on a private address.");
      throw new FetchFailedError("Couldn't download that image.");
    }
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      await res.body?.cancel();
      if (!location) throw new FetchFailedError("Image redirect without a destination.", res.status);
      current = new URL(location, current);
      continue;
    }
    const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!res.ok || !IMAGE_TYPES.test(contentType)) {
      await res.body?.cancel();
      throw new FetchFailedError(`Not a usable image (HTTP ${res.status}, ${contentType || "unknown type"}).`, res.status);
    }
    if (Number(res.headers.get("content-length") ?? "0") > maxBytes) {
      await res.body?.cancel();
      throw new FetchFailedError("That image is too large.", res.status);
    }
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new FetchFailedError("That image is too large.", res.status);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let o = 0;
    for (const c of chunks) {
      bytes.set(c, o);
      o += c.byteLength;
    }
    return { url: current.toString(), contentType, bytes };
  }
  throw new FetchFailedError("The image redirected too many times.");
}
