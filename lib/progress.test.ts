import { describe, it, expect } from "vitest";
import { progressFromSteps } from "./progress";

describe("progressFromSteps", () => {
  it("is 0 when there are no sub-steps", () => {
    expect(progressFromSteps([])).toBe(0);
  });

  it("is 0 when nothing is checked", () => {
    expect(progressFromSteps([{ done: false }, { done: false }])).toBe(0);
  });

  it("reaches 100 when every sub-step is checked", () => {
    expect(
      progressFromSteps([{ done: true }, { done: true }, { done: true }]),
    ).toBe(100);
  });

  it("reports partial completion, rounded", () => {
    // 1 of 3 → 33%
    expect(progressFromSteps([{ done: true }, { done: false }, { done: false }])).toBe(33);
    // 2 of 3 → 67%
    expect(progressFromSteps([{ done: true }, { done: true }, { done: false }])).toBe(67);
    // 3 of 5 → 60%
    expect(
      progressFromSteps([
        { done: true },
        { done: true },
        { done: true },
        { done: false },
        { done: false },
      ]),
    ).toBe(60);
  });
});
