"use client";

import { useReducedMotion } from "framer-motion";

/**
 * Skeleton — a dim placeholder bar for loading states (DESIGN.md §7: "skeletons
 * + 'Reading your week…'"). Pulses gently while content is on its way; under
 * reduced motion it holds a static dim block instead of animating.
 */
export default function Skeleton({ className = "" }: { className?: string }) {
  const reduce = useReducedMotion();
  return (
    <span
      aria-hidden
      className={`block rounded-[6px] bg-white/[0.07] ${reduce ? "" : "animate-pulse"} ${className}`}
    />
  );
}
