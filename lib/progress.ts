import type { SubStep } from "./types";

/**
 * Percent of a task's work done, derived from its sub-steps (checked / total).
 * Once the agent has decomposed a task, "how far along am I" == how many
 * sub-steps are checked — so ticking a box moves the number. Returns 0 when a
 * task has no sub-steps yet (nothing to measure against).
 */
export function progressFromSteps(subSteps: Pick<SubStep, "done">[]): number {
  if (subSteps.length === 0) return 0;
  const done = subSteps.filter((s) => s.done).length;
  return Math.round((done / subSteps.length) * 100);
}
