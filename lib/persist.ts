import { prisma } from "@/lib/db";
import type { Task, ActionLogEntry } from "@/lib/types";

/** Artifacts carry a `kind` in memory but the table needs a human title. */
const ARTIFACT_TITLE: Record<string, string> = {
  outline: "Outline",
  draft: "First draft",
  email: "Email draft",
  prep: "Prep questions",
  note: "Note",
};

const isRescued = (t: Task) =>
  t.subSteps.length > 0 || t.blocks.length > 0 || t.artifacts.length > 0;

/**
 * Persist the outputs of a rescue (CLAUDE.md §4 — "after a rescue, persist
 * updated tasks/blocks/artifacts/logs"). For each rescued task we replace its
 * sub-steps / blocks / artifacts with the current in-memory set (a rescue
 * regenerates them), then append the action-log entries.
 *
 * `ownedIds`, when non-null, restricts writes to tasks the signed-in user owns
 * — defense-in-depth so a crafted payload can't touch another user's rows.
 * Each task persists in its own transaction; one failure never sinks the rest.
 */
export async function persistRescue(
  tasks: Task[],
  logs: ActionLogEntry[],
  ownedIds: Set<string> | null,
): Promise<void> {
  for (const t of tasks) {
    if (!isRescued(t)) continue;
    if (ownedIds && !ownedIds.has(t.id)) continue;

    // Persist each kind in its OWN transaction (replace-in-place), so a failure
    // on one table can't roll back the others. A rescue must never lose its
    // sub-steps because the artifact write hiccupped (e.g. a transient error or
    // a stale dev client). Only a kind the rescue actually produced is replaced;
    // an empty kind is left untouched rather than wiped.
    if (t.subSteps.length > 0) {
      try {
        await prisma.$transaction([
          prisma.subStep.deleteMany({ where: { taskId: t.id } }),
          prisma.subStep.createMany({
            data: t.subSteps.map((s, i) => ({
              id: s.id,
              taskId: t.id,
              title: s.title,
              effortMin: Math.max(0, Math.round(Number(s.effortMin) || 0)),
              done: Boolean(s.done),
              order: i,
            })),
          }),
        ]);
      } catch (err) {
        console.error(`[persist] sub-steps for task ${t.id} failed:`, err);
      }
    }

    if (t.blocks.length > 0) {
      try {
        await prisma.$transaction([
          prisma.block.deleteMany({ where: { taskId: t.id } }),
          prisma.block.createMany({
            data: t.blocks.map((b) => ({
              id: b.id,
              taskId: t.id,
              title: b.title,
              start: new Date(b.startISO),
              end: new Date(b.endISO),
              calendarEventId: b.calendarEventId ?? null,
              status: b.calendarEventId ? "scheduled" : "planned",
            })),
          }),
        ]);
      } catch (err) {
        console.error(`[persist] blocks for task ${t.id} failed:`, err);
      }
    }

    if (t.artifacts.length > 0) {
      try {
        await prisma.$transaction([
          prisma.artifact.deleteMany({ where: { taskId: t.id } }),
          prisma.artifact.createMany({
            data: t.artifacts.map((a) => ({
              id: a.id,
              taskId: t.id,
              kind: a.kind,
              title: ARTIFACT_TITLE[a.kind] ?? "Artifact",
              content: a.content,
              // Carry the approval through the rescue round-trip — this replace is
              // a delete+recreate, so without it an approved artifact the user
              // didn't touch would revert to the default (false) on a re-rescue.
              approved: Boolean(a.approved),
            })),
          }),
        ]);
      } catch (err) {
        console.error(`[persist] artifacts for task ${t.id} failed:`, err);
      }
    }
  }

  if (logs.length > 0) {
    try {
      await prisma.actionLog.createMany({
        data: logs.map((l) => ({
          id: l.id,
          tool: l.tool,
          summary: l.summary,
          status: l.ok ? "ok" : "error",
          createdAt: new Date(l.at),
        })),
        skipDuplicates: true,
      });
    } catch (err) {
      console.error("[persist] action log failed:", err);
    }
  }
}
