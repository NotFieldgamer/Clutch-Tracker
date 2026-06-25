# CLAUDE.md — Clutch (personal project)

> Claude Code: read this fully every session — it's the source of truth. Pair it with **DESIGN.md**
> (the visual/motion system) and **BUILD_PROMPTS.md** (the build order). When a prompt conflicts with
> this file or DESIGN.md, ask before deviating.

---

## 1. What this is

**Clutch** is an **autonomous deadline-rescue agent** — a productivity app that doesn't nag you, it
*acts* for you: when something's about to slip, it plans the work, schedules it into your real
calendar, drafts the message, and writes the first draft — and shows every move it makes in real time.

**The one principle that governs every feature:**
> **It doesn't remind — it does the work and shows me.**

If a feature only notifies/tracks, redesign it so the agent *takes an action* (decompose, schedule,
draft, generate) — or cut it.

This is a personal portfolio-grade project. **Two things must both be true: it works, and it looks
premium.** Treat the UI/motion bar in DESIGN.md as non-negotiable, not a nice-to-have.

---

## 2. Stack (pinned — ask before swapping)

- **Framework:** Next.js 15 (App Router) + TypeScript.
- **Styling:** Tailwind CSS + CSS variables (design tokens live in `app/globals.css`, defined in DESIGN.md).
- **Motion:** Framer Motion (`motion`) — the primary animation tool. `lucide-react` for icons.
- **AI:** `@google/genai` SDK, model **`gemini-3.5-flash`** (swappable). Key stays **server-side** in
  an API route — never shipped to the client.
- **Calendar:** Google Calendar API v3 via Google Identity Services (client-side OAuth token).
- **Data:** **Prisma + PostgreSQL** (host on Render Postgres or Supabase). Persist tasks/sub-steps/
  blocks/artifacts/action-logs.
- **Auth (optional but recommended):** Clerk. Keep it behind a flag; the app must run without it for
  local dev.
- **Deploy:** **Vercel** for the Next.js app (primary). **Render** for the Postgres DB and an optional
  always-on cron worker (proactive scans). The app can also run wholly on Render if preferred.

---

## 3. Product spec — the 4 hero capabilities

1. **Autonomous Triage & Rescue Plan** — user types their week in plain language (or syncs Calendar);
   the agent returns a *ranked rescue plan* (risk = deadline × importance × % remaining), not a flat
   list, and says what it will *do* about each item.
2. **Calendar Surgery** — the agent reads the user's **real Google Calendar**, finds free slots, and
   **creates work-block events** for each rescued task.
3. **Do-the-Work Actions** — the agent produces real artifacts, not advice: essay/assignment → outline
   + first draft section; "ask for an extension" → ready-to-send email; bill → parsed amount/date +
   one-tap action; interview → tailored prep questions.
4. **Proactive Risk Scan** — on load, the agent runs **unprompted**: "3 things may slip — handle them?"

**Signature UI (mandatory):** the **Agent Activity rail** — a live, beautifully typeset operations log
that streams every tool the agent calls. This is the soul of the product *and* its best visual moment.
See DESIGN.md for how it should look and move.

---

## 4. Architecture

```
Browser (Next.js client)                Next.js server (route handlers on Vercel)
─────────────────────────               ──────────────────────────────────────────
- Today / Rescue view          ──►      /api/parse    free text → structured tasks (Gemini)
- Agent Activity rail (live)   ──►      /api/agent    runs the tool-loop (GEMINI_API_KEY server-side)
- Google Sign-In (GIS) ──┐                 │ executes tools, streams the action log back
  Calendar token         └── token ──►     ├─ calendar tools use the passed user token
- Prisma reads/writes via API           Prisma ↔ PostgreSQL (Render/Supabase)
```

- **Agent loop** lives in `/api/agent` (server). Pattern: `perceive → plan → act → observe → repeat`
  until the model returns a final answer. Every tool execution is logged and streamed to the rail.
- **Stream** the action log to the client (Server-Sent Events or a ReadableStream) so the rail fills in
  live rather than after a long wait.
- After a rescue, **persist** updated tasks/blocks/artifacts/logs via Prisma.

---

## 5. Agent core (reuse LOGIC_SNIPPETS.md)

