import { GoogleGenAI } from "@google/genai";
import { CLUTCH_SYSTEM_INSTRUCTION } from "../lib/systemPrompt";
import { functionDeclarations, executeTool, ToolCtx } from "./tools";
import { Task, ActionLogEntry } from "../lib/types";

export interface RescueResult { finalText: string; actionLog: ActionLogEntry[]; tasks: Task[]; }

export async function runRescue(opts: {
  ai: GoogleGenAI;
  tasks: Task[];
  goal: string;
  getAccessToken: () => string | null;
  onLog?: (e: ActionLogEntry) => void; // for the live Activity Feed
  model?: string;
  maxTurns?: number;
}): Promise<RescueResult> {
  const model = opts.model ?? "gemini-3.5-flash";
  const actionLog: ActionLogEntry[] = [];
  const log = (e: Omit<ActionLogEntry, "id" | "at">) => {
    const entry: ActionLogEntry = { ...e, id: Math.random().toString(36).slice(2, 9), at: new Date().toISOString() };
    actionLog.push(entry); opts.onLog?.(entry);
  };
  const ctx: ToolCtx = { ai: opts.ai, model, tasks: opts.tasks, getAccessToken: opts.getAccessToken, log };

  // Seed the model with the current task list so it can reason about ids and deadlines.
  const taskSummary = opts.tasks.map(t =>
    `- ${t.id}: "${t.title}" type=${t.type} done=${t.percentDone}% due=${t.deadlineISO} importance=${t.importance}`
  ).join("\n");

  const contents: any[] = [{ role: "user", parts: [{ text: `${opts.goal}\n\nCurrent tasks:\n${taskSummary}` }] }];
  const maxTurns = opts.maxTurns ?? 8;

  for (let turn = 0; turn < maxTurns; turn++) {
    const res = await opts.ai.models.generateContent({
      model, contents,
      config: { systemInstruction: CLUTCH_SYSTEM_INSTRUCTION, tools: [{ functionDeclarations }] },
    });

    const calls = res.functionCalls ?? [];
    if (calls.length === 0) return { finalText: res.text ?? "", actionLog, tasks: ctx.tasks };

    // SDK drift fix: echo the model's exact turn back so the thoughtSignature on
    // each functionCall part is preserved. Current Gemini models reject history
    // that drops it ("missing thought_signature" 400). Falls back to a
    // reconstructed part if the candidate content is unavailable.
    const modelContent = res.candidates?.[0]?.content;
    contents.push(
      modelContent ?? { role: "model", parts: calls.map((c: any) => ({ functionCall: { name: c.name, args: c.args } })) },
    );
    for (const call of calls) {
      // SDK: FunctionCall.name is optional (string | undefined) — guard for strict TS.
      const result = await executeTool(call.name ?? "", call.args ?? {}, ctx);
      contents.push({ role: "user", parts: [{ functionResponse: { name: call.name, response: { result } } }] });
    }
  }
  return { finalText: "Rescue hit its step limit — review the actions taken.", actionLog, tasks: ctx.tasks };
}
