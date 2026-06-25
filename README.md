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

`npm run build` runs `prisma generate && next build`. `prisma generate` also runs on `postinstall`.

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
3. Deploy. The build command is `prisma generate && next build` (already in `package.json`).

---

Built per `CLAUDE.md` (product spec) and `DESIGN.md` (visual + motion system).
