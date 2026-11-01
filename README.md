# Framatic

AI-powered creative production studio: **website → brand analysis → three ad concepts → structured storyboard**.
This repository contains **Phase 1**. Video rendering (Phase 2) and product-demo capture (Phase 3) are not implemented yet, and the UI says so wherever they come up.

## User flow

1. **Landing page = an input box.** Paste a website, optionally add a note, and tap any starter ideas ("15s vertical for Reels & TikTok", "Get more free-trial sign-ups"…).
2. **Sign in.** The brief is kept in a short-lived httpOnly cookie, and the sign-up page shows it back to the user. Email confirmation links return to the same place.
3. **Autopilot.** `/start` creates the project and runs analysis then concept generation in one background job (`lib/jobs/autopilot.ts`). There's no review step; the user watches progress and lands on three concepts.
4. **Light editing.** On each concept: click any storyboard line to edit it, use **Ask for changes** ("make it punchier", "15 seconds, vertical"; format and length hints are applied exactly), or **Try a fresh take** (keeps your edits). Everything else (all fields, rewriting specific parts, format, motion details, history) sits under **More controls**. The **Brand** tab lets users fix the profile and hit **Update my ads**.

## What works today

| Area | Status |
| --- | --- |
| Email/password auth, sessions, protected routes | ✅ Supabase Auth + middleware |
| Projects: create, open, rename, delete, status | ✅ |
| Website analysis (homepage + up to 5 prioritized pages) | ✅ HTTP + Cheerio; optional Playwright for client-rendered sites |
| SSRF protection | ✅ scheme/port/host checks, DNS check of every address, connect-time IP check (blocks DNS rebinding), manual redirect validation, size and time limits, robots.txt |
| Extraction: titles, meta, OG, headings, text, CTAs, feature lists, logo, images, CSS colors, fonts, theme | ✅ |
| Brand profile with provenance (from site / AI interpretation / yours) and verified source evidence | ✅ AI-cited excerpts are checked against the crawled text; unverified features and CTAs are dropped |
| Editable brand profile (colors, type, logo upload, product, audience, features to emphasize, objective) | ✅ |
| AI creative director: Problem→Solution, Product in Motion, Brand Manifesto | ✅ |
| Versioned, Zod-validated scene plans (controlled vocabulary, renderer-ready) | ✅ |
| Concept workspace: edit copy, regenerate the whole concept or chosen fields (keeps your edits), retime/reorder scenes, preferences, preferred concept, version history and restore | ✅ |
| Storyboard frames | ✅ static sketches, labeled “Storyboard, not video” |
| Animated preview (Phase 2 start) | ✅ Remotion composition (`src/video/`) plays each scene plan in the browser: kinetic type, shapes, product mock-ups, callouts, stat counters, logo/CTA end cards and transitions. No sound or MP4 export yet. |
| Rate limits, background jobs, stale-job recovery, friendly errors, JSON logging | ✅ |
| MP4 export, music, screen recording | ⏳ Phase 2/3 — not implemented yet |

If no `ANTHROPIC_API_KEY` is set, analysis still runs but fills in **only content found verbatim on the site** and tells the user. Concept generation is unavailable until a key is set. Nothing is ever replaced with mock results.

## Architecture

```
src/
  app/                    Next.js App Router (landing, auth, (app)/dashboard, projects, settings)
    api/projects/[id]/analyze|concepts|status   background jobs (next/server `after`) + polling
    api/concepts/[id]/regenerate                synchronous single-concept regeneration
    actions/              server actions (auth, projects, brand, concepts, settings)
  lib/
    analyzer/             url-safety, safe-fetch, extract, colors, robots, crawl, browser (Playwright)
    brand/                schema (Zod), intelligence (LLM + evidence verification), merge (re-analysis)
    creative/             scene-plan (renderer contract), concept, director (LLM)
    ai/llm.ts             provider-agnostic structured generation (tool-use + Zod, bounded repair retries)
    jobs/                 analyze-project, concepts (generate / regenerate)
    db/repo.ts            data access, always scoped by user_id
    rate-limit.ts         sliding window on usage_events
  components/ui           design system (buttons, cards, fields, status, geometric shapes)
  components/app          product components (brand editor, concept workspace, storyboard…)
supabase/migrations       schema, RLS, triggers, storage bucket + policies
supabase/tests            RLS test suite (runs against plain Postgres with an auth stub)
tests/                    Vitest: analyzer, SSRF, brand intelligence, creative director, end-to-end workflow
```

