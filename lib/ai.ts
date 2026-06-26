import { createGoogleGenerativeAI } from "@ai-sdk/google";

/**
 * AI SDK Google provider for the durable rescue agent (agent/rescueWorkflow.ts).
 *
 * We pass the existing server-side `GEMINI_API_KEY` explicitly so nothing needs
 * renaming to `GOOGLE_GENERATIVE_AI_API_KEY` and no Vercel AI Gateway auth is
 * required — the key stays server-side (CLAUDE.md §2/§8). The model id is
 * swappable; `gemini-2.5-flash` is what the legacy route already runs stably.
 */
const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export const AGENT_MODEL_ID = "gemini-2.5-flash";

/** A LanguageModel for the AI SDK's generateText/generateObject (inside steps). */
export function getModel(id: string = AGENT_MODEL_ID) {
  return google(id);
}
