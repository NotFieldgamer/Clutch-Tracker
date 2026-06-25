"use client";

import { UserButton } from "@clerk/nextjs";

/**
 * AuthControls — the signed-in user's avatar/menu in the header. Renders only
 * when Clerk is configured (NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is inlined at
 * build); in the no-auth path it renders nothing, so the header is unchanged.
 */
export default function AuthControls() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return null;

  // afterSignOutUrl is configured on ClerkProvider (app/layout.tsx).
  return <UserButton appearance={{ elements: { avatarBox: "h-8 w-8" } }} />;
}
