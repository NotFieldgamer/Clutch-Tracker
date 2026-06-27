# Clutch

**An autonomous deadline-rescue agent.** It doesn&rsquo;t remind you — it does the work: when something&rsquo;s
about to slip, Clutch plans it, schedules it into your real calendar, drafts the message, writes the
first draft — and shows every move it makes in real time.

> The one principle: **it doesn&rsquo;t remind — it does the work and shows you.**

---

## Stack

- **Framework:** Next.js 15 (App Router) + TypeScript
- **Styling:** Tailwind CSS + CSS-variable design tokens (`app/globals.css`)
- **Motion:** Framer Motion · **Icons:** lucide-react
- **Fonts:** Geist Sans / Geist Mono (`geist`) + Space Grotesk (`next/font/google`)
- **AI:** `@google/genai` (Gemini, server-side only)
- **Calendar:** Google Calendar API v3 via Google Identity Services
- **Data:** Prisma + PostgreSQL (Supabase)
- **Auth (optional):** Clerk
- **Deploy:** Vercel

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in your keys
npm run dev                  # http://localhost:3000
```

`npm run build` runs `prisma generate && next build` (no DB needed). `prisma generate` also runs on
`postinstall`. Database migrations are applied separately — locally or in CI with
`npm run db:migrate:deploy` (needs `DATABASE_URL`/`DIRECT_URL`); on Vercel they run automatically via
`vercel.json`'s build command (see Deploy).

## Environment variables

See [`.env.example`](.env.example). Secrets (`GEMINI_API_KEY`, `CLERK_SECRET_KEY`, `DATABASE_URL`,
`DIRECT_URL`) stay server-side; only `NEXT_PUBLIC_*` values reach the browser. Never commit `.env.local`.

## Project structure

```
app/            layout, globals.css (tokens), page (Today / Rescue), api routes
components/ui/  base UI (AmbientBg, …)
prisma/         schema.prisma
```

## Deploy (Vercel)

1. Push to GitHub, then import the repo at [vercel.com/new](https://vercel.com/new).
2. Add the env vars from `.env.example` (Production + Preview).
3. Deploy. `vercel.json` sets the build command to
   `prisma generate && (prisma migrate deploy || echo skip) && next build`, so **migrations apply on
   each deploy** while a transient DB issue degrades (skips migrate) instead of bricking the build. If
   you'd rather gate it, run `npm run db:migrate:deploy` against the production DB manually and drop the
   migrate step from `vercel.json`.

### Durable agent path (optional, flag-gated)

The default rescue runs as an inline streaming loop. Setting `USE_DURABLE_AGENT=1` switches to a
[Vercel Workflow DevKit](https://useworkflow.dev) durable agent (`next.config.ts` `withWorkflow`,
`agent/rescueWorkflow.ts`) that survives the 60s function limit and interruptions. Notes:

- The Workflow "World" stores run state in the `iad1` region — co-locating the app there
  (`"regions": ["iad1"]` in `vercel.json`) cuts latency to the run store.
- `vercel.json` already sets `supportsCancellation` on `app/api/agent/route.ts` so an abandoned
  streaming rescue tears down instead of billing to `maxDuration`.
- `maxDuration = 60` on the agent route assumes a Pro/Fluid plan; Hobby caps function duration lower.

---

Built per `CLAUDE.md` (product spec) and `DESIGN.md` (visual + motion system).
