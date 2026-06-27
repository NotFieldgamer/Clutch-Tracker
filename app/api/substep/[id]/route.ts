import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authEnabled, getUserId, taskScope } from "@/lib/auth";

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
    const { count } = await prisma.subStep.updateMany({
      where: { id, task: taskScope(userId) },
      data: { done: body.done },
    });
    if (count === 0) {
      return NextResponse.json({ error: "That sub-step no longer exists." }, { status: 404 });
    }
    return NextResponse.json({ id, done: body.done });
  } catch (err) {
    console.error("[substep] patch error:", err);
    return NextResponse.json(
      { error: "Couldn't save that — the database didn't respond." },
      { status: 503 },
    );
  }
}
