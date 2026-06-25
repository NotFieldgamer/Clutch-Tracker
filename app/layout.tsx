import type { Metadata, Viewport } from "next";
import { Space_Grotesk } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import AmbientBg from "@/components/ui/AmbientBg";
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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} ${spaceGrotesk.variable}`}
    >
      <body className="font-sans antialiased">
        <AmbientBg />
        {children}
      </body>
    </html>
  );
}
