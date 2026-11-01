import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Fetcher } from "@/lib/analyzer/safe-fetch";
import { FetchFailedError } from "@/lib/analyzer/safe-fetch";
import type { StructuredLLM, StructuredRequest } from "@/lib/ai/llm";

const dir = join(__dirname, "fixtures");
const read = (f: string) => readFileSync(join(dir, f), "utf8");

/** In-memory fake of https://tidyflow.example served from fixtures. */
export function fixtureFetcher(log: string[] = []): Fetcher {
  const routes: Record<string, { body: string; type: string }> = {
    "/": { body: read("home.html"), type: "text/html" },
    "/features": { body: read("features.html"), type: "text/html" },
    "/pricing": { body: read("pricing.html"), type: "text/html" },
    "/about": { body: read("about.html"), type: "text/html" },
    "/styles.css": { body: read("styles.css"), type: "text/css" },
    "/robots.txt": { body: "User-agent: *\nDisallow: /about\n", type: "text/plain" },
  };
  return async (url) => {
    log.push(url.pathname);
    const r = routes[url.pathname];
    if (!r) throw new FetchFailedError("The website responded with HTTP 404.", 404);
    return { url: url.toString(), status: 200, contentType: r.type, body: r.body, truncated: false };
  };
}

/** Fake LLM that returns canned objects per tool, and records prompts. */
export class FakeLLM implements StructuredLLM {
  readonly name = "fake";
  calls: Array<{ tool: string; prompt: string }> = [];
  constructor(private responders: Record<string, (req: StructuredRequest<unknown>, n: number) => unknown>) {}
  async generate<T>(req: StructuredRequest<T>): Promise<T> {
    const n = this.calls.filter((c) => c.tool === req.toolName).length;
    this.calls.push({ tool: req.toolName, prompt: req.prompt });
    const fn = this.responders[req.toolName];
    if (!fn) throw new Error(`no responder for ${req.toolName}`);
    return req.schema.parse(fn(req as StructuredRequest<unknown>, n));
  }
}

export const HOME = "https://tidyflow.example/";

export function aiBrandFixture() {
  return {
    productName: { value: "Tidyflow", evidence: [{ url: HOME, excerpt: "Tidyflow" }] },
    category: { value: "Customer support email automation", evidence: [] },
    targetAudience: { value: "Support teams at growing SaaS companies", evidence: [] },
    valueProposition: { value: "Inbox zero for support teams", evidence: [{ url: HOME, excerpt: "Inbox zero for support teams" }] },
    description: { value: "Routes, tags and drafts replies to customer emails.", evidence: [{ url: HOME, excerpt: "routes, tags and drafts replies to customer emails" }] },
    visualStyle: "Clean, white, green accents",
    tone: { value: "Friendly, practical", evidence: [] },
    problems: [{ value: "Hours lost sorting email by hand", evidence: [{ url: HOME, excerpt: "Support teams lose hours every day sorting and tagging email by hand." }] }],
    features: [
      { value: "Automatic routing by topic and urgency", evidence: [{ url: "https://tidyflow.example/features", excerpt: "Automatic routing by topic and urgency" }] },
      { value: "AI-drafted replies", evidence: [{ url: HOME, excerpt: "AI-drafted replies you approve in one click" }] },
      // Fabricated: not on the site → must be dropped.
      { value: "Voice call transcription", evidence: [{ url: HOME, excerpt: "Transcribes every voice call" }] },
      // No evidence → must be dropped.
      { value: "Slack integration", evidence: [] },
    ],
    benefits: [{ value: "Answer customers 3x faster", evidence: [{ url: HOME, excerpt: "Answer customers 3x faster" }] }],
    useCases: [],
    messages: [{ value: "Stop drowning in tickets", evidence: [{ url: HOME, excerpt: "Stop drowning in tickets" }] }],
    ctas: [
      { value: "Start free trial", evidence: [{ url: HOME, excerpt: "Start free trial" }] },
      { value: "Get a quote", evidence: [{ url: HOME, excerpt: "Get a quote" }] },
    ],
    conversionGoals: ["Free trial signups"],
    adAngles: ["The inbox that sorts itself"],
    suggestedObjective: "free_trial",
    missing: [],
  };
}

export function aiConceptFixture(title = "Inbox, sorted.") {
  const scene = (id: string, purpose: string, headline: string, extra: Record<string, unknown> = {}) => ({
    id,
    purpose,
    durationSec: 4.01,
    headline,
    supportingText: "",
    visualElements: [{ type: "kinetic_text", text: headline }],
    animation: { type: "word_stagger" },
    transition: { type: "wipe_left" },
    background: { type: "solid", color: "paper" },
    productFootage: { required: false },
    ...extra,
  });
  return {
    title,
    description: "A day in a messy inbox, then calm.",
    targetAudience: "Support leads",
    campaignObjective: "free_trial",
    rationale: "Support leads feel the pain daily.",
    headline: "Inbox zero, every day",
    supportingCopy: "Tidyflow routes and drafts so your team just answers.",
    cta: "Start free trial",
    visualDirection: "White canvas, green geometric sweeps",
    typographyDirection: "Sora bold, tight tracking",
    musicMood: "Upbeat lo-fi",
    pacing: "punchy",
    estimatedDurationSec: 20,
    requiredAssets: [{ type: "logo", description: "Tidyflow logo" }],
    scenePlan: {
      schemaVersion: 1,
      durationSec: 18, // wrong on purpose — normalization must fix it
      palette: { primary: "#000000", secondary: "#000000", accent: "#000000", ink: "#000000", paper: "#000000" },
      fonts: { heading: "x", body: "y" },
      music: { mood: "upbeat", bpm: 112 },
      scenes: [
        scene("hook", "hook", "200 unread."),
        scene("hook", "problem", "Sorting by hand?"),
        scene("reveal", "reveal", "Meet Tidyflow", { brandAssets: ["logo"] }),
        scene("end", "cta", "Start free trial", { visualElements: [{ type: "cta_end_card", text: "Start free trial" }] }),
      ],
    },
  };
}
