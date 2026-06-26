import { getWritable } from "workflow";
import { prisma } from "@/lib/db";
import type { ActionLogEntry } from "@/lib/types";

/**
 * The Agent Activity rail stream (DESIGN.md §5). Tool steps write NDJSON lines to
 * a dedicated "rail" namespace; the /api/agent route returns that readable, so the
 * live client (components/RescueBoard.tsx) consumes the SAME wire format it always
 * has: `{type:"log",entry}` lines, then a final `{type:"done",tasks,finalText}`.
 *
 * IMPORTANT: every function here touches a stream (getWritable) and so MUST be
 * called from inside a `"use step"` function, never from workflow context.
 */
export const RAIL_NAMESPACE = "rail";

const uid = () => Math.random().toString(36).slice(2, 9);

/** Write one Activity-rail line and persist it to ActionLog (parity with the legacy path). */
export async function railLog(e: {
  tool: string;
  summary: string;
  ok: boolean;
  taskId?: string | null;
}): Promise<ActionLogEntry> {
  const entry: ActionLogEntry = {
    id: uid(),
    tool: e.tool,
    summary: e.summary,
    at: new Date().toISOString(),
    ok: e.ok,
  };

  const writer = getWritable<string>({ namespace: RAIL_NAMESPACE }).getWriter();
  try {
    await writer.write(JSON.stringify({ type: "log", entry }) + "\n");
  } finally {
    writer.releaseLock();
  }

  // Telemetry parity: the legacy route persisted each tool call. Best-effort —
  // a logging failure must never sink the rescue.
  try {
    await prisma.actionLog.create({
      data: {
        tool: e.tool,
        summary: e.summary,
        status: e.ok ? "ok" : "error",
        taskId: e.taskId ?? null,
      },
    });
  } catch {
    /* non-fatal */
  }

  return entry;
}

/** Final line: the de-escalated tasks (so cards update live) + the agent's summary. */
export async function railDone(tasks: unknown, finalText: string): Promise<void> {
  const writer = getWritable<string>({ namespace: RAIL_NAMESPACE }).getWriter();
  try {
    await writer.write(JSON.stringify({ type: "done", tasks, finalText }) + "\n");
  } finally {
    writer.releaseLock();
  }
}

/** Signal completion to the client earlier than run teardown. */
export async function railClose(): Promise<void> {
  await getWritable<string>({ namespace: RAIL_NAMESPACE }).close();
}
