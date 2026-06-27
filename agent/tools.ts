import { Type, FunctionDeclaration, GoogleGenAI } from "@google/genai";
import { Task, SubStep, Artifact, ActionLogEntry } from "../lib/types";
import { rankByRisk } from "../lib/riskScore";
import { findFreeSlots, createCalendarEvent } from "../lib/google/calendar";

export const functionDeclarations: FunctionDeclaration[] = [
  { name: "prioritize", description: "Rank the user's current tasks by risk of missing the deadline.",
    parameters: { type: Type.OBJECT, properties: {} } },
  { name: "decompose_task", description: "Break a task into 3-6 ordered sub-steps with minute estimates.",
    parameters: { type: Type.OBJECT, properties: { taskId: { type: Type.STRING } }, required: ["taskId"] } },
  { name: "find_free_slots", description: "Find free calendar slots for work blocks up to a date.",
    parameters: { type: Type.OBJECT, properties: {
      durationMin: { type: Type.NUMBER }, byISO: { type: Type.STRING, description: "usually the deadline" }
    }, required: ["durationMin", "byISO"] } },
  { name: "schedule_block", description: "Create a real work-block event in Google Calendar.",
    parameters: { type: Type.OBJECT, properties: {
      taskId: { type: Type.STRING }, startISO: { type: Type.STRING }, endISO: { type: Type.STRING }, title: { type: Type.STRING }
    }, required: ["taskId", "startISO", "endISO", "title"] } },
  { name: "generate_artifact", description: "Produce a real artifact: outline | draft | prep | note.",
    parameters: { type: Type.OBJECT, properties: {
      taskId: { type: Type.STRING }, kind: { type: Type.STRING }
    }, required: ["taskId", "kind"] } },
  { name: "draft_communication", description: "Draft a ready-to-send email: extension | reschedule | followup.",
    parameters: { type: Type.OBJECT, properties: {
      taskId: { type: Type.STRING }, kind: { type: Type.STRING }, context: { type: Type.STRING }
    }, required: ["taskId", "kind"] } },
  { name: "set_smart_nudge", description: "Set an escalating reminder as a backstop (use sparingly).",
    parameters: { type: Type.OBJECT, properties: {
      taskId: { type: Type.STRING }, whenISO: { type: Type.STRING }, message: { type: Type.STRING }
    }, required: ["taskId", "whenISO", "message"] } },
];

export interface ToolCtx {
  ai: GoogleGenAI;
  model: string;
  tasks: Task[];
  getAccessToken: () => string | null;
  timeZone: string | null; // user's IANA zone for working-hours gating
  log: (e: Omit<ActionLogEntry, "id" | "at">) => void;
}

const uid = () => Math.random().toString(36).slice(2, 9);
const find = (tasks: Task[], id: string) => tasks.find(t => t.id === id);
const fmt = (iso: string) => { try { return new Date(iso).toLocaleString(); } catch { return iso; } };
function safeJson(text?: string): any {
  if (!text) return null;
  const t = text.replace(/```json|```/gi, "").trim();
  try { return JSON.parse(t); } catch { /* fall through to extraction */ }
  // Fallback: pull the first {...} or [...] block out of any surrounding prose,
  // so a model that ignores "return ONLY JSON" still parses instead of yielding null.
  const m = t.match(/[{[][\s\S]*[}\]]/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* give up */ } }
  return null;
}
function artifactPrompt(kind: string, title: string): string {
  if (kind === "prep") return `Write 5 focused interview-prep questions (with 1-line answer hints) for: "${title}".`;
  if (kind === "outline") return `Write a clear, structured outline for: "${title}".`;
  if (kind === "draft") return `Write a strong first-draft opening section (150-250 words) for: "${title}".`;
  return `Write a concise, helpful note to make progress on: "${title}".`;
}

