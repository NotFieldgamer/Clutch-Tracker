import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  // Deploy target is Vercel (per CLAUDE.md §2) — no standalone/Docker output needed.
  reactStrictMode: true,
};

// withWorkflow enables the "use workflow" / "use step" directives used by the
// durable rescue agent (agent/rescueWorkflow.ts). The legacy inline agent loop
// still works with the flag off, so this wrap is safe either way.
export default withWorkflow(nextConfig);
