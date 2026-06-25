import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import RescueBoard from "@/components/RescueBoard";
import { authEnabled, getUserId, taskScope } from "@/lib/auth";
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
      })),
    }));
  } catch (err) {
    console.error("[page] Could not read tasks:", err);
    return [];
  }
}

export default async function Home() {
  const userId = await getUserId();
  // Auth on but signed out → go sign in (no-auth path skips this entirely).
  if (authEnabled() && !userId) redirect("/sign-in");

  const tasks = await loadTasks(userId);
  return <RescueBoard initialTasks={tasks} />;
}
