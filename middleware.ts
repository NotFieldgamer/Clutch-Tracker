import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { authEnabled } from "@/lib/auth";

/**
 * Auth on  → Clerk middleware runs the session handshake on every matched
 *            request, THEN gates: a signed-out user hitting an app route is
 *            redirected to our themed /sign-in. Gating *here* (not in the page
 *            server component) is what avoids the /sign-in ⇄ / redirect loop —
 *            the middleware resolves the session before any page reads auth(),
 *            so client and server never disagree about who's signed in.
 * Auth off → a passthrough, so the no-auth local-dev path is untouched.
 */

// Reachable while signed out: the sign-in page (+ its catch-all subpaths) and
// the API/tRPC routes (they return their own 401 rather than redirect to HTML).
const isPublic = createRouteMatcher(["/sign-in(.*)", "/api(.*)", "/trpc(.*)"]);

export default authEnabled()
  ? clerkMiddleware(async (auth, req) => {
      if (isPublic(req)) return; // these routes gate themselves
      const { userId } = await auth();
      if (!userId) {
        // Send them to OUR themed page (not Clerk's hosted Account Portal).
        return NextResponse.redirect(new URL("/sign-in", req.url));
      }
    })
  : () => undefined;

export const config = {
  matcher: [
    // Everything except Next internals, static files, and the Workflow DevKit's
    // internal endpoints. Excluding `.well-known/workflow` is REQUIRED — if Clerk
    // middleware intercepts `POST /.well-known/workflow/v1/flow` the durable agent
    // silently fails ("Queue operation failed / detached ArrayBuffer").
    "/((?!_next|\\.well-known/workflow|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // …always on API routes so auth() resolves inside handlers…
    "/(api|trpc)(.*)",
    // …and always on Clerk's frontend API routes so the session handshake
    // completes (required by current Clerk; its absence breaks dev sessions).
    "/__clerk/(.*)",
  ],
};
