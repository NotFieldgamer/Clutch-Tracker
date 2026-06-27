# PROGRESS.md

Running log of what&rsquo;s done, what&rsquo;s next, and known issues. Update after every step.

---

## Step 0 — Project shell ✅

**Done**
- Next.js 15 (App Router) + TypeScript scaffolded manually (precise control, no interactive generator).
- Tailwind CSS (v3) wired; DESIGN.md §2 tokens pasted into `app/globals.css` and surfaced as Tailwind
  utilities (`bg-ink`, `text-muted`, `font-display`, the heat scale, the agent signal) via `tailwind.config.ts`.
- Fonts via `next/font`: Geist Sans + Geist Mono (`geist` package) and Space Grotesk (`next/font/google`),
  exposed as CSS variables — no FOUT, no layout shift.
- `app/layout.tsx`: theme + `--ink` background, renders the `<AmbientBg />` placeholder.
- `app/page.tsx`: centered hero — &ldquo;Clutch&rdquo; in the display face + tagline.
- Dependencies installed: framer-motion, lucide-react, geist, @google/genai, prisma + @prisma/client.
- `prisma/schema.prisma`: minimal starting stub (Postgres datasource w/ `directUrl`, a `Task` model).
- `package.json`: `build = prisma generate && next build`, `postinstall = prisma generate`.
- Meta files: `.env.example`, `.gitignore`, `README.md`, this file.
- Verified `npm run dev` renders the hero with the correct fonts and deep-indigo background.

---

## Design foundation — reusable visual primitives ✅

**Done**
- `lib/motion.ts`: shared springs (entrance 300/30, layout 500/40), the ~700ms rescue ease,
  stagger / fadeUp / railItem variants, and a `useReduced()` hook returning reduced-motion-safe
  variants (opacity-only).
- `components/ui/AmbientBg.tsx`: two slow-drifting radial gradients (--agent / --calm at ~6%) over
  --ink + grain; drift pauses under `prefers-reduced-motion`. Now the real layout background.
- Primitives: `GlassPanel` (60% --surface glass, blur 20px, card/rail variants), `Button`
  (primary/ghost/subtle, hover y:-2 + agent glow, tap 0.98, --ring focus), `RiskMeter` (0..1 → heat
  scale, eases down on rescue), `ProgressRing` (animated stroke-dashoffset), `CountUp` (motion value,
  counts in on view).
- Type scale from DESIGN.md §3 as `.t-display-xl … .t-caption` classes in `app/globals.css`.
- `components/FoundationPreview.tsx`: temporary on-page gallery of every primitive, incl. a live
  "Run rescue" that eases risk → calm, fills the ring, and counts up reclaimed minutes.
- Verified in-browser (zero console errors, `tsc --noEmit` clean) — heat scale graduates correctly
  and the rescue de-escalation animates.

---

## Step 1 — data model + plain-language task capture ✅

**Done**
- `prisma/schema.prisma`: full models — `Task` + related `SubStep`, `Block`, `Artifact`, `ActionLog`
  (cascade deletes, indexes). Initial migration `20260625173243_init` created the tables on Supabase.
- `lib/db.ts`: singleton Prisma client (global-cached in dev). `lib/types.ts` (ParsedTask / TaskDTO /
  ScoredTask). `lib/riskScore.ts`: **placeholder** risk model (deadline × importance × % remaining)
  + plain-language `riskReason()` — replaced by the LOGIC_SNIPPETS version next.
- `app/api/parse` (nodejs): free text → Gemini structured output (responseSchema) → normalized →
  persisted via Prisma. **Model fail-over**: primary `gemini-3.5-flash`, falling back to
  `gemini-3-flash-preview` / `gemini-2.5-flash` on transient 503/429 (the pinned model is currently
  overloaded for this key). Friendly, in-voice errors for every failure path.
- `app/api/seed` (nodejs): "Load a sample week" — seeds a realistic, idempotent at-risk week.
- `components/AddTaskBar` (input + parse + seed, loading + error states), `TaskCard` (display title,
  RiskMeter + reason, live mono countdown, expand affordance via GlassPanel), `TaskList` (page-load
  stagger). Removed the temporary `FoundationPreview`.
