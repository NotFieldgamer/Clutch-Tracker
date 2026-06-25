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

**Next (Step 1 — data model + plain-language capture)**
- Expand `lib/types.ts` core types (Task, SubStep, Block, Artifact, ActionLogEntry).
- `AddTaskBar` + `/api/parse` (Gemini structured output → Task[]).
- Render parsed tasks as `TaskCard`s.

**Known issues**
- None blocking. Prisma schema is a stub — real models (sub-steps, blocks, artifacts, action-logs)
  land with persistence.
- `.env.local` must be filled before any Gemini/Calendar/DB feature works.
