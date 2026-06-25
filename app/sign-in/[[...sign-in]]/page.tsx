import { SignIn } from "@clerk/nextjs";
import { authEnabled, getUserId } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Sign-in screen (DESIGN.md voice + palette). The Clutch thesis on top, then
 * Clerk's <SignIn/> themed via the global appearance in app/layout.tsx. If auth
 * isn't configured there's nothing to sign into — send people home.
 */
export default async function SignInPage() {
  if (!authEnabled()) redirect("/");
  // Already signed in? Skip <SignIn/> entirely (it would client-redirect and
  // flash Clerk's "already signed in" notice) — go straight home.
  if (await getUserId()) redirect("/");

  return (
    <main className="relative mx-auto flex min-h-[100dvh] w-full max-w-md flex-col items-center justify-center px-6 py-16">
      <div className="mb-8 text-center">
        <span className="t-caption inline-flex items-center gap-2">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: "var(--agent)", boxShadow: "0 0 10px var(--agent-glow)" }}
          />
          Clutch
        </span>
        <h1 className="t-display-l mt-5 text-text">Your week, handled.</h1>
        <p className="t-body-l mt-3 text-muted">
          Sign in and the agent picks up your tasks, plans, and drafts where you left them.
        </p>
      </div>

      <SignIn fallbackRedirectUrl="/" signUpUrl="/sign-in" />
    </main>
  );
}
