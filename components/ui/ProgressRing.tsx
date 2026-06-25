"use client";

import { motion } from "framer-motion";

interface ProgressRingProps {
  /** 0..100 percent complete. */
  value: number;
  /** Outer diameter in px. */
  size?: number;
  /** Stroke width in px. */
  stroke?: number;
  /** Ring color (defaults to the agent violet). */
  color?: string;
  /** Show the centered percent label. */
  showLabel?: boolean;
  className?: string;
}

/**
 * ProgressRing (DESIGN.md §4.7) — an SVG ring that fills via animated
 * stroke-dashoffset for a 0..100 percent (task / sub-step completion).
 */
export default function ProgressRing({
  value,
  size = 64,
  stroke = 6,
  color = "var(--agent)",
  showLabel = true,
  className = "",
}: ProgressRingProps) {
  const v = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - v / 100);

  return (
    <div
      className={`relative inline-grid place-items-center ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${Math.round(v)} percent complete`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--border)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      {showLabel && (
        <span className="absolute t-mono text-text">{Math.round(v)}%</span>
      )}
    </div>
  );
}
