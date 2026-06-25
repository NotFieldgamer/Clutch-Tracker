import { prisma } from "@/lib/db";
import RescueBoard from "@/components/RescueBoard";
import type { Task } from "@/lib/types";

// Always read fresh tasks on request (the view reflects DB writes immediately).
export const dynamic = "force-dynamic";

async function loadTasks(): Promise<Task[]> {
  try {
    const rows = await prisma.task.findMany({ orderBy: { deadline: "asc" } });
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      deadlineISO: r.deadline.toISOString(),
      importance: r.importance,
      percentDone: r.percentDone,
      type: r.type as Task["type"],
      // Rescue outputs aren't persisted yet — they fill in live during a rescue.
      subSteps: [],
      blocks: [],
      artifacts: [],
    }));
  } catch (err) {
    console.error("[page] Could not read tasks:", err);
    return [];
  }
}

export default async function Home() {
  const tasks = await loadTasks();
  return <RescueBoard initialTasks={tasks} />;
}