- `app/page.tsx`: the Today / Rescue view — hero (animated at-risk count + Rescue **placeholder**),
  AddTaskBar, ranked task list (by deadline), empty state. Reads tasks server-side (`force-dynamic`).
- Verified end-to-end in-browser: seed + real Gemini parse (correct relative-date resolution), heat
  scale graduates, expand + Rescue interactions work, `tsc --noEmit` clean, zero console errors.

---

## Step 2 — agent loop + tools + the Activity rail ✅

**Done**
- Created the agent core **verbatim from LOGIC_SNIPPETS.md**: `lib/types.ts`, `lib/riskScore.ts`,
  `lib/systemPrompt.ts`, `lib/google/calendar.ts`, `lib/google/auth.ts`, `agent/tools.ts`,
  `agent/agentLoop.ts` (the perceive→plan→act→observe function-calling loop + 7 tool schemas).
- **Two SDK drift fixes** (verified vs @google/genai docs, the only deviations from verbatim):
  1. `FunctionCall.name` is optional → guarded `executeTool(call.name ?? "", …)`.
  2. **thought_signature**: current Gemini models reject history that drops the `thoughtSignature`
     on functionCall parts (400). Echo `res.candidates[0].content` back instead of a reconstructed
     part. This was the fix that made the multi-turn loop actually chain tools.
- `app/api/agent/route.ts` (nodejs, maxDuration 60): runs `runRescue`, **streams each ActionLogEntry
  as NDJSON** to the client, returns updated tasks + summary at the end. A resilient GoogleGenAI
  wrapper retries/fails over models on transient 503/429 without touching the verbatim loop; on a
  mid-loop failure it delivers the partial (in-place-mutated) tasks with an honest summary.
- `components/AgentActivityRail.tsx` — the signature element: mono ops log docked right (below on
  mobile), "● live" pulse while running, entries stream via AnimatePresence (violet tick, verb-first
  summary, mono timestamp), successes settle to --text with a brief --calm glow, failures flash --hot.
- `components/RescueBoard.tsx` — owns task + feed state; "Rescue my week" streams into the rail live
  and drops sub-steps / blocks / artifacts onto the cards on finish. `TaskCard` now renders them.
- Reconciled Step-1 code to the canonical `lib/types.ts` (TaskType set, `riskScore → {score,reason}`).
- Verified in-browser: a real rescue chained prioritize → decompose×2 → find_free_slots (recovered) →
  generate_artifact (outline + interview-prep) → draft_communication (ready-to-send email); the rail
  streamed live; cards filled with sub-steps + a drafted email. `tsc --noEmit` clean, zero console errors.

---

## Step 3 — real Google Calendar ✅

**Done**
- `app/layout.tsx` loads the GIS script (`accounts.google.com/gsi/client`, `next/script`
  afterInteractive). Verified loaded: `window.google.accounts.oauth2.initTokenClient` is present.
- `components/CalendarConnect.tsx` — premium header control with idle / connecting / connected /
  error states (calendar icon → "Connect Google Calendar"; green check + "Calendar connected").
