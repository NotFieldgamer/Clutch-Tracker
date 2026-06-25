import { Task } from "./types";

// Higher score = more urgent to rescue. Pure, deterministic, explainable.
export function riskScore(task: Task, now = new Date()): { score: number; reason: string } {
  const hoursLeft = Math.max(0, (new Date(task.deadlineISO).getTime() - now.getTime()) / 36e5);

  const urgency = 1 / (1 + hoursLeft / 24);                               // ~1 at 0h, falls off over days
  const importance = Math.min(5, Math.max(1, task.importance)) / 5;       // 0.2..1
  const remaining = Math.min(100, Math.max(0, 100 - task.percentDone)) / 100; // 0..1

  // Blend, then amplify by how much work is left.
  const score = (0.55 * urgency + 0.30 * importance + 0.15 * remaining) * (0.7 + 0.3 * remaining);

  const bits: string[] = [];
  if (hoursLeft <= 24) bits.push("due within a day");
  else if (hoursLeft <= 72) bits.push("due within 3 days");
  if (importance >= 0.8) bits.push("high importance");
  if (remaining >= 0.75) bits.push("barely started");

  return { score: Number(score.toFixed(4)), reason: bits.join(", ") || "on track" };
}

export function rankByRisk(tasks: Task[], now = new Date()) {
  return tasks
    .map(t => { const r = riskScore(t, now); return { ...t, _risk: r.score, _reason: r.reason }; })
    .sort((a, b) => b._risk - a._risk);
}
