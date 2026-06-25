import type { TaskDTO } from "./types";

/**
 * PLACEHOLDER risk model — replaced by the LOGIC_SNIPPETS.md version in the
 * next step (CLAUDE.md §5). Kept deliberately simple but plausible so the heat
 * scale reads true in the meantime.
 *
 * risk ≈ deadline-proximity × importance × % remaining, squashed to 0..1.
 */

type RiskInput = Pick<TaskDTO, "deadlineISO" | "importance" | "percentDone">;

const DAY_MS = 86_400_000;

function daysUntil(deadlineISO: string, now: number): number {
  return (new Date(deadlineISO).getTime() - now) / DAY_MS;
}

export function riskScore(task: RiskInput, now: number = Date.now()): number {
  const days = daysUntil(task.deadlineISO, now);

  // urgency: 1 when overdue/now, decaying toward ~0 two weeks out
  let urgency: number;
  if (days <= 0) urgency = 1;
  else if (days >= 14) urgency = 0.06;
  else urgency = Math.min(1, 1 / (1 + days * 0.5));

  const importanceW = Math.min(5, Math.max(1, task.importance)) / 5; // 0.2..1
  const remaining = 1 - Math.min(100, Math.max(0, task.percentDone)) / 100; // 0..1

  const score = urgency * (0.45 + 0.55 * importanceW) * (0.35 + 0.65 * remaining);
  return Math.max(0, Math.min(1, score));
}

/** Plain-language reason shown next to the RiskMeter (DESIGN.md §6). */
export function riskReason(task: RiskInput, now: number = Date.now()): string {
  const ms = new Date(task.deadlineISO).getTime() - now;
  const days = Math.round(ms / DAY_MS);

  let when: string;
  if (ms <= 0) when = "Overdue";
  else if (days <= 0) when = "Due today";
  else if (days === 1) when = "Due tomorrow";
  else if (days <= 6) when = `Due in ${days} days`;
  else when = `Due in ${Math.round(days / 7)} wk`;

  const pct = Math.min(100, Math.max(0, task.percentDone));
  const progress =
    pct >= 100 ? "done" : pct <= 0 ? "not started" : `${100 - pct}% left`;

  const heavy = task.importance >= 4 ? " · high stakes" : "";
  return `${when} · ${progress}${heavy}`;
}