The analyzer, brand intelligence, creative director and (future) renderer are separate modules connected only by Zod schemas. `ScenePlan` (`src/lib/creative/scene-plan.ts`) is the Phase 2 input: every visual element, animation, transition, background, icon and audio cue comes from a fixed vocabulary, so the renderer maps types to pre-built components and never runs AI-written code.

### Data model

`profiles`, `user_preferences`, `projects`, `brand_profiles` (reusable across projects), `analyzed_pages`, `assets`, `creative_concepts` (content, edited fields, preferences, preferred flag), `scene_plans` (one row per version), `usage_events`.
Every table has RLS restricted to `auth.uid()`. Triggers also stop child rows from pointing at another user's project or brand profile. Storage uploads are limited to the user's own folder.

## Setup

1. `npm install`
2. Create a Supabase project. In the SQL editor (or with `supabase db push`) run `supabase/migrations/20261101000000_init.sql`.
3. `cp .env.example .env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `ANTHROPIC_API_KEY` (and optionally `FRAMATIC_LLM_MODEL`)
   - `NEXT_PUBLIC_SITE_URL`
4. In Supabase → Authentication → URL configuration, add `<site-url>/auth/callback` as a redirect URL.
5. `npm run dev` and open http://localhost:3000.

Without Supabase configured, the landing page still works and protected pages show a setup notice.

### Deploying (Vercel recommended)

- Import the repo and set the same environment variables. Keep `SUPABASE_SERVICE_ROLE_KEY` and `ANTHROPIC_API_KEY` server-only (no `NEXT_PUBLIC_` prefix).
- Analysis and generation run after the response with `after()`, so the host must allow long function durations. The routes set `maxDuration = 300` (Vercel Pro or higher; on Hobby, lower it to 60 and expect occasional timeouts on large sites). Jobs that stop updating for 10 minutes are shown as failed with a retry button.
- `FRAMATIC_ENABLE_BROWSER=true` needs Playwright and Chromium on the server (a container host such as Fly.io or Render, not Vercel serverless).

## Tests

```bash
npm test          # 49 unit + workflow tests (no network, fake LLM, in-memory DB)
npm run test:db   # applies the migration to a throwaway Postgres and runs RLS tests (needs initdb/pg_ctl/psql, run as a non-root user)
npm run typecheck
npm run build
```

Covered: SSRF rejection (private ranges, metadata IP, IPv4-mapped IPv6, credentials, ports, DNS rebinding), extraction, color/font ranking, robots.txt, prioritized crawling, evidence verification (invented features and CTAs dropped), extraction-only fallback, three validated concepts, controlled-vocabulary enforcement, edit-preserving regeneration, re-analysis merge, failure states, rate limits, and cross-user isolation in Postgres.

`/dev/preview?view=dashboard|running|brand|concepts|concept` renders the signed-in screens with fictional sample data in development only (404 in production).

## Remotion license

The animated preview uses [Remotion](https://www.remotion.dev). It's free for individuals and companies with up to 3 employees; larger companies need a Remotion company license. `acknowledgeRemotionLicense` is set on the Player, so make sure your license status matches.

## Known limitations

- Not yet verified against a live Supabase project or the live Anthropic API. The workflow is tested with an in-memory database and a fake model, and RLS is tested on plain Postgres with a Supabase auth stub. Do one manual pass after adding keys.
- Live crawling of real websites wasn't exercised in the build environment (no outbound web access). The crawler is tested against a fixture site.
- Background jobs use `after()` rather than a durable queue. A crash mid-job is recovered by the stale-job timeout plus a retry, not resumed. Move to a queue (Inngest, Supabase Queues) before heavy use.
- Brand profiles reused across projects are shared: editing one updates every project that uses it.
- Logo uploads go to a public bucket (logos are public anyway). SVG uploads are allowed.
- Storyboard frames preview fonts only if they're installed on the viewer's device. Phase 2 will load brand webfonts.
