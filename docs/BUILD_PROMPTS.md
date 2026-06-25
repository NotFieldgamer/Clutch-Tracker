# BUILD_PROMPTS.md — Clutch, step-by-step (paste into Claude Code in order)

> Pair this with `CLAUDE.md` in your repo root. Each step is a self-contained prompt.
> Let Claude Code finish a step + commit before pasting the next. Fill `.env.local` as you create keys.

---

## How to use this kit
1. Put **`CLAUDE.md`** in the repo root, open **Claude Code** in that folder.
2. Do the **Pre-flight Google setup** once (you, in the Google consoles — ~20 min).
3. Paste **Step 0 → Step 8** in order. After each, run it, confirm the ✅ criteria, commit.
4. Steps marked *(optional)* are level-ups — do them only if time allows before 29 Jun 2 PM.

---

## Pre-flight — Google tools setup (do this yourself, once)

You need keys/IDs before Claude Code can wire anything. Results go into `.env.local`.

**A. Gemini API key (Google AI Studio)**
- Go to `aistudio.google.com/apikey` → **Create API key** (free tier is fine).
- → `GEMINI_API_KEY`

**B. Firebase (Auth + Firestore)**
- `console.firebase.google.com` → **Add project** (reuse the same GCP project as below if possible).
- **Build → Authentication → Get started → enable Google** sign-in provider.
- **Build → Firestore Database → Create** (start in test mode; you'll tighten rules later).
- **Project settings → Your apps → Web app** → copy the config → the `NEXT_PUBLIC_FIREBASE_*` vars.

**C. Google Cloud project + Calendar API + OAuth client**
- `console.cloud.google.com` → create/select a project (same one as Firebase is cleanest).
- **APIs & Services → Library → enable "Google Calendar API".**
- **APIs & Services → OAuth consent screen** → External → fill app name/email → **add scope**
  `https://www.googleapis.com/auth/calendar.events` → **add your own Google account as a Test user**
  (Testing mode needs no verification for the hackathon).
- **APIs & Services → Credentials → Create credentials → OAuth client ID → Web application** →
  Authorized JavaScript origins: `http://localhost:3000` **and** (after Step 0) your Cloud Run URL.
  → `NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID`

**D. gcloud + Cloud Run (deploy target — mandatory)**
- Install the **gcloud CLI** → `gcloud auth login` → `gcloud config set project YOUR_PROJECT_ID`.
- **Enable billing** on the project (Cloud Run requires it; the **free tier ≈ $0** for a hackathon —
  ~2M requests/month free). Enable **Cloud Run** + **Cloud Build** APIs.
- Pick a region close to you: **`asia-south1` (Mumbai)**.

> Note: AI Studio's "Starter Tier" (no-billing Cloud Run) only applies to apps *built inside AI Studio
> Build Mode*, not a custom Next.js repo. For this Claude Code build you'll deploy via `gcloud` with
> billing enabled (still free-tier in practice).

**`.env.local` template** (create this file; never commit it):
```
GEMINI_API_KEY=
NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID=
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

---

## Step 0 — Initialize the project + deploy an empty shell to Cloud Run

> Deploy on Day 1. Never leave deployment for the end.

```
Read CLAUDE.md fully. Initialize the project per the pinned stack and target file structure:

- Next.js 15 (App Router) + TypeScript, Tailwind CSS, Framer Motion.
- Set next.config to output: 'standalone'.
- Create a clean Today/Rescue landing page (app/page.tsx) that shows the product name "Clutch",
  a one-line tagline, and a placeholder for the Agent Activity Feed.
- Add a production Dockerfile for a standalone Next.js app (node:20-slim, multi-stage, runs on $PORT).
- Add .env.example mirroring the variables in BUILD_PROMPTS.md, and .gitignore (.env.local, node_modules, .next).
- Create PROGRESS.md and README.md stubs.
- Initialize git with a sensible first commit.

Then give me the exact `gcloud run deploy` command to deploy this shell to Cloud Run in region
asia-south1, allowing unauthenticated access. Confirm the build runs locally with `npm run dev` first.
```
✅ **Done when:** `npm run dev` shows the Clutch landing page locally, and `gcloud run deploy` returns a live public URL. Add that URL to the OAuth client's authorized origins (Pre-flight C).

---

## Step 1 — Data model + plain-language task capture

```
Per CLAUDE.md (types in lib/types.ts):

1. Define the Task type and supporting types (SubStep, Block, Artifact, ActionLogEntry) in lib/types.ts.
2. Build AddTaskBar.tsx: a single input where the user types their week in plain language, e.g.
   "Assignment due Friday, electricity bill on the 27th, interview prep, buy mom a gift".
3. Create a server route /api/parse that calls Gemini (gemini-3.5-flash via @google/genai) with a
   structured-output prompt to turn that free text into an array of Task objects (title, deadline as
   ISO, importance 1–5, percentDone, type). Keep GEMINI_API_KEY server-side only.
4. Render parsed tasks as TaskCard components in the Today view, sorted by deadline.

Hold tasks in React state for now (Firestore comes in Step 5). Handle parse errors gracefully with a
visible message. Keep it running, commit, update PROGRESS.md.
```
✅ **Done when:** typing a messy sentence produces clean, structured task cards.

---

## Step 2 — The agent loop + core tools + Activity Feed (the heart)

```
Per CLAUDE.md §5–§6, build the agentic core. This is the highest-value step (Agentic Depth = 20%).

1. lib/agent/tools.ts: declare these as Gemini function declarations AND implement executors:
   prioritize, decompose_task, set_smart_nudge, generate_artifact, summarize_actions.
   (Calendar tools come in Step 3 — stub find_free_slots/schedule_block for now.)
2. lib/agent/loop.ts: implement the perceive→plan→act→observe loop with function calling:
   send the user goal + current tasks + tools to gemini-3.5-flash; while the model returns
   functionCalls, execute each, append the result back into the conversation, and record every call
   into an actionLog array. Stop when the model returns final text.
   Verify the exact function-calling syntax against https://ai.google.dev/gemini-api/docs/function-calling.
3. /api/agent/route.ts: accepts {goal, tasks}, runs the loop, returns {finalText, updatedTasks, actionLog}.
4. AgentActivityFeed.tsx: render actionLog live and prominently — one line per tool call
   ("Decomposed 'Assignment' → 4 steps", "Scheduled 'Draft intro' Wed 6 PM"). Stream if feasible.
5. Wire a "Rescue my week" button that triggers the agent on the current tasks and shows the ranked
   rescue plan + the activity feed.

Make the system instruction enforce "do, don't remind" and chaining ≥3 tools per rescue.
Keep it running, commit, update PROGRESS.md.
```
✅ **Done when:** clicking "Rescue my week" makes the agent chain multiple tools and the Activity Feed shows each action live.

---

## Step 3 — Google Calendar integration (real reads + writes)

```
Per CLAUDE.md, wire real Google Calendar (this is your most demoable "it acted" moment + Google-tech credit).

1. lib/google/auth.ts: client-side Google Identity Services. Use initTokenClient with the
   NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID and scope https://www.googleapis.com/auth/calendar.events to get
   an access token after the user clicks "Connect Google Calendar".
2. lib/google/calendar.ts: functions to (a) list busy windows via Calendar API v3 (events.list with
   timeMin/timeMax/singleEvents/orderBy, or a freebusy query) and (b) create an event (events.insert).
   These take the user's access token.
3. Replace the stubs: implement find_free_slots(durationMin, byDate) (computes gaps from busy windows)
   and schedule_block(taskId, startISO, endISO, title) (creates a real Calendar event).
4. Pass the user's access token from the client into /api/agent so the agent's calendar tools can act.
   Keep GEMINI_API_KEY server-side; only the user's OAuth token crosses for calendar calls.

Handle: not connected, no free slots, API errors — all with visible, friendly messages.
Verify Calendar API v3 + GIS syntax against current Google docs. Keep it running, commit, update PROGRESS.md.
```
✅ **Done when:** after connecting Calendar, a rescue actually creates work-block events visible in the user's real Google Calendar, logged in the Activity Feed.

---

## Step 4 — Do-the-work artifacts + extension email + proactive scan

```
Per CLAUDE.md hero capabilities 3 & 4:

1. Flesh out generate_artifact(taskType, context) so the agent produces REAL outputs:
   - essay/assignment → outline + a first draft section
   - interview → 5 tailored prep questions
   - bill/payment → parsed amount + due date + a one-tap "mark paid" action
   Render artifacts inside the relevant TaskCard with approve/undo.
2. Implement draft_communication(kind, context) → a ready-to-send extension/reschedule email draft,
   shown with a copy button.
3. Proactive Risk Scan: on app load, automatically run the agent in "scan" mode that surfaces the
   top at-risk items and proposes actions WITHOUT the user asking ("3 things may slip — handle them?").
   One click runs the full rescue.

Keep everything in the Activity Feed. Keep it running, commit, update PROGRESS.md.
```
✅ **Done when:** the agent generates a usable draft/outline/prep set per task, and an unprompted scan greets the user on load.

---

## Step 5 — Firebase Auth + Firestore persistence

```
Per CLAUDE.md:

1. lib/firebase.ts: init Firebase from NEXT_PUBLIC_FIREBASE_* env vars.
2. Add Firebase Auth with Google sign-in; gate the app behind sign-in (lightweight).
3. Persist tasks, sub-steps, blocks, artifacts, and action logs to Firestore per user; load on start.
4. Add tight Firestore security rules so a user can only read/write their own data.

Keep it running, commit, update PROGRESS.md.
```
✅ **Done when:** tasks survive refresh, are scoped per signed-in user, and rules block cross-user access.

---

## Step 6 — UI polish, states, motion, demo seed

```
Per CLAUDE.md (Product Experience = 10%). One polished primary flow beats many half-styled screens.

1. Refine the Today/Rescue view into a calm "command center": clear hierarchy, generous spacing,
   tasteful glassmorphism, Framer Motion transitions on cards and the Activity Feed.
2. Implement clean empty / loading / error / done states everywhere.
3. Make it fully responsive (test mobile widths).
4. Add a "Load demo week" button that seeds a realistic at-risk week so a judge gets instant value.

Don't regress functionality. Keep it running, commit, update PROGRESS.md.
```
✅ **Done when:** a stranger can open the app and immediately understand and use it, on desktop and mobile.

---

## Step 7 — Harden: errors, secrets, README, architecture

```
Per CLAUDE.md (Technical Implementation = 10%):

1. Audit for unhandled errors across the agent loop, calendar, parse, and auth; add guards.
2. Confirm NO secrets are committed; ensure .env.example is complete; document required env vars.
3. Write a real README: what it is, the rubric-relevant features, architecture (include a simple
   ASCII or Mermaid diagram of the agent loop + tools), local setup, env vars, and the deployed URL.
4. List the agent's tools and the perceive→plan→act loop in the README (shows agentic depth to reviewers).

Commit, update PROGRESS.md.
```
✅ **Done when:** the repo is clean, documented, secret-free, with an architecture diagram.

---

## Step 8 — Final deploy to Cloud Run + smoke test

```
Per CLAUDE.md (deployment is mandatory on Google Cloud):

1. Confirm next.config output:'standalone' and the Dockerfile build a working production image.
2. Give me the exact `gcloud run deploy clutch --source . --region asia-south1 --allow-unauthenticated`
   command, and show how to pass env vars — prefer Google Secret Manager for GEMINI_API_KEY, with
   NEXT_PUBLIC_* values set at build/deploy time.
3. Remind me to add the final Cloud Run URL to the OAuth client's authorized JavaScript origins, and
   to add the Cloud Run domain to Firebase Auth authorized domains.
4. Give me a 6-point smoke-test checklist to run against the live URL in incognito and on mobile
   (sign in, load demo week, connect calendar, run a rescue, see real events created, see the feed).
```
✅ **Done when:** the full happy path works on the live Cloud Run URL in incognito + on your phone.

---

## *(Optional)* Step 9 — Voice "handle it" (Live API)

```
Add a voice mode using the Gemini Live API (gemini-3.1-flash-live-preview): the user can say
"handle the urgent ones" and the agent runs the rescue, responding by voice. Keep it additive and
behind a clearly optional toggle; do not destabilize the core. Verify Live API usage against
https://ai.google.dev/gemini-api/docs/live-api. Commit, update PROGRESS.md.
```

---

## Generate the required Project Description Google Doc

After the build is stable, run this prompt, then paste the output into a Google Doc and set it to
**"Anyone with the link → Viewer"** (organizers may review version history):

```
Using the actual implemented features in this repo, write the hackathon Project Description with
EXACTLY these sections, concise and accurate (no invented features):

1. Problem Statement Selected — "The Last-Minute Life Saver".
2. Solution Overview — Clutch as an autonomous deadline-rescue agent that does the work, not reminders.
3. Key Features — the hero capabilities that are actually built.
4. Technologies Used — the real stack (Next.js, TypeScript, Tailwind, Framer Motion, Firebase, etc.).
5. Google Technologies Utilized — list each (Gemini 3.5 Flash, Google AI Studio, Cloud Run,
   Google Calendar API, Firebase, + any optional ones) with a one-line "used for X".

Then output a tight 60-second demo script that highlights: a multi-tool autonomous rescue, real
calendar events being created, and the live Agent Activity Feed.
```

---

## BlockseBlock submission (final, irreversible — submit with a buffer before 2 PM, 29 Jun)
1. Dashboard → the hackathon → **Create Project**.
2. Enter project name → select **"The Last-Minute Life Saver"** → Save & Next.
3. Paste the 3 links: **Cloud Run URL**, **GitHub repo**, **public Project Description doc** → Submit Now.
4. Toggle both notes → Continue.
5. **Final Submit** — only after the live link, repo, and doc are all confirmed working. **It cannot be edited or resubmitted.** Target ~12:30 PM, not 1:59.

---

## Alternative path: Google AI Studio Build Mode (no Claude Code)
If you'd rather build inside Google's tooling directly: open **AI Studio → Build Mode**, and paste the
**§1–§6 sections of CLAUDE.md as the build brief** (mission, hero features, stack, the agent loop, the
tool list). AI Studio scaffolds a React+TS app wired to Gemini and **deploys to Cloud Run via Publish →
Get Started → Publish App** (Starter Tier needs no billing). Trade-off: faster deploy, less control over
the server-side agent loop and OAuth. The same rubric priorities apply — keep the Agent Activity Feed
and the real Calendar writes.
