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

**Next (Step 3 — Google Calendar)**
- Wire `lib/google/auth.ts` (GIS token) + a "Connect Google Calendar" button; pass the token into
  `/api/agent` so `find_free_slots` / `schedule_block` create real events.

**Known issues**
- Gemini flash models are intermittently 503 (high demand) right now; the agent retries + fails over,
  and delivers partial results with an honest summary if a rescue is interrupted mid-loop.
- Calendar tools fail by design until Step 3 (no token) — surfaced as recoverable --hot rail lines.
- Rescue outputs are held in client state, not yet persisted (they reset on refresh).
- No delete/clear UI yet — the dev DB holds the sample week plus a few parse-test tasks.
- `.env.local` must be filled before any Gemini/DB feature works.
