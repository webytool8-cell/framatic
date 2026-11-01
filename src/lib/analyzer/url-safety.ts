import ipaddr from "ipaddr.js";
import { lookup as dnsLookup } from "node:dns/promises";

/**
 * SSRF protection for every outbound request the analyzer makes.
 *
 * - Only http(s) on default ports.
 * - No credentials in URLs.
 * - Hostnames like localhost / *.internal / *.local are rejected outright.
 * - Every resolved IP must be public unicast (blocks private, loopback,
 *   link-local incl. 169.254.169.254 cloud metadata, CGNAT, multicast,
 *   reserved, IPv4-mapped IPv6 of any of those, etc).
 * - The same IP check runs again at socket-connect time (see safe-fetch.ts),
 *   which closes the DNS-rebinding gap between "check" and "fetch".
 */

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

const BLOCKED_HOST_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".intranet",
  ".lan",
  ".home",
  ".corp",
  ".localdomain",
  ".home.arpa",
];
const BLOCKED_HOSTS = new Set(["localhost", "metadata", "metadata.google.internal", "instance-data"]);

/** Parse user input into a normalized, fetchable URL (adds https:// if missing). */
export function normalizeUserUrl(input: string): URL {
  const trimmed = input.trim();
  if (!trimmed) throw new UnsafeUrlError("Enter a website URL.");
  if (trimmed.length > 2048) throw new UnsafeUrlError("That URL is too long.");
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new UnsafeUrlError("That doesn't look like a valid URL.");
  }
  assertSyntacticallySafe(url);
  url.hash = "";
  return url;
}

export function assertSyntacticallySafe(url: URL): void {
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new UnsafeUrlError("Only http and https websites can be analyzed.");
  }
  if (url.username || url.password) {
    throw new UnsafeUrlError("URLs containing credentials are not allowed.");
  }
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new UnsafeUrlError("Only standard web ports (80/443) are allowed.");
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host) throw new UnsafeUrlError("The URL is missing a hostname.");
  if (BLOCKED_HOSTS.has(host) || BLOCKED_HOST_SUFFIXES.some((s) => host.endsWith(s))) {
    throw new UnsafeUrlError("That address points to a private or internal network.");
  }
  const bare = host.replace(/^\[|\]$/g, "");
  if (ipaddr.isValid(bare)) {
    if (!isPublicIp(bare)) throw new UnsafeUrlError("That address points to a private or internal network.");
  } else {
    // Must look like a public DNS name: at least one dot and a TLD of letters.
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z][a-z0-9-]{1,62}$/i.test(host) && !/^xn--/.test(host.split(".").pop() ?? "")) {
      throw new UnsafeUrlError("That doesn't look like a public website address.");
    }
  }
}

export function isPublicIp(address: string): boolean {
  let parsed: ipaddr.IPv4 | ipaddr.IPv6;
  try {
    parsed = ipaddr.parse(address);
  } catch {
    return false;
  }
  if (parsed.kind() === "ipv6") {
    const v6 = parsed as ipaddr.IPv6;
    if (v6.isIPv4MappedAddress()) return isPublicIp(v6.toIPv4Address().toString());
    // NAT64 / 6to4 / Teredo can tunnel to arbitrary v4 targets — refuse.
    const range = v6.range();
    return range === "unicast";
  }
  const v4 = parsed as ipaddr.IPv4;
  if (v4.range() !== "unicast") return false;
  // Extra ranges ipaddr.js classifies as unicast but which are not internet-routable.
  const extra: Array<[string, number]> = [
    ["0.0.0.0", 8],
    ["100.64.0.0", 10],
    ["192.0.0.0", 24],
    ["198.18.0.0", 15],
  ];
  return !extra.some(([net, bits]) => v4.match(ipaddr.IPv4.parse(net), bits));
}

export type Resolver = (host: string) => Promise<Array<{ address: string; family: number }>>;

const defaultResolver: Resolver = (host) => dnsLookup(host, { all: true, verbatim: true });

/** Full check: syntax + DNS resolution, every address must be public. */
export async function assertSafeUrl(url: URL, resolve: Resolver = defaultResolver): Promise<void> {
  assertSyntacticallySafe(url);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (ipaddr.isValid(host)) return; // already checked syntactically
  let addresses: Array<{ address: string }>;
  try {
    addresses = await resolve(host);
  } catch {
    throw new UnsafeUrlError(`We couldn't find a website at ${url.hostname}. Check the address and try again.`);
  }
  if (addresses.length === 0) throw new UnsafeUrlError(`We couldn't find a website at ${url.hostname}.`);
  for (const { address } of addresses) {
    if (!isPublicIp(address)) throw new UnsafeUrlError("That address resolves to a private or internal network.");
  }
}