The agent core is already written and is stack-agnostic. **Create these files verbatim from
`LOGIC_SNIPPETS.md`** (do not rewrite the loop, schemas, or risk scoring):
`lib/types.ts`, `lib/riskScore.ts`, `lib/systemPrompt.ts`, `lib/google/calendar.ts`,
`lib/google/auth.ts`, `agent/tools.ts`, `agent/agentLoop.ts`.

Tools the agent exposes: `prioritize`, `decompose_task`, `find_free_slots`, `schedule_block`,
`generate_artifact`, `draft_communication`, `set_smart_nudge`. For a real rescue it must **chain ≥3
tools** and **recover** when one fails (e.g. no free slot → re-plan). Verify `@google/genai`
function-calling + Calendar v3 syntax against current docs and fix any drift.

---

## 6. Design north star (full system in DESIGN.md)

Non-negotiables:
- **Distinctive, not templated.** Follow DESIGN.md's direction exactly. Avoid the generic AI looks
  (cream + serif + terracotta / near-black + acid accent / broadsheet hairlines).
- **Motion encodes meaning.** A task's "heat" eases from warm→cool as the agent rescues it; tasks
  physically re-order when re-ranked; the activity rail streams. Animation serves the subject, never
  decorates.
- **One signature, everything else quiet.** The Agent Activity rail + risk-heat is the bold moment;
  keep the rest disciplined.
- **Quality floor:** fully responsive to mobile, visible keyboard focus, and `prefers-reduced-motion`
  respected everywhere (swap big motion for simple fades).
- **Copy is design material:** active voice, name things by what the user controls, and make empty/
  loading/error states give direction (an empty screen invites action; errors say what to do next).

---

## 7. Target file structure

```
/app
  layout.tsx                 # fonts, theme, ambient background
  globals.css                # design tokens (from DESIGN.md)
  page.tsx                   # Today / Rescue view
  /api/parse/route.ts        # free text → tasks
  /api/agent/route.ts        # the agent tool-loop (streams the action log)
/components
  ui/                        # Button, Card, GlassPanel, RiskMeter, ProgressRing, CountUp, AmbientBg
  AgentActivityRail.tsx      # the live ops log (signature, mandatory)
  RescuePlan.tsx
  TaskCard.tsx
  AddTaskBar.tsx
  ArtifactView.tsx
/agent
  tools.ts  agentLoop.ts                       # from LOGIC_SNIPPETS.md
/lib
  types.ts  riskScore.ts  systemPrompt.ts      # from LOGIC_SNIPPETS.md
  google/calendar.ts  google/auth.ts           # from LOGIC_SNIPPETS.md
  db.ts                       # Prisma client
/prisma/schema.prisma
.env.local  .env.example  README.md  PROGRESS.md
```

**Core type** (`lib/types.ts`): `Task { id, title, deadlineISO, importance(1–5), percentDone, type,
subSteps[], blocks[], artifacts[] }`.

---

## 8. Coding standards & guardrails

- **Keep it running.** After each change, `npm run dev` must work. Never leave the build broken.
- **The Agent Activity rail is mandatory** and must update live (stream it).
- **Real states everywhere:** empty, loading (skeletons, not spinners-only), error, done — each with
  helpful, in-voice copy.
- **Secrets in env only:** `GEMINI_API_KEY` (server-side), `NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID`,
  `DATABASE_URL`, Clerk keys. Provide `.env.example`. Never commit `.env.local`.
- **Accessibility floor:** keyboard focus visible, semantic HTML, `prefers-reduced-motion` honored,
  color contrast AA.
- **Commits:** small, logical, descriptive. Update `PROGRESS.md` (done / next / known issues) each step.
- **Demo seed:** a "Load a sample week" action so the app is instantly usable.

---

## 9. Working agreement for Claude Code

- Build **incrementally** in the order of `BUILD_PROMPTS.md`. Don't scaffold everything at once.
- Build the **design system foundation early** (tokens, typography, base components) so every later
  screen inherits the premium look — don't bolt styling on at the end.
- After each step: run it, confirm acceptance criteria, commit, update `PROGRESS.md`.
- When SDK/API syntax is uncertain (Gemini function calling, Calendar v3, GIS), check the official docs
  rather than guessing; note the source in a comment.
- Ask before destructive changes (deleting files, rewriting working modules, swapping the stack).
- Prefer **simple, working, and beautiful** over clever and broken.
