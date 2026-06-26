import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authEnabled, getUserId, taskScope } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * DELETE /api/task/[id] — remove a single task and (via the schema's
 * onDelete: Cascade on SubStep/Block/Artifact/ActionLog) all of its rescue
 * output. Scoped: `deleteMany` with { id, ...taskScope(userId) } so a signed-in
 * user can only delete their own tasks — another user's id simply matches zero
 * rows and 404s, never leaking existence. In the no-auth local path the scope is
 * empty (global), matching how seed/parse already behave.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const userId = await getUserId();
  if (authEnabled() && !userId) {
    return NextResponse.json({ error: "Sign in to manage your week." }, { status: 401 });
  }

  try {
    const { count } = await prisma.task.deleteMany({
      where: { id, ...taskScope(userId) },
    });
    if (count === 0) {
      return NextResponse.json({ error: "That task no longer exists." }, { status: 404 });
    }
    return NextResponse.json({ deleted: id });
  } catch (err) {
    console.error("[task] delete error:", err);
    return NextResponse.json(
      { error: "Couldn't remove that task — the database didn't respond." },
      { status: 503 },
    );
  }
}
