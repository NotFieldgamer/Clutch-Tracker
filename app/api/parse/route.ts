import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { prisma } from "@/lib/db";
import { authEnabled, getUserId } from "@/lib/auth";

// Prisma + @google/genai need the Node.js runtime (not edge).
export const runtime = "nodejs";

// Parse-/wire-specific shapes. The canonical app types live in lib/types.ts;
// task `type` is constrained to the canonical TaskType set.
const ALLOWED_TYPES = ["assignment", "bill", "interview", "meeting", "errand", "other"] as const;
interface ParsedTask {
  title: string;
  deadlineISO: string;
  importance: number;
  percentDone: number;
  type: string;
}
interface TaskDTO {
  id: string;
  title: string;
  deadlineISO: string;
  importance: number;
  percentDone: number;
  type: string;
}

// Pinned in CLAUDE.md §2 (swappable). gemini-3.5-flash is the primary; the
// rest are fallbacks tried in order when the primary is transiently overloaded
// (503) or rate-limited (429). All verified available on this key 2026-06.
const MODELS = ["gemini-3.5-flash", "gemini-3-flash-preview", "gemini-2.5-flash"];

/** Transient errors worth failing over / retrying (overload, rate limit). */
function isTransient(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  const msg = String((err as { message?: string })?.message ?? "");
  return (
    status === 503 ||
    status === 429 ||
    /UNAVAILABLE|RESOURCE_EXHAUSTED|overloaded|high demand/i.test(msg)
  );
}

// Structured-output schema (verified against @google/genai docs:
// config.responseMimeType "application/json" + config.responseSchema with Type).
const RESPONSE_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description: "Short, specific name of the task, in the user's own words.",
      },
      deadlineISO: {
        type: Type.STRING,
        description:
          "Absolute deadline as ISO 8601. Resolve relative dates (\"Friday\", \"the 27th\", \"next week\") against the current date provided. If no time is given, use 18:00 local.",
      },
      importance: {
        type: Type.INTEGER,
        description: "1 (trivial) to 5 (critical).",
      },
      percentDone: {
        type: Type.INTEGER,
        description: "0 to 100. Use 0 unless the user implies progress.",
      },
      type: {
        type: Type.STRING,
        description:
          "One of: assignment, bill, interview, meeting, errand, other.",
      },
    },
    required: ["title", "deadlineISO", "importance", "percentDone", "type"],
  },
};

function clampInt(n: unknown, lo: number, hi: number, fallback: number): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(hi, Math.max(lo, Math.round(v)));
}

function normalizeType(t: unknown): string {
  const s = String(t ?? "").toLowerCase().trim();
  return (ALLOWED_TYPES as readonly string[]).includes(s) ? s : "other";
}

const toDTO = (t: {
  id: string;
  title: string;
  deadline: Date;
  importance: number;
  percentDone: number;
  type: string;
}): TaskDTO => ({
  id: t.id,
  title: t.title,
  deadlineISO: t.deadline.toISOString(),
  importance: t.importance,
  percentDone: t.percentDone,
  type: t.type,
});

export async function POST(req: Request) {
  let text: string | undefined;
  try {
    ({ text } = await req.json());
  } catch {
    return NextResponse.json(
      { error: "I couldn't read that request. Try again." },
      { status: 400 },
    );
  }

  if (!text || !text.trim()) {
    return NextResponse.json(
      { error: "Tell me what's on your plate and when it's due." },
      { status: 400 },
    );
  }

  const userId = await getUserId();
  if (authEnabled() && !userId) {
    return NextResponse.json({ error: "Sign in to add your week." }, { status: 401 });
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      {
        error:
          "The agent's brain isn't connected yet — set GEMINI_API_KEY and try again.",
      },
      { status: 500 },
    );
  }

  // 1) Free text → structured tasks (Gemini), failing over models on overload.
  let parsed: ParsedTask[];
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const now = new Date();
    const request = {
      contents:
        `Current date and time: ${now.toString()} (ISO ${now.toISOString()}).\n\n` +
        `The user described their week:\n"""${text}"""\n\n` +
        `Extract every distinct task. Resolve all relative dates against the current date above. Return only the JSON array.`,
      config: {
        systemInstruction:
          "You are Clutch, an autonomous deadline-rescue agent. Turn messy free text into a clean list of tasks. Be decisive: infer one concrete deadline per item, a realistic importance (1–5), and a type. Never invent tasks the user didn't mention.",
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.2,
      },
    };

    let raw: string | undefined;
    let lastErr: unknown;
    for (const model of MODELS) {
      try {
        const response = await ai.models.generateContent({ model, ...request });
        if (!response.text) throw new Error("Empty model response");
        raw = response.text;
        break;
      } catch (err) {
        lastErr = err;
        if (isTransient(err)) {
          console.warn(`[parse] ${model} unavailable (${(err as { status?: number })?.status}); trying next model`);
          continue; // fail over to the next model
        }
        throw err; // non-transient (bad request, auth) → stop now
      }
    }
    if (raw === undefined) throw lastErr ?? new Error("All models unavailable");

    const json = JSON.parse(raw);
    if (!Array.isArray(json)) throw new Error("Model did not return an array");
    parsed = json as ParsedTask[];
  } catch (err) {
    console.error("[parse] Gemini error:", err);
    const transient = isTransient(err);
    return NextResponse.json(
      {
        error: transient
          ? "The agent's busy right now — give it a few seconds and try again."
          : 'Couldn’t read that. Try naming each thing and when it’s due — e.g. "essay due Friday, rent on the 1st".',
      },
      { status: transient ? 503 : 502 },
    );
  }

  if (parsed.length === 0) {
    return NextResponse.json(
      { error: "I couldn't find a task in that. Name what's due and when." },
      { status: 422 },
    );
  }

  // 2) Normalize + persist (cap to a sane number per request).
  const nowMs = Date.now();
  const data = parsed
    .slice(0, 25)
    .map((p) => {
      const d = new Date(p.deadlineISO);
      const deadline = Number.isNaN(d.getTime())
        ? new Date(nowMs + 3 * 86_400_000) // sensible default: 3 days out
        : d;
      return {
        title: String(p.title ?? "").trim().slice(0, 200),
        deadline,
        importance: clampInt(p.importance, 1, 5, 3),
        percentDone: clampInt(p.percentDone, 0, 100, 0),
        type: normalizeType(p.type),
        userId, // null in the no-auth path
      };
    })
    .filter((d) => d.title.length > 0);

  if (data.length === 0) {
    return NextResponse.json(
      { error: "I couldn't make sense of those. Try rephrasing." },
      { status: 422 },
    );
  }

  let created;
  try {
    // $transaction of creates so we get the rows back (createMany doesn't on pg).
    created = await prisma.$transaction(
      data.map((d) => prisma.task.create({ data: d })),
    );
  } catch (err) {
    console.error("[parse] DB error:", err);
    return NextResponse.json(
      { error: "Saved nothing — the database didn't respond. Try again in a moment." },
      { status: 503 },
    );
  }

  return NextResponse.json({ tasks: created.map(toDTO) });
}
