"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * AmbientBg — the living atmosphere behind the app (DESIGN.md §4).
 *
 * Two very slow-drifting radial gradients (one --agent violet, one --calm green)
 * at ~6% opacity over --ink, plus a faint grain overlay. A quiet living
 * atmosphere, not a busy aurora. The drift pauses under prefers-reduced-motion;
 * the gradients stay (no movement). Purely decorative — aria-hidden,
 * pointer-events-none, never intercepts focus or clicks.
 */
export default function AmbientBg() {
  const reduce = useReducedMotion();

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ background: "var(--ink)" }}
    >
      {/* agent violet — drifts in the upper-left */}
      <motion.div
        className="absolute -left-[12%] -top-[18%] h-[65vmax] w-[65vmax] rounded-full blur-[130px]"
        style={{
          background:
            "radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 60%)",
        }}
        animate={reduce ? undefined : { x: ["-3%", "5%", "-3%"], y: ["-2%", "4%", "-2%"] }}
        transition={
          reduce
            ? undefined
            : { duration: 26, ease: "easeInOut", repeat: Infinity, repeatType: "mirror" }
        }
      />

      {/* calm green — drifts in the lower-right */}
      <motion.div
        className="absolute -bottom-[22%] -right-[12%] h-[60vmax] w-[60vmax] rounded-full blur-[130px]"
        style={{
          background:
            "radial-gradient(circle, rgba(52,211,153,0.055) 0%, transparent 60%)",
        }}
        animate={reduce ? undefined : { x: ["3%", "-5%", "3%"], y: ["2%", "-4%", "2%"] }}
        transition={
          reduce
            ? undefined
            : { duration: 34, ease: "easeInOut", repeat: Infinity, repeatType: "mirror" }
        }
      />

      {/* faint grain — static, very low opacity */}
      <div
        className="absolute inset-0 opacity-[0.04] mix-blend-soft-light"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  );
}
