import type { ModelMessage } from "ai";

/**
 * Pull the agent's closing summary out of the final AI SDK message history.
 * Pure + deterministic so it's safe to call inside a "use workflow" function
 * (and easy to unit-test). Returns "" when there's no assistant text.
 */
export function extractFinalText(messages: ModelMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "assistant") continue;
    if (typeof m.content === "string") return m.content;
    if (Array.isArray(m.content)) {
      const text = m.content
        .filter((p): p is { type: "text"; text: string } => (p as { type?: string }).type === "text")
        .map((p) => p.text)
        .join(" ")
        .trim();
      if (text) return text;
    }
  }
  return "";
}
