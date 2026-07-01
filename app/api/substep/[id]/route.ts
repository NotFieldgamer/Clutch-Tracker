import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authEnabled, getUserId, taskScope } from "@/lib/auth";
import { progressFromSteps } from "@/lib/progress";

export const runtime = "nodejs";

/**
 * PATCH /api/substep/[id] — toggle a sub-step's `done`, persisted so the check
 * survives a refresh (app/page.tsx is force-dynamic and re-reads from the DB).
 * Scoped through the sub-step's parent task: `updateMany` with
 * { id, task: taskScope(userId) } so a signed-in user can only touch sub-steps
 * on their own tasks — anyone else's id matches zero rows and 404s. The no-auth
 * local path scopes globally, like the other routes.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: { done?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "I couldn't read that request." }, { status: 400 });
  }
  if (typeof body.done !== "boolean") {
    return NextResponse.json({ error: "Expected { done: boolean }." }, { status: 400 });
  }

  const userId = await getUserId();
  if (authEnabled() && !userId) {
    return NextResponse.json({ error: "Sign in to manage your week." }, { status: 401 });
  }

  try {
    // Scope through the parent task (so a user only touches their own steps) and
    // learn which task this step belongs to, so we can recompute that task's
    // overall progress once the toggle lands.
    const sub = await prisma.subStep.findFirst({
      where: { id, task: taskScope(userId) },
      select: { taskId: true },
    });
    if (!sub) {
      return NextResponse.json({ error: "That sub-step no longer exists." }, { status: 404 });
    }

    await prisma.subStep.update({ where: { id }, data: { done: body.done } });

    // Progress is checked sub-steps ÷ total — recompute + persist so the card's
    // "% done" survives a refresh and the risk score reflects real completion.
    const steps = await prisma.subStep.findMany({
      where: { taskId: sub.taskId },
      select: { done: true },
    });
    const percentDone = progressFromSteps(steps);
    await prisma.task.update({ where: { id: sub.taskId }, data: { percentDone } });

    return NextResponse.json({ id, done: body.done, percentDone });
  } catch (err) {
    console.error("[substep] patch error:", err);
    return NextResponse.json(
      { error: "Couldn't save that — the database didn't respond." },
      { status: 503 },
    );
  }
}
