import { describe, it, expect } from "vitest";
import { riskScore, rankByRisk } from "./riskScore";
import type { Task } from "./types";

const HOUR = 36e5;
const now = new Date("2026-06-26T12:00:00Z");

function task(partial: Partial<Task>): Task {
  return {
    id: "t",
    title: "T",
    deadlineISO: new Date(now.getTime() + 48 * HOUR).toISOString(),
    importance: 3,
    percentDone: 0,
    type: "assignment",
    subSteps: [],
    blocks: [],
    artifacts: [],
    ...partial,
  };
}

describe("riskScore", () => {
  it("scores a sooner deadline as riskier than a later one", () => {
    const soon = riskScore(task({ deadlineISO: new Date(now.getTime() + 6 * HOUR).toISOString() }), now).score;
    const later = riskScore(task({ deadlineISO: new Date(now.getTime() + 240 * HOUR).toISOString() }), now).score;
    expect(soon).toBeGreaterThan(later);
  });

  it("explains urgency in plain language ('due within a day')", () => {
    const r = riskScore(task({ deadlineISO: new Date(now.getTime() + 5 * HOUR).toISOString() }), now);
    expect(r.reason).toContain("due within a day");
  });

  it("keeps the score within [0,1] even for an overdue, max-importance task", () => {
    const r = riskScore(
      task({ deadlineISO: new Date(now.getTime() - HOUR).toISOString(), importance: 5, percentDone: 0 }),
      now,
    );
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(1);
  });

  it("ranks an urgent, barely-started, high-importance task above a calm one", () => {
    const ranked = rankByRisk(
      [
        task({ id: "calm", deadlineISO: new Date(now.getTime() + 240 * HOUR).toISOString(), importance: 1, percentDone: 90 }),
        task({ id: "urgent", deadlineISO: new Date(now.getTime() + 3 * HOUR).toISOString(), importance: 5, percentDone: 0 }),
      ],
      now,
    );
    expect(ranked[0].id).toBe("urgent");
  });
});
