import type { Config } from "tailwindcss";

/**
 * Design tokens live in app/globals.css as CSS variables (DESIGN.md §2).
 * Here we surface them as Tailwind utilities (bg-ink, text-muted, font-display, …)
 * so every screen inherits the system instead of hardcoding hex values.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx,mdx}",
    "./components/**/*.{ts,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "var(--ink)",
        "ink-2": "var(--ink-2)",
        surface: "var(--surface)",
        line: "var(--border)",
        "line-strong": "var(--border-str)",

        text: "var(--text)",
        muted: "var(--muted)",
        faint: "var(--faint)",

        // the agent's own signal — reserve for agent actions & the rail
        agent: {
          DEFAULT: "var(--agent)",
          2: "var(--agent-2)",
        },

        // heat scale — encodes deadline risk (meaning, not decoration)
        calm: "var(--calm)",
        warm: "var(--warm)",
        hot: "var(--hot)",
        critical: "var(--critical)",
      },
      fontFamily: {
        display: ["var(--font-space-grotesk)", "system-ui", "sans-serif"],
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
        sm: "var(--radius-sm)",
      },
      boxShadow: {
        "agent-glow": "0 0 0 1px var(--border-str), 0 8px 30px var(--agent-glow)",
      },
    },
  },
  plugins: [],
};

export default config;
