import { z } from "zod";
import { CAMPAIGN_OBJECTIVES } from "@/lib/brand/schema";

/**
 * The "brief" a user gives up front: a website plus optional direction.
 * Starter ideas are one-tap shortcuts that fill the brief and set structured
 * preferences the creative director uses.
 */
export const StarterIdea = z.object({
  id: z.string(),
  label: z.string(),
  text: z.string(),
  objective: z.enum(CAMPAIGN_OBJECTIVES).optional(),
  aspectRatio: z.enum(["16:9", "9:16", "1:1", "4:5"]).optional(),
  targetDurationSec: z.number().int().optional(),
});
export type StarterIdea = z.infer<typeof StarterIdea>;

export const STARTER_IDEAS: StarterIdea[] = [
  { id: "launch", label: "Launch announcement", text: "Announce the launch and build excitement.", objective: "feature_launch" },
  { id: "trials", label: "Get more free-trial sign-ups", text: "Drive free-trial sign-ups.", objective: "free_trial" },
  { id: "demo", label: "Show the product in action", text: "Show the real product doing its best work." },
  { id: "vertical", label: "15s vertical for Reels & TikTok", text: "Short vertical cut for social.", aspectRatio: "9:16", targetDurationSec: 15 },
  { id: "manifesto", label: "Bold brand manifesto", text: "A bold, typographic piece about what the brand believes." },
  { id: "retarget", label: "Win back site visitors", text: "Remind people who visited why they should come back.", objective: "retargeting" },
];

export const Brief = z.object({
  url: z.string().min(1).max(2048),
  notes: z.string().max(600).default(""),
  ideas: z.array(z.string().max(32)).max(STARTER_IDEAS.length).default([]),
});
export type Brief = z.infer<typeof Brief>;

/** Turn a brief into creative preferences + objective for the project. */
export function briefToPreferences(brief: Brief): Record<string, unknown> {
  const picked = STARTER_IDEAS.filter((i) => brief.ideas.includes(i.id));
  const prefs: Record<string, unknown> = {};
  for (const idea of picked) {
    if (idea.aspectRatio) prefs.aspectRatio = idea.aspectRatio;
    if (idea.targetDurationSec) prefs.targetDurationSec = idea.targetDurationSec;
    if (idea.objective) prefs.objective = idea.objective;
  }
  const notes = [...picked.map((i) => i.text), brief.notes.trim()].filter(Boolean).join(" ");
  if (notes) prefs.notes = notes.slice(0, 1000);
  return prefs;
}

/**
 * Read format/length hints from a plain-language change request
 * ("make it a 15 second vertical") so they apply deterministically.
 */
export function preferencesFromInstruction(instruction: string): { aspectRatio?: "16:9" | "9:16" | "1:1" | "4:5"; targetDurationSec?: number } {
  const s = instruction.toLowerCase();
  const out: { aspectRatio?: "16:9" | "9:16" | "1:1" | "4:5"; targetDurationSec?: number } = {};
  if (/\b9\s*[:x/]\s*16\b|\bvertical\b|\breels?\b|\btiktok\b|\bstor(y|ies)\b|\bshorts\b/.test(s)) out.aspectRatio = "9:16";
  else if (/\b1\s*[:x/]\s*1\b|\bsquare\b/.test(s)) out.aspectRatio = "1:1";
  else if (/\b4\s*[:x/]\s*5\b|\bportrait\b/.test(s)) out.aspectRatio = "4:5";
  else if (/\b16\s*[:x/]\s*9\b|\blandscape\b|\bwidescreen\b|\byoutube\b/.test(s)) out.aspectRatio = "16:9";
  const sec = s.match(/\b(\d{1,2})\s*(?:-|\s)?(?:s|sec|secs|second|seconds)\b/);
  if (sec) {
    const n = Number(sec[1]);
    if (n >= 6 && n <= 60) out.targetDurationSec = n;
  }
  return out;
}
