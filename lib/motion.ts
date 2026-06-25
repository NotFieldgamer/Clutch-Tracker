import { useReducedMotion, type Transition, type Variants } from "framer-motion";

/**
 * Shared motion language (DESIGN.md §4).
 * Motion's job here is to resolve pressure into calm — spring physics, not
 * linear easing. Import these everywhere so timing stays consistent.
 *
 * No "use client" here on purpose: the constants are plain data usable from
 * server components; the `useReduced` hook is only ever called inside client
 * components.
 */

/** Core springs. */
export const spring: { entrance: Transition; layout: Transition } = {
  /** entrances — soft settle */
  entrance: { type: "spring", stiffness: 300, damping: 30 },
  /** layout reordering — snappier */
  layout: { type: "spring", stiffness: 500, damping: 40 },
};

/** The "rescue ease" — heat eases toward calm over ~700ms (DESIGN.md §4.2). */
export const rescueEase: Transition = { duration: 0.7, ease: [0.22, 1, 0.36, 1] };

/** Staggered page-load container (DESIGN.md §4.1). */
export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};

/** Child reveal — fade up into place. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: spring.entrance },
};

/** Activity-rail line entrance (DESIGN.md §4.4). */
export const railItem: Variants = {
  hidden: { opacity: 0, x: -8 },
  show: { opacity: 1, x: 0, transition: spring.entrance },
};

/* Reduced-motion-safe counterparts — opacity only, no transform. */
const fadeOnly: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.2 } },
};
const staggerFade: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.03 } },
};

/**
 * Returns motion variants that respect the user's reduced-motion preference:
 * full spring + transform motion normally, gentle opacity fades when reduced.
 * Use the returned `prefersReduced` flag to drop ambient drift / big moves.
 */
export function useReduced() {
  const prefersReduced = useReducedMotion() ?? false;
  return {
    prefersReduced,
    stagger: prefersReduced ? staggerFade : staggerContainer,
    fadeUp: prefersReduced ? fadeOnly : fadeUp,
    railItem: prefersReduced ? fadeOnly : railItem,
  };
}
