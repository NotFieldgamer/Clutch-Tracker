import { DurableAgent } from "@workflow/ai/agent";
import { getWritable } from "workflow";
import { z } from "zod";
import type { UIMessageChunk } from "ai";
import { extractFinalText } from "@/lib/messages";
import { CLUTCH_SYSTEM_INSTRUCTION } from "@/lib/systemPrompt";
import {
  type RescueCtx,
  rescueModelStep,
  prioritizeStep,
  decomposeStep,
  findSlotsStep,
  scheduleBlockStep,
  generateArtifactStep,
  draftCommStep,
  setNudgeStep,
  finalizeStep,
} from "@/agent/steps";

export interface RescueInput {
  goal: string;
  tasks: Array<{
    id: string;
    title: string;
    type: string;
    percentDone: number;
    deadlineISO: string;
    importance: number;
  }>;
  userId: string | null;
  calendarToken: string | null;
}

/**
 * The durable rescue (CLAUDE.md §4/§5). A DurableAgent drives the perceive→plan→
 * act→observe loop; each tool is a workflow step (retry + DB persistence), so the
 * rescue survives past the 60s serverless limit and a mid-flight interruption.
 * Tools stream their progress to the "rail" namespace (lib/rail.ts); the agent's
 * own UIMessageChunk output goes to the default stream (not shown to the client).
 */
export async function rescueWorkflow(input: RescueInput) {
  "use workflow";

  const ctx: RescueCtx = { userId: input.userId, calendarToken: input.calendarToken };

  const agent = new DurableAgent({
    model: rescueModelStep,
    instructions: CLUTCH_SYSTEM_INSTRUCTION,
    tools: {
      prioritize: {
        description: "Rank the user's current tasks by risk of missing the deadline.",
        inputSchema: z.object({}),
        execute: (args: Record<string, never>) => prioritizeStep(args, ctx),
      },
      decompose_task: {
        description: "Break a task into 3-6 ordered sub-steps with minute estimates.",
        inputSchema: z.object({ taskId: z.string() }),
        execute: (args: { taskId: string }) => decomposeStep(args, ctx),
      },
      find_free_slots: {
        description: "Find free calendar slots for work blocks up to a date.",
        inputSchema: z.object({
          durationMin: z.number(),
          byISO: z.string().describe("usually the deadline"),
        }),
        execute: (args: { durationMin: number; byISO: string }) => findSlotsStep(args, ctx),
      },
      schedule_block: {
        description: "Create a real work-block event in Google Calendar.",
        inputSchema: z.object({
          taskId: z.string(),
          startISO: z.string(),
          endISO: z.string(),
          title: z.string(),
        }),
        execute: (args: { taskId: string; startISO: string; endISO: string; title: string }) =>
          scheduleBlockStep(args, ctx),
      },
      generate_artifact: {
        description: "Produce a real artifact: outline | draft | prep | note.",
        inputSchema: z.object({ taskId: z.string(), kind: z.string() }),
        execute: (args: { taskId: string; kind: string }) => generateArtifactStep(args, ctx),
      },
      draft_communication: {
        description: "Draft a ready-to-send email: extension | reschedule | followup.",
        inputSchema: z.object({
          taskId: z.string(),
          kind: z.string(),
          context: z.string().optional(),
        }),
        execute: (args: { taskId: string; kind: string; context?: string }) => draftCommStep(args, ctx),
      },
      set_smart_nudge: {
        description: "Set an escalating reminder as a backstop (use sparingly).",
        inputSchema: z.object({
          taskId: z.string(),
          whenISO: z.string(),
          message: z.string(),
        }),
        execute: (args: { taskId: string; whenISO: string; message: string }) => setNudgeStep(args, ctx),
      },
    },
  });

  const taskSummary = input.tasks
    .map(
      (t) =>
        `- ${t.id}: "${t.title}" type=${t.type} done=${t.percentDone}% due=${t.deadlineISO} importance=${t.importance}`,
    )
    .join("\n");

  let finalText = "";
  try {
    const result = await agent.stream({
      messages: [{ role: "user", content: `${input.goal}\n\nCurrent tasks:\n${taskSummary}` }],
      writable: getWritable<UIMessageChunk>(),
      maxSteps: 16,
    });
    finalText = extractFinalText(result.messages) || "Rescue complete — here's what I did.";
  } catch {
    // Steps already persisted whatever finished; deliver an honest partial summary.
    finalText =
      "The rescue stopped early — what got done is saved below. Run it again to finish the rest.";
  }

  // Emit the de-escalated tasks + summary on the rail, then close it.
  await finalizeStep(input.userId, finalText);
  return { finalText };
}
