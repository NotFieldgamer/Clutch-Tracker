import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authEnabled, getUserId, taskScope } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * PATCH /api/artifact/[id] — persist the user's approve/undo on an artifact so
 * the "Approved" badge survives a refresh (app/page.tsx is force-dynamic and
 * re-reads from the DB every request). Scoped through the artifact's parent
 * task: `updateMany` with { id, task: taskScope(userId) } so a signed-in user
 * can only touch artifacts on their own tasks — anyone else's id matches zero
 * rows and 404s. No-auth local path scopes globally, like the other routes.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: { approved?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "I couldn't read that request." }, { status: 400 });
  }
  if (typeof body.approved !== "boolean") {
    return NextResponse.json({ error: "Expected { approved: boolean }." }, { status: 400 });
  }

  const userId = await getUserId();
  if (authEnabled() && !userId) {
    return NextResponse.json({ error: "Sign in to manage your week." }, { status: 401 });
  }

  try {
    const { count } = await prisma.artifact.updateMany({
      where: { id, task: taskScope(userId) },
      data: { approved: body.approved },
    });
    if (count === 0) {
      return NextResponse.json({ error: "That artifact no longer exists." }, { status: 404 });
    }
    return NextResponse.json({ id, approved: body.approved });
  } catch (err) {
    console.error("[artifact] patch error:", err);
    return NextResponse.json(
      { error: "Couldn't save that — the database didn't respond." },
      { status: 503 },
    );
  }
}