export async function executeTool(name: string, args: any, ctx: ToolCtx): Promise<any> {
  try {
    switch (name) {
      case "prioritize": {
        const ranked = rankByRisk(ctx.tasks).map(t => ({ id: t.id, title: t.title, risk: t._risk, reason: t._reason }));
        ctx.log({ tool: name, summary: `Ranked ${ranked.length} tasks by risk`, ok: true });
        return { ranked };
      }
      case "decompose_task": {
        const task = find(ctx.tasks, args.taskId); if (!task) throw new Error("task not found");
        // Force schema-constrained JSON (same as /api/parse) so the model can't
        // return prose-wrapped JSON that fails to parse and silently yields 0 steps.
        const res = await ctx.ai.models.generateContent({
          model: ctx.model,
          contents: `Break this into 3-6 ordered sub-steps with realistic minute estimates.
Task "${task.title}" (type ${task.type}, ${task.percentDone}% done, due ${task.deadlineISO}).`,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                steps: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: { title: { type: Type.STRING }, effortMin: { type: Type.NUMBER } },
                    required: ["title", "effortMin"],
                  },
                },
              },
              required: ["steps"],
            },
          },
        });
        const raw = safeJson(res.text);
        const steps: SubStep[] = (Array.isArray(raw?.steps) ? raw.steps : [])
          .filter((s: any) => s && typeof s.title === "string" && s.title.trim())
          .map((s: any) => ({
            id: uid(),
            title: String(s.title).trim(),
            effortMin: Number(s.effortMin) > 0 ? Math.round(Number(s.effortMin)) : 30,
            done: false,
          }));
        if (steps.length === 0) {
          // Never report "→ 0 steps" as a success — surface it honestly so the
          // rail is truthful and the agent can re-plan/retry.
          ctx.log({ tool: name, summary: `Couldn't break down "${task.title}" — no steps returned`, ok: false });
          return { error: "no steps produced" };
        }
        task.subSteps = steps;
        ctx.log({ tool: name, summary: `Decomposed "${task.title}" → ${steps.length} steps`, ok: true });
        return { steps };
      }
      case "find_free_slots": {
        const token = ctx.getAccessToken(); if (!token) throw new Error("calendar not connected");
        const slots = await findFreeSlots(token, args.durationMin, args.byISO, {
          timeZone: ctx.timeZone ?? undefined,
        });
        ctx.log({ tool: name, summary: `Found ${slots.length} free ${args.durationMin}-min slots`, ok: true });
        return { slots };
      }
      case "schedule_block": {
        const token = ctx.getAccessToken(); if (!token) throw new Error("calendar not connected");
        // Guard BEFORE creating a real event so a bad taskId can't leave an orphan
        // calendar event the app never records.
        const task = find(ctx.tasks, args.taskId); if (!task) throw new Error("task not found");
        const ev = await createCalendarEvent(token, args.title, args.startISO, args.endISO, ctx.timeZone ?? undefined);
        // Dedupe by start so repeated rescues don't stack duplicate work-blocks.
        task.blocks = task.blocks.filter((b) => b.startISO !== args.startISO);
        task.blocks.push({ id: uid(), taskId: task.id, startISO: args.startISO, endISO: args.endISO, title: args.title, calendarEventId: ev.id });
        ctx.log({ tool: name, summary: `Scheduled "${args.title}" ${fmt(args.startISO)}`, ok: true });
        return { eventId: ev.id, htmlLink: ev.htmlLink };
      }
      case "generate_artifact": {
        const task = find(ctx.tasks, args.taskId); if (!task) throw new Error("task not found");
        const res = await ctx.ai.models.generateContent({ model: ctx.model, contents: artifactPrompt(args.kind, task.title) });
        const art: Artifact = { id: uid(), taskId: task.id, kind: args.kind, content: res.text ?? "" };
        // Dedupe by kind — re-running a rescue replaces this artifact, never stacks it.
        task.artifacts = task.artifacts.filter((a) => a.kind !== args.kind);
        task.artifacts.push(art);
        ctx.log({ tool: name, summary: `Generated ${args.kind} for "${task.title}"`, ok: true });
        return { artifact: { kind: art.kind, content: art.content } };
      }
      case "draft_communication": {
        const task = find(ctx.tasks, args.taskId);
        const res = await ctx.ai.models.generateContent({
          model: ctx.model,
          contents: `Write a brief, polite ${args.kind} email about "${task?.title ?? "a task"}".
${args.context ? "Context: " + args.context : ""}`,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: { subject: { type: Type.STRING }, body: { type: Type.STRING } },
              required: ["subject", "body"],
            },
          },
        });
        const p = safeJson(res.text) ?? { subject: "Quick note", body: res.text ?? "" };
        if (task) {
          task.artifacts = task.artifacts.filter((a) => a.kind !== "email");
          task.artifacts.push({ id: uid(), taskId: task.id, kind: "email", content: `Subject: ${p.subject}\n\n${p.body}` });
        }
        ctx.log({ tool: name, summary: `Drafted ${args.kind} email for "${task?.title ?? ""}"`, ok: true });
        return p;
      }
      case "set_smart_nudge": {
        const task = find(ctx.tasks, args.taskId);
        if (task) {
          task.artifacts = task.artifacts.filter((a) => a.kind !== "note");
          task.artifacts.push({ id: uid(), taskId: task.id, kind: "note", content: `Nudge @ ${args.whenISO}: ${args.message}` });
        }
        ctx.log({ tool: name, summary: `Set nudge for "${task?.title ?? ""}" at ${fmt(args.whenISO)}`, ok: true });
        return { ok: true };
      }
      default: throw new Error("unknown tool: " + name);
    }
  } catch (err: any) {
    ctx.log({ tool: name, summary: `${name} failed: ${err.message}`, ok: false });
    return { error: err.message };
  }
}
