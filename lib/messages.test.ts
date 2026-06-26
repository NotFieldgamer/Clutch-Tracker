import { describe, it, expect } from "vitest";
import type { ModelMessage } from "ai";
import { extractFinalText } from "./messages";

describe("extractFinalText", () => {
  it("returns the last assistant string content", () => {
    const msgs = [
      { role: "user", content: "rescue my week" },
      { role: "assistant", content: "Decomposed 3 tasks and drafted an email." },
    ] as ModelMessage[];
    expect(extractFinalText(msgs)).toBe("Decomposed 3 tasks and drafted an email.");
  });

  it("joins the text parts of array content, ignoring tool parts", () => {
    const msgs = [
      {
        role: "assistant",
        content: [
          { type: "text", text: "Scheduled" },
          { type: "tool-call", toolName: "schedule_block" },
          { type: "text", text: "two blocks." },
        ],
      },
    ] as unknown as ModelMessage[];
    expect(extractFinalText(msgs)).toBe("Scheduled two blocks.");
  });

  it("finds the LAST assistant message, skipping trailing non-assistant ones", () => {
    const msgs = [
      { role: "assistant", content: "first" },
      { role: "assistant", content: "second" },
      { role: "tool", content: "tool output" },
    ] as unknown as ModelMessage[];
    expect(extractFinalText(msgs)).toBe("second");
  });

  it("returns an empty string when there is no assistant text", () => {
    const msgs = [{ role: "user", content: "hi" }] as ModelMessage[];
    expect(extractFinalText(msgs)).toBe("");
  });
});
