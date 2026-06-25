import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Deploy target is Vercel (per CLAUDE.md §2) — no standalone/Docker output needed.
  // Keep this minimal; add config as later build steps require it.
  reactStrictMode: true,
};

export default nextConfig;