- `RescueBoard` owns `calToken` / `calStatus` / `calError`; `connectCalendar()` runs
  `getCalendarToken(NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID)` (GIS readiness + missing-id guards, friendly
  errors in the agent's voice). Verified the click flips the control to "Connecting…" and opens the
  GIS consent popup with no console error.
- The token is passed to `/api/agent` as `calendarToken`, so the verbatim `find_free_slots` /
  `schedule_block` act on the real calendar. Plumbing verified: `findFreeSlots(<token>)` reaches the
  real Calendar v3 freeBusy API (dummy token → `freeBusy 401`, exactly as expected).
- `TaskCard` shows scheduled blocks with the event time (mono) and a --calm check when the block is a
  real Google Calendar event (`calendarEventId`).
- A new top header bar carries the brand (left) + the calendar control (right).

**Couldn't fully verify (needs you):** the live OAuth **consent** + real event creation requires a
signed-in Google account in a real browser — can't be automated headlessly. Test it on
`http://localhost:3000` (your account is a Test user) and on the deployed Vercel URL.

**Deploy / OAuth checklist for the Vercel URL**
- Add the Vercel origin (e.g. `https://clutch-xxx.vercel.app`) to the OAuth client's **Authorized
  JavaScript origins** (Google Cloud → Credentials) — popups are origin-sensitive.
- Set `NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID` in Vercel env. Then connect + run a rescue in incognito.

---

## Step 4 — artifacts UI + proactive scan + de-escalation + live re-ranking ✅

**Done**
- `components/ArtifactView.tsx`: renders each artifact (outline / draft / prep / email) inside the
  TaskCard with a **Copy** button and an **approve/undo** toggle; email shows Subject + Body distinctly.
- Proactive Risk Scan (`components/ProactiveScanBanner.tsx`): on load it briefly "scans" then surfaces
  the at-risk items unprompted — "N things may slip — want me to handle them?" with a one-click
  **Handle them** (runs the full rescue) and **Dismiss**.
- **Risk de-escalation (the payoff, §4.2)**: a task becoming rescued (gains steps/blocks/drafts) is the
  real state change — RescueBoard recomputes its effective risk to --calm, so the card's RiskMeter eases
  from its heat color toward --calm (~700ms `rescueEase`) and the card gains a calm glow.
- **Live re-ranking (§4.3)**: TaskList wraps cards in `LayoutGroup` with `layout="position"` (spring
  500/40); sorting by effective risk means a rescued task physically slides down to "handled" position.
  The hero count also de-escalates (e.g. 7 → 6) via CountUp.
- Verified in-browser (deterministically, since the LLM was 503-saturated): proactive banner scans →
  ready; a rescued card eases to --calm + glows + drops to the bottom + the count falls; the email
  ArtifactView shows Subject/Body with Copy and a working Approve↔Undo toggle. `tsc --noEmit` clean,
  zero console errors.

---

## Polish — portfolio pass ✅

**Done**
- **Page-load orchestration (§4.1):** `RescueBoard` is now a single `motion.main` stagger container;
  the banner → body grid → (main column, rail) reveal in sequence (header → list → rail) via nested
  `staggerContainer`/`fadeUp` variants. Containers never fade (no stuck-hidden), only leaves do.
- **Micro-interactions (§4.5):** `TaskCard` gets a small `whileHover {y:-2}` (its own snappy spring so
  it doesn't inherit the 700ms de-escalation ease); `Button` keeps its lift/tap. Both dropped under
  reduced motion. Added a shared `lift` helper to `lib/motion.ts`.
- **"Minutes reclaimed" stat (§4.6):** after a rescue settles, a `CountUp` shows the work the agent
  broke down + scheduled (real block minutes where present, else planned sub-step effort).
- **Reduced motion everywhere (§4):** gated the remaining JS animations — `Button`, `RiskMeter` (snaps
  instead of gliding), `TaskCard` hover + expand, `ProactiveScanBanner`, and `RescueBoard`'s alerts —
  on `useReducedMotion`. Ambient drift / CountUp / rail already paused. CSS media-query safety net kept.
- **Loading skeletons (§7):** the rail now shows "Reading your week…" + pulsing `Skeleton` lines while
  a rescue is running but no action has streamed yet (new `components/ui/Skeleton.tsx`). The streamed
  log is an `aria-live="polite"` `role="log"` region.
- **Audit (§8):** no horizontal overflow at 360px (verified); calendar control uses a shorter label
  `< sm`; primary buttons are ≥44px tall; semantic landmarks (`header` banner, `main`, labelled
  `section`s, `aside`); visible `--ring` focus (global). **AA contrast:** bumped `--faint`
  `#5C657C → #767F96` (~3.3:1 → ~4.8:1 on `--ink`) so small caption text clears AA — DESIGN §8's AA
  floor takes precedence over the literal token value.
- **Removed one animation that wasn't earning its place (§4 restraint):** dropped the per-line `layout`
  spring on each Activity-rail entry — it competed with the `AnimatePresence` x-stream and could jitter
  the whole log on each insert. Lines now stream in cleanly; the success/fail color flash stays.
- Verified in-browser at 1536px and 360px: clean reveal (nothing stuck hidden), zero console
  errors/warnings, `tsc --noEmit` clean.

---

## Step 5 — persistence + optional auth ✅

**Done**
- **Schema migration `persist_and_auth`:** added `SubStep.effortMin` (the minute estimate the UI +
  "minutes reclaimed" rely on, previously dropped) and `Task.userId` (+ index) for Clerk scoping.
- **Rescue persistence (`lib/persist.ts`):** after a rescue, `/api/agent` persists each rescued task's
  sub-steps / blocks / artifacts (replace-in-place) and appends the action-log via Prisma — on the
  success path (`result.actionLog`) **and** the partial path (mirrored `collected` log), so an
  interrupted rescue still saves what got done. Writes are scoped to the user's task ids
  (defense-in-depth) and each task persists in its own transaction.
- **Today view loads from the DB (`app/page.tsx`):** tasks now `include` their sub-steps (by order),
  blocks (by start), and artifacts — so rescue outputs survive a refresh and re-render with their
  de-escalated risk. Verified with a write→read round-trip (effortMin, block times, calendarEventId,
  email artifact, and the action-log row all survive).
- **Optional Clerk auth, behind a flag (`lib/auth.ts`):** `authEnabled()` is true only when **both**
  Clerk keys are set; otherwise the app runs the no-auth path (tasks global, `userId` null, no Clerk
  UI). `getUserId()` lazy-imports Clerk's server runtime; `taskScope()` scopes Task queries.
  - `middleware.ts`: `clerkMiddleware()` when on, a passthrough when off.
  - `app/layout.tsx`: wraps the tree in a DESIGN-themed `<ClerkProvider>` only when on.
  - `app/sign-in/[[...sign-in]]/page.tsx`: themed sign-in (the Clutch thesis + Clerk's `<SignIn/>`);
    `/` redirects signed-out users here. `components/AuthControls.tsx` adds the `<UserButton/>` to the
    header when configured.
  - `/api/parse`, `/api/seed`, `/api/agent` set/scope `userId` and 401 when signed out.
- **Verified both paths in-browser:** auth ON (keys present) → `/` 307 → themed `/sign-in` renders, zero
  errors (only Clerk's benign dev-keys notice); auth OFF (keys blank) → `/` 200, app serves with no
  Clerk. `tsc --noEmit` clean.

---

## Migration — durable rescue agent on the Vercel Workflow DevKit ✅ (flag-gated, on a branch)

Branch `feat/durable-agent-workflow`. Re-implements the agent loop on the **Vercel Workflow
DevKit** (`workflow` + `@workflow/ai` `DurableAgent`) + **AI SDK** (`ai` + `@ai-sdk/google`), so a
rescue survives the 60s serverless limit + mid-flight interruptions and persists each tool's output
as it goes. **Off by default** (`USE_DURABLE_AGENT=1` to enable) — the legacy inline loop stays the
fallback, so the demo is never at risk.

**New files**
- `agent/rescueWorkflow.ts` — the `"use workflow"`; a `DurableAgent` (instructions =
  `CLUTCH_SYSTEM_INSTRUCTION`, model via a `"use step"` so it's serializable) drives the 7 tools.
- `agent/steps.ts` — the 7 tools as `"use step"` functions: **DB-backed + scoped to `userId`**
  (IDOR guard) and **dedupe** (decompose replaces sub-steps; blocks dedupe by (task,start);
  artifacts replace by (task,kind)) → fixes the re-run accumulation issue. Sub-AI calls use
  `generateObject`/`generateText` (schema-validated — replaces the old `safeJson` hand-parsing).
- `lib/ai.ts` — `@ai-sdk/google` provider reusing the existing **server-side `GEMINI_API_KEY`**
  (no env rename, no AI Gateway).
- `lib/rail.ts` — streams the **same NDJSON the client already reads** to a `"rail"` namespace, so
  `components/AgentActivityRail.tsx` is untouched.
- `lib/messages.ts` (+ test) — pure `extractFinalText`. `vitest.config.ts`, `lib/riskScore.test.ts`,
  `lib/messages.test.ts` — first **automated tests** (`npm test`, 8/8 green).

**Changed**
- `next.config.ts` wrapped with `withWorkflow`. `middleware.ts` matcher now **excludes
  `.well-known/workflow`** (required — else Clerk intercepts the DevKit's internal `flow` POST and
  the agent silently fails). `app/api/agent/route.ts` branches on `USE_DURABLE_AGENT`: `start()` the
  workflow + stream its rail readable; legacy inline path otherwise. Pinned `@ai-sdk/google@^3`
  (v4 emits an incompatible `LanguageModelV4`; `ai@6`/`@workflow/ai` want v3).

**Verified**
- `next build` runs the workflow transform → "1 workflow, 17 steps", compiles clean; `tsc` clean;
  `npm test` 8/8.
- Runtime (dev, no-auth, flag on): the workflow **starts, streams the rail live** (real NDJSON:
  `prioritize`, `draft_communication`, …), **executes tools, and persists to the DB** (sub-steps
  survived) — and the route returns/closes cleanly (~28s) instead of hanging. The model-as-a-closure
  serialization blocker was found in the dev log and fixed (model is now a `"use step"`).

**Known issues / follow-ups**
- The terminal `{type:"done"}` summary line wasn't captured in the no-auth smoke (shared test DB was
  bloated/unscoped). The durability guarantee still holds — every tool output is persisted, so a
  refresh shows the work regardless. **Confirm in-browser** with normal (scoped) data.
- Streaming route on Vercel should set `supportsCancellation` (vercel.json) so a disconnected client
  doesn't bill to maxDuration. Model failover now relies on step retry (RetryableError) rather than
  the hand-rolled model chain; add AI-Gateway fallback later if desired.
- Local dev now needs the workflow runtime (`next dev` runs it via `withWorkflow`).

---

## Fix — auth redirect loop (signed-in client vs. signed-out server) ✅

**Symptom:** with Clerk on, after signing in the app was stuck on `/sign-in`; console showed
"`<SignIn/>` cannot render when a user is already signed in… redirecting to the afterSignIn URL".

**Root cause:** the signed-out gate lived in the **page server component** (`app/page.tsx` read `auth()`
then `redirect("/sign-in")`). On Clerk **dev** instances the session is resolved by a middleware
*handshake*; reading `auth()` in the page raced it, so `/` saw `userId = null` for a user the client
considered signed in. `/sign-in` (client: signed in → go `/`) and `/` (server: signed out → go
`/sign-in`) disagreed forever → infinite loop. The `matcher` also omitted Clerk's `/__clerk/(.*)`
handshake route.

**Fix (Clerk's documented pattern — gate in middleware, post-handshake):**
- `middleware.ts`: `clerkMiddleware()` now redirects signed-out users to `/sign-in` itself
  (`createRouteMatcher` keeps `/sign-in`, `/api`, `/trpc` public); added `/__clerk/(.*)` to the matcher.
- `app/page.tsx`: removed the racy `auth()`→`redirect` gate (middleware owns it); still reads `userId`
  for scoping.
- `app/sign-in/…/page.tsx`: server-side guard redirects an already-signed-in user home before
  `<SignIn/>` renders (kills the client "already signed in" flash).
- `.env.local`: added `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in` (+ sign-up + fallback redirects) so
  Clerk's flows stay on the themed page instead of the hosted Account Portal.
- **Verified:** fresh dev server (auth on, no cookie) → `GET /` 307 → `/sign-in` (exactly 1 hop, no
  loop), `/sign-in` 200, no "can't detect clerkMiddleware" errors, `tsc --noEmit` clean.
- **Requires a dev-server restart** to pick up the new `NEXT_PUBLIC_*` env + recompiled middleware.

---

## Fix batch — audit blockers + the two missing capabilities ✅ (on `feat/durable-agent-workflow`)

Driven by a multi-agent codebase audit (8 dimensions, adversarial verify per finding). This pass
closed the deploy/quality blockers and shipped the two data-layer capabilities the audit flagged as
missing.

**Done**
- **Timezone (blocker):** `findFreeSlots` now gates the 9–21 working-hours window in the user's IANA
  zone (`hourInTimeZone` via `Intl.DateTimeFormat`), and calendar events carry that `timeZone`. The
  zone is threaded client → `/api/agent` → both agent paths (inline + durable). No more UTC drift on
  Vercel.
- **Re-run dedupe (blocker):** the legacy inline tools now **replace** instead of `push` — blocks
  dedupe by start, artifacts/email/note by kind — so repeated rescues no longer stack duplicates
  (matches the durable path, which already deduped).
- **schedule_block guard:** verifies the task exists **before** creating a real calendar event, so a
  bad taskId can't leave an orphan event the app never records.
- **Client NDJSON drain:** the stream reader now flushes the decoder and processes a final newline-less
  line on EOF, so a trailing `{type:"done"}` frame is never dropped.
- **CTA contrast + input focus (a11y blockers):** new `--agent-cta` (#7C3AED, white label ~5.7:1 AA)
  for the primary button; the task input's GlassPanel gains a visible `focus-within` ring.
- **Build command (deploy blocker):** `build` is now `prisma generate && next build` (no DB at build
  time, so a bad `DIRECT_URL` can't brick the deploy). Migrations apply via a dedicated
  `npm run db:migrate:deploy`.
- **ESLint wired (quality blocker):** `npm run lint` was a no-op (no config, no packages). Added
  `eslint` + `eslint-config-next` + flat `eslint.config.mjs` (`next/core-web-vitals` + `next/typescript`),
  script is now `eslint .`; the verbatim agent core / GIS bindings relax `no-explicit-any` at their
  untyped SDK boundaries. **Exits 0 clean.**
- **Delete / clear UI (capability):** `DELETE /api/task/[id]` (scoped via `deleteMany` so it 404s on
  another user's id; relies on the schema's cascade). Per-card **Remove task** (two-click confirm) and
  a header **Clear week** (two-click confirm), both optimistic with rollback in `RescueBoard`.
- **Persist artifact approve/undo (capability):** new `Artifact.approved` column (migration
  `20260626143521_artifact_approved`, applied to Supabase) + `PATCH /api/artifact/[id]` (scoped through
  the parent task). `toggleApprove` is optimistic + rolls back on failure; `RescueBoard` seeds the
  approved set from the persisted flag, so the "Approved" badge survives a refresh.

**Verified:** `tsc --noEmit` clean · `npm test` 8/8 · `npm run lint` 0 errors · `next build` succeeds
(both new routes in the manifest, 9/9 pages).

### Re-audit follow-ups (defects the second audit caught — fixed same pass)

A second multi-agent audit of the patched code confirmed all 12 fixes above as **resolved** (0 of the
14 actionable findings refuted), but surfaced gaps — several in the just-shipped work — now closed:

- **RiskMeter color de-escalation (signature motion):** the fill set `backgroundColor` in BOTH
  `animate` and inline `style`; the inline style won, so on rescue the bar's heat **snapped** to green
  instead of easing over ~700ms (DESIGN.md §4.2's "visual payoff"). Removed the inline `style` — color
  now glides with the width (`components/ui/RiskMeter.tsx`).
- **Migrations on deploy:** moving migrate out of `build` left nothing applying it on Vercel. Added
  `vercel.json` with a build command that runs `prisma migrate deploy` **guarded** (`|| echo skip`), so
  migrations apply on each deploy but a transient DB issue degrades instead of bricking the build.
  README Deploy section corrected.
- **Approve flag wiped on re-rescue (default path):** `persistRescue` does delete+recreate of a task's
  artifacts and re-created them without `approved`, reverting approvals on a second rescue. Now carries
  `approved: Boolean(a.approved)` through (`lib/persist.ts`).
- **Touch targets + focus:** the new inline Copy/Approve, Remove, and Clear-week controls were below
  the 44px floor and dropped keyboard focus to `<body>` on the confirm toggle. Added `min-h-[44px]` and
  `autoFocus` on the (safe-default) Cancel button (`ArtifactView`, `TaskCard`, `RescueBoard`).
- **Stream cancellation:** `vercel.json` sets `supportsCancellation` on `app/api/agent/route.ts` so an
  abandoned durable-path rescue tears down instead of billing to `maxDuration`.
- **`decompose_task` → "0 steps" (default inline path):** the inline tools asked for `"Return ONLY
  JSON"` as free text and parsed it with a hand-rolled `safeJson`; when the model prose-wrapped the
  JSON, parsing failed → 0 sub-steps logged as **success**. Fixed by forcing schema-constrained output
  (`responseMimeType: "application/json"` + `responseSchema` with `Type`, same as `/api/parse`) on
  `decompose_task` and `draft_communication`, a more robust `safeJson` (extracts the JSON block from
  prose), and an honest `ok:false` log if zero steps ever come back. Verified live: the model returns
  5 parseable steps. (The durable path already used schema-validated `generateObject`.)
- **Cards didn't fill while the agent worked ("rail shows the work, card says 'not rescued yet'"):**
  the legacy path streamed `{type:"log"}` per tool (filling the rail) but sent task state only once, in
  the terminal `{type:"done"}` frame — so cards stayed at their pre-rescue empty state for the whole
  rescue, and never updated at all if the function was cut before `done`. This broke the core principle
  ("it does the work and shows me"). Fixed by streaming a `{type:"tasks"}` snapshot after **each** tool
  lands (`runRescue` gained an `onTask` callback; the route emits it; `RescueBoard` merges it) so the
  card fills + de-escalates **live**, plus a `router.refresh()` when the stream ends so a missed `done`
  frame still shows the persisted work.
- **Rescue work reset to empty after finishing (sub-steps never persisted):** diagnosed against the live
  DB — 0 `SubStep` rows ever, though `ActionLog` rows saved. Root cause: `persistRescue` wrote a task's
  sub-steps/blocks/artifacts in **one atomic `$transaction`**, and the artifact write threw on a **stale
  dev Prisma client** (cached on `globalThis` from before the `approved` migration; Next.js hot-reload
  never recreates it), rolling the sub-steps back too. Then `router.refresh()` read 0 steps and reset
  the cards. Fixes: (1) `persistRescue` now persists each kind in its **own** transaction (skipping empty
  kinds) so one table's failure can't sink the others — verified live: sub-steps persist independently;
  (2) `router.refresh()` only runs when the `done` frame was missed, so a complete rescue never gets
  overwritten by a slower/partial DB read. **Restart `npm run dev` once** to drop the stale client so
  artifacts persist too (production is unaffected — each deploy generates a fresh client).
- **Sub-steps are now checkable:** the decorative checkbox is a real `role="checkbox"` button (≥44px
  hit target) that toggles + persists `done` via a new scoped `PATCH /api/substep/[id]` (verified: owner
  toggles, another user → 404). Optimistic in `RescueBoard` with rollback; the check survives a refresh.

**Re-verified:** `tsc` clean · `npm test` 8/8 · `npm run lint` 0 · `next build` succeeds · live model
returns valid structured steps.

**Still open after this pass** (reported, not yet fixed — mostly pre-existing): bill capability (#3
hero) missing; `ProgressRing` built but unused; durable-path `{type:"done"}` lost past 60s (work still
persists — refresh shows it); h3-inside-button heading semantics; OAuth token persisted into the
durable store; zero tests on the agent loop/routes; the two agent paths have diverged (effort clamp,
step cap, action-log taskId); plus ~25 polish items (input length caps + prompt-injection hardening,
AbortController on the client fetch, htmlLink click-through, send/open action on emails, shared-helper
de-duplication). See the audit output for the full list.

---

**Known issues**
- Gemini flash models are intermittently 503 (high demand); the agent retries + fails over and delivers
  partial results with an honest summary if a rescue is interrupted mid-loop.
- Tasks created before the auth migration have `userId = null`, so they're invisible once auth is on
  (expected). Load a sample week while signed in to populate a user's view.
- Re-running a rescue regenerates artifacts with fresh ids, so a prior **Approved** badge naturally
  clears on re-rescue (the draft itself is new) — expected, not a bug.
- `.env.local` must be filled before any Gemini/Calendar/DB/Auth feature works. The Prisma CLI reads
  `.env` (not `.env.local`); keep the DB URLs in `.env` for `prisma migrate`/`generate`.
- Durable path still needs `vercel.json` `supportsCancellation` so a disconnected client doesn't bill
  to `maxDuration`; rate-limiting `/api/parse` + `/api/agent` and not persisting the OAuth token into
  the workflow store remain open (deferred — infra).
