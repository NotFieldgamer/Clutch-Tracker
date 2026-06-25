import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Space_Grotesk } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ClerkProvider } from "@clerk/nextjs";
import AmbientBg from "@/components/ui/AmbientBg";
import { authEnabled } from "@/lib/auth";
import "./globals.css";

// Display face — big numbers, section titles, the hero line (DESIGN.md §3).
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Clutch — your deadline-rescue agent",
  description:
    "Clutch doesn't remind you — it does the work: it plans, schedules, drafts, and shows every move in real time.",
};

export const viewport: Viewport = {
  themeColor: "#0B0E16",
  colorScheme: "dark",
};

// Clerk components themed to DESIGN.md: violet --agent primary, dark surfaces.
const CLERK_APPEARANCE = {
  variables: {
    colorPrimary: "#8B5CF6",
    colorBackground: "#10141F",
    colorText: "#E9EDF7",
    colorTextSecondary: "#8B94AC",
    colorInputBackground: "#141A28",
    colorInputText: "#E9EDF7",
    colorDanger: "#FB7185",
    borderRadius: "10px",
  },
  elements: {
    card: "bg-[color-mix(in_srgb,var(--surface)_60%,transparent)] border border-[var(--border)] backdrop-blur-[20px] shadow-none",
    headerTitle: "text-text",
    socialButtonsBlockButton: "border-[var(--border)]",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const tree = (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} ${spaceGrotesk.variable}`}
    >
      <body className="font-sans antialiased">
        <AmbientBg />
        {children}
        {/* Google Identity Services — client-side OAuth for Calendar (lib/google/auth.ts). */}
        <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
      </body>
    </html>
  );

  // Auth off → return the tree untouched (no Clerk in the no-auth dev path).
  if (!authEnabled()) return tree;
  return (
    <ClerkProvider appearance={CLERK_APPEARANCE} afterSignOutUrl="/sign-in">
      {tree}
    </ClerkProvider>
  );
}
