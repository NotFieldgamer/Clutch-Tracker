"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useInView, useMotionValue, useReducedMotion } from "framer-motion";

interface CountUpProps {
  /** Target value to count to. */
  value: number;
  /** Animation duration in seconds. */
  duration?: number;
  /** Decimal places to show. */
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

const format = (n: number, decimals: number) =>
  Number(n.toFixed(decimals)).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

/**
 * CountUp (DESIGN.md §4.6) — animates a number from its current value to
 * `value` with useMotionValue + animate, kicking off when scrolled into view.
 * Re-runs when `value` changes (e.g. "minutes reclaimed" after a rescue).
 * Under reduced motion it snaps to the final value.
 */
export default function CountUp({
  value,
  duration = 1.2,
  decimals = 0,
  prefix = "",
  suffix = "",
  className = "",
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });
  const reduce = useReducedMotion();
  const mv = useMotionValue(0);
  const [display, setDisplay] = useState(() => format(0, decimals));

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setDisplay(format(value, decimals));
      return;
    }
    const controls = animate(mv, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => setDisplay(format(latest, decimals)),
    });
    return () => controls.stop();
  }, [inView, value, duration, decimals, reduce, mv]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {display}
      {suffix}
    </span>
  );
}
