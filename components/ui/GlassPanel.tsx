import type { HTMLAttributes } from "react";

type Variant = "card" | "rail";

interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  /** "card" for content surfaces, "rail" for the docked activity panel. */
  variant?: Variant;
}

const VARIANT: Record<Variant, string> = {
  card: "rounded-[var(--radius)] p-5",
  // the rail reads as a docked operations panel: tighter padding + a hairline
  // top highlight so it sits distinct from the page.
  rail: "rounded-[var(--radius)] p-4 shadow-[inset_0_1px_0_var(--border-str)]",
};

/**
 * GlassPanel — the app's glass surface (DESIGN.md §2).
 * --surface at ~60% opacity + backdrop-blur(20px) + 1px --border. Used
 * sparingly (key cards and the rail), not on everything.
 */
export default function GlassPanel({
  variant = "card",
  className = "",
  children,
  ...rest
}: GlassPanelProps) {
  return (
    <div
      className={`border border-line backdrop-blur-[20px] ${VARIANT[variant]} ${className}`}
      style={{ background: "color-mix(in srgb, var(--surface) 60%, transparent)" }}
      {...rest}
    >
      {children}
    </div>
  );
}
