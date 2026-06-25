import { clerkMiddleware } from "@clerk/nextjs/server";
import { authEnabled } from "@/lib/auth";

/**
 * Auth on  → Clerk middleware makes the auth() context available to server
 *            components and route handlers (it does not force-protect routes;
 *            the Today view redirects signed-out users to /sign-in itself).
 * Auth off → a passthrough, so the no-auth local-dev path is untouched.
 */
export default authEnabled() ? clerkMiddleware() : () => undefined;

export const config = {
  matcher: [
    // Everything except Next internals and static files…
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // …and always on API routes so auth() resolves inside handlers.
    "/(api|trpc)(.*)",
  ],
};
