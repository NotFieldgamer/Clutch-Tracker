"use client";

import { motion, useReducedMotion } from "framer-motion";
import { rescueEase } from "@/lib/motion";

interface RiskMeterProps {
  /** 0..1 — higher means closer to slipping. */
  value: number;
  className?: string;
  "aria-label"?: string;
}

/** Map a 0..1 risk to the heat scale (DESIGN.md §2). Meaning, not decoration. */
export function heatFor(risk: number): string {
  if (risk < 0.3) return "var(--calm)";
  if (risk < 0.55) return "var(--warm)";
  if (risk < 0.8) return "var(--hot)";
  return "var(--critical)";
}

/**
 * RiskMeter — a thin horizontal bar whose fill width + color come from `value`.
 * Animatable: when a rescue drops the risk, the fill eases down and shifts
 * toward --calm over ~700ms (the visual payoff of "the agent handled it").
 */
export default function RiskMeter({
  value,
  className = "",
  "aria-label": ariaLabel,
}: RiskMeterProps) {
  const v = Math.max(0, Math.min(1, value));
  const color = heatFor(v);
  const reduce = useReducedMotion();

  return (
    <div
      className={`h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06] ${className}`}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={1}
      aria-valuenow={Number(v.toFixed(2))}
      aria-label={ariaLabel ?? "Deadline risk"}
    >
      <motion.div
        className="h-full rounded-full"
        initial={false}
        animate={{ width: `${v * 100}%`, backgroundColor: color }}
        // The de-escalation ease is the payoff; under reduced motion the meter
        // still changes (color + width) but snaps rather than glides.
        transition={reduce ? { duration: 0 } : rescueEase}
        style={{ backgroundColor: color }}
      />
    </div>
  );
}
