/**
 * Auth flag + helpers (CLAUDE.md §2 — Clerk is optional, behind a flag).
 *
 * Auth is ON only when both Clerk keys are present. With no keys, the app runs
 * the no-auth local-dev path: `userId` is null, tasks aren't scoped, and no
 * Clerk UI renders. This keeps `npm run dev` working without any auth setup.
 */
export function authEnabled(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
  );
}

/** The signed-in Clerk user id, or null when auth is disabled. */
export async function getUserId(): Promise<string | null> {
  if (!authEnabled()) return null;
  // Imported lazily so the no-auth path never loads Clerk's server runtime.
  const { auth } = await import("@clerk/nextjs/server");
  const { userId } = await auth();
  return userId ?? null;
}

/**
 * A Prisma `where` fragment that scopes Task queries to the current user when
 * auth is on, and to everything (global) in the no-auth path.
 */
export function taskScope(userId: string | null): { userId?: string | null } {
  return authEnabled() ? { userId } : {};
}
