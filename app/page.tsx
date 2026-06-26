import { prisma } from "@/lib/db";
import RescueBoard from "@/components/RescueBoard";
import { getUserId, taskScope } from "@/lib/auth";
import type { Task } from "@/lib/types";

// Always read fresh tasks on request (the view reflects DB writes immediately).
export const dynamic = "force-dynamic";

async function loadTasks(userId: string | null): Promise<Task[]> {
  try {
    // Load each task with its persisted rescue outputs so they survive a refresh.
    const rows = await prisma.task.findMany({
      where: taskScope(userId),
      orderBy: { deadline: "asc" },
      include: {
        subSteps: { orderBy: { order: "asc" } },
        blocks: { orderBy: { start: "asc" } },
        artifacts: { orderBy: { createdAt: "asc" } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      deadlineISO: r.deadline.toISOString(),
      importance: r.importance,
      percentDone: r.percentDone,
      type: r.type as Task["type"],
      subSteps: r.subSteps.map((s) => ({
        id: s.id,
        title: s.title,
        effortMin: s.effortMin,
        done: s.done,
      })),
      blocks: r.blocks.map((b) => ({
        id: b.id,
        taskId: b.taskId,
        startISO: b.start.toISOString(),
        endISO: b.end.toISOString(),
        title: b.title,
        calendarEventId: b.calendarEventId ?? undefined,
      })),
      artifacts: r.artifacts.map((a) => ({
        id: a.id,
        taskId: a.taskId,
        kind: a.kind as Task["artifacts"][number]["kind"],
        content: a.content,
        approved: a.approved,
      })),
    }));
  } catch (err) {
    console.error("[page] Could not read tasks:", err);
    return [];
  }
}

export default async function Home() {
  // When auth is on, middleware.ts has already gated this route — a signed-out
  // user was redirected to /sign-in there (after the session handshake), so we
  // only read the id for scoping. No page-level redirect → no /sign-in ⇄ /
  // loop. The no-auth path returns userId null and loads global tasks.
  const userId = await getUserId();
  const tasks = await loadTasks(userId);
  return <RescueBoard initialTasks={tasks} />;
}
