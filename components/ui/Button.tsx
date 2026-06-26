"use client";

import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";

type Variant = "primary" | "ghost" | "subtle";

interface ButtonProps extends HTMLMotionProps<"button"> {
  variant?: Variant;
}

const VARIANT: Record<Variant, string> = {
  // primary is the agent's CTA — violet --agent (bg set inline) + glow on hover
  primary: "text-white",
  ghost: "border border-line text-text hover:bg-white/[0.05]",
  subtle: "text-muted hover:text-text",
};

/**
 * Button (DESIGN.md §4.5) — primary / ghost / subtle.
 * whileHover {y:-2} (+ soft --agent-glow on the primary CTA), whileTap
 * {scale:0.98}, and a visible --ring focus state. Micro, never noisy.
 */
export default function Button({
  variant = "primary",
  className = "",
  children,
  ...rest
}: ButtonProps) {
  const isPrimary = variant === "primary";
  const reduce = useReducedMotion();

  return (
    <motion.button
      whileHover={
        reduce
          ? undefined
          : isPrimary
            ? { y: -2, boxShadow: "0 10px 30px var(--agent-glow)" }
            : { y: -2 }
      }
      whileTap={reduce ? undefined : { scale: 0.98 }}
      className={
        // min-h-[44px] keeps the touch target ≥44px (DESIGN.md §8 quality floor).
        "inline-flex min-h-[44px] select-none items-center justify-center gap-2 rounded-[var(--radius-sm)] " +
        "px-4 py-2.5 text-sm font-medium outline-none transition-colors " +
        "focus-visible:ring-2 focus-visible:ring-[var(--ring)] " +
        "disabled:pointer-events-none disabled:opacity-50 " +
        `${VARIANT[variant]} ${className}`
      }
      style={isPrimary ? { backgroundColor: "var(--agent-cta)" } : undefined}
      {...rest}
    >
      {children}
    </motion.button>
  );
}
