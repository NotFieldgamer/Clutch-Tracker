import { GoogleGenAI } from "@google/genai";
import { runRescue } from "@/agent/agentLoop";
import type { Task, ActionLogEntry } from "@/lib/types";

// The agent loop + Prisma need Node.js; a rescue chains several model calls.
export const runtime = "nodejs";
export const maxDuration = 60;

// The verbatim runRescue defaults to gemini-3.5-flash, which is currently
// overloaded for this key (503). We drive the loop with gemini-2.5-flash and
// fail over to others on transient errors (model is swappable per CLAUDE.md §2).
const AGENT_MODEL = "gemini-2.5-flash";
const AGENT_FALLBACKS = ["gemini-3-flash-preview", "gemini-flash-latest", "gemini-2.5-flash"];

const DEFAULT_GOAL =
  "Rescue my week. For each task at risk of slipping: prioritize, decompose it into concrete sub-steps, and generate a real first-draft artifact. Try to schedule work blocks — but if the calendar isn't connected, skip only the scheduling and still do everything else. Finish with a short, specific, past-tense summary of what you did.";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isTransient(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  const msg = String((err as { message?: string })?.message ?? "");
  return (
    status === 503 ||
    status === 429 ||
    /UNAVAILABLE|RESOURCE_EXHAUSTED|overloaded|high demand/i.test(msg)
  );
}

/**
 * Wrap GoogleGenAI so every generateContent call (the loop's AND the verbatim
 * tools') retries with backoff and fails over models on transient overload —
 * without editing the verbatim agent core. Each call resends full contents, so
 * switching models between turns is safe.
 */
function makeResilientAI(apiKey: string): GoogleGenAI {
  const ai = new GoogleGenAI({ apiKey });
  const real = ai.models.generateContent.bind(ai.models);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (ai.models as any).generateContent = async (params: any) => {
    const primary: string = params?.model ?? AGENT_MODEL;
    const chain = [primary, ...AGENT_FALLBACKS.filter((m) => m !== primary)];
    let lastErr: unknown;
    for (const model of chain) {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          return await real({ ...params, model });
        } catch (err) {
          lastErr = err;
          if (isTransient(err)) {
            await sleep(450 * (attempt + 1));
            continue; // retry same model with backoff
          }
          throw err; // non-transient → bubble up
        }
      }
      // exhausted retries on this model → fail over to the next
    }
    throw lastErr;
  };

  return ai;
}

function normalizeTask(t: Partial<Task> & { id: string }): Task {
  return {
    id: String(t.id),
    title: String(t.title ?? "Untitled"),
    deadlineISO: String(t.deadlineISO ?? new Date().toISOString()),
    importance: Number(t.importance) || 3,
    percentDone: Number(t.percentDone) || 0,
    type: (t.type ?? "other") as Task["type"],
    subSteps: Array.isArray(t.subSteps) ? t.subSteps : [],
    blocks: Array.isArray(t.blocks) ? t.blocks : [],
    artifacts: Array.isArray(t.artifacts) ? t.artifacts : [],
  };
}

export async function POST(req: Request) {
  let body: { goal?: string; tasks?: unknown; calendarToken?: string | null };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "I couldn't read that request. Try again." }, { status: 400 });
  }

  if (!process.env.GEMINI_API_KEY) {
    return Response.json(
      { error: "The agent's brain isn't connected yet — set GEMINI_API_KEY and try again." },
      { status: 500 },
    );
  }

  const incoming = Array.isArray(body.tasks) ? (body.tasks as Array<{ id: string }>) : [];
  if (incoming.length === 0) {
    return Response.json(
      { error: "Nothing to rescue yet. Add your week first." },
      { status: 400 },
    );
  }

  const tasks = incoming.map(normalizeTask);
  const goal = body.goal?.trim() || DEFAULT_GOAL;
  const calendarToken = body.calendarToken ?? null; // calendar arrives in Step 4

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      try {
        const ai = makeResilientAI(process.env.GEMINI_API_KEY!);
        const result = await runRescue({
          ai,
          tasks,
          goal,
          model: AGENT_MODEL,
          getAccessToken: () => calendarToken,
          onLog: (entry: ActionLogEntry) => send({ type: "log", entry }),
        });
        send({ type: "done", tasks: result.tasks, finalText: result.finalText });
      } catch (err) {
        console.error("[agent] rescue interrupted:", err);
        // runRescue mutates `tasks` in place, so partial work (sub-steps,
        // drafts) survives a mid-loop failure — deliver it rather than drop it.
        send({
          type: "done",
          tasks,
          finalText: isTransient(err)
            ? "The model got busy partway through — the sub-steps and drafts so far are saved below. Run the rescue again to finish the rest."
            : "The rescue stopped early. What got done is below — give it another go in a moment.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
