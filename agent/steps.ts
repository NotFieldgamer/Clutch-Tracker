import { generateObject, generateText } from "ai";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getModel } from "@/lib/ai";
import { rankByRisk } from "@/lib/riskScore";
import { findFreeSlots, createCalendarEvent } from "@/lib/google/calendar";
import { railLog, railDone, railClose } from "@/lib/rail";
import type { Task } from "@/lib/types";

/**
 * The durable tool steps for the rescue agent (agent/rescueWorkflow.ts). Each is a
 * `"use step"` function — full Node access, automatic retry, persisted for replay.
 *
 * Unlike the legacy in-memory loop (agent/tools.ts), these write straight to the
 * database scoped to the signed-in user (defense-in-depth IDOR guard) and DEDUPE,
 * so re-running a rescue REPLACES a task's sub-steps/artifacts instead of stacking
 * duplicates (fixes a known issue). State lives in the DB, not a shared array.
 */
export interface RescueCtx {
  userId: string | null;
  calendarToken: string | null;
}

const ARTIFACT_TITLE: Record<string, string> = {
  outline: "Outline",
  draft: "First draft",
  email: "Email draft",
  prep: "Prep questions",
  note: "Note",
};

function artifactPrompt(kind: string, title: string): string {
  if (kind === "prep") return `Write 5 focused interview-prep questions (with 1-line answer hints) for: "${title}".`;
  if (kind === "outline") return `Write a clear, structured outline for: "${title}".`;
  if (kind === "draft") return `Write a strong first-draft opening section (150-250 words) for: "${title}".`;
  return `Write a concise, helpful note to make progress on: "${title}".`;
}

/**
 * The model as a `"use step"` function. The DurableAgent passes `model` into its
 * internal stream step, so it must be a registered step (referenced by id) rather
 * than a raw closure — otherwise the runtime tries to serialize the function and
 * fails ("Failed to serialize step arguments"). Mirrors @workflow/ai's own
 * provider wrappers, but keeps our explicit GEMINI_API_KEY (lib/ai.ts).
 */
export async function rescueModelStep() {
  "use step";
  return getModel();
}

/** Load a single task scoped to the user (null userId = no-auth path → any task). */
async function loadTaskRow(taskId: string, userId: string | null) {
  return prisma.task.findFirst({
    where: { id: taskId, ...(userId ? { userId } : {}) },
  });
}

// ── tools ──────────────────────────────────────────────────────────────────

export async function prioritizeStep(_args: Record<string, never>, ctx: RescueCtx) {
  "use step";
  const rows = await prisma.task.findMany({
    where: ctx.userId ? { userId: ctx.userId } : {},
  });
  const asTasks: Task[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    deadlineISO: r.deadline.toISOString(),
    importance: r.importance,
    percentDone: r.percentDone,
    type: r.type as Task["type"],
    subSteps: [],
    blocks: [],
    artifacts: [],
  }));
  const ranked = rankByRisk(asTasks).map((t) => ({
    id: t.id,
    title: t.title,
    risk: t._risk,
    reason: t._reason,
  }));
  await railLog({ tool: "prioritize", summary: `Ranked ${ranked.length} tasks by risk`, ok: true });
  return { ranked };
}

export async function decomposeStep(args: { taskId: string }, ctx: RescueCtx) {
  "use step";
  const task = await loadTaskRow(args.taskId, ctx.userId);
  if (!task) {
    await railLog({ tool: "decompose_task", summary: "decompose: task not found", ok: false });
    return { error: "task not found" };
  }
  const { object } = await generateObject({
    model: getModel(),
    schema: z.object({
      steps: z.array(z.object({ title: z.string(), effortMin: z.number() })).min(1),
    }),
    prompt: `Break this into 3-6 ordered sub-steps with realistic minute estimates.
Task "${task.title}" (type ${task.type}, ${task.percentDone}% done, due ${task.deadline.toISOString()}).`,
  });
  const steps = object.steps.slice(0, 8);
  // Replace (dedupe) — re-running a rescue regenerates the plan, never stacks it.
  await prisma.$transaction([
    prisma.subStep.deleteMany({ where: { taskId: task.id } }),
    prisma.subStep.createMany({
      data: steps.map((s, i) => ({
        taskId: task.id,
        title: s.title,
        effortMin: Math.max(0, Math.round(Number(s.effortMin) || 30)),
        order: i,
      })),
    }),
  ]);
  await railLog({
    tool: "decompose_task",
    summary: `Decomposed "${task.title}" → ${steps.length} steps`,
    ok: true,
    taskId: task.id,
  });
  return { steps };
}

export async function findSlotsStep(args: { durationMin: number; byISO: string }, ctx: RescueCtx) {
  "use step";
  if (!ctx.calendarToken) {
    await railLog({ tool: "find_free_slots", summary: "find_free_slots: calendar not connected", ok: false });
    return { error: "calendar not connected", slots: [] };
  }
  const slots = await findFreeSlots(ctx.calendarToken, args.durationMin, args.byISO);
  await railLog({
    tool: "find_free_slots",
    summary: `Found ${slots.length} free ${args.durationMin}-min slots`,
    ok: true,
  });
  return { slots };
}

export async function scheduleBlockStep(
  args: { taskId: string; startISO: string; endISO: string; title: string },
  ctx: RescueCtx,
) {
  "use step";
  if (!ctx.calendarToken) {
    await railLog({ tool: "schedule_block", summary: "schedule_block: calendar not connected", ok: false });
    return { error: "calendar not connected" };
  }
  const task = await loadTaskRow(args.taskId, ctx.userId);
  if (!task) {
    await railLog({ tool: "schedule_block", summary: "schedule_block: task not found", ok: false });
    return { error: "task not found" };
  }
  const ev = await createCalendarEvent(ctx.calendarToken, args.title, args.startISO, args.endISO);
  const start = new Date(args.startISO);
  // Dedupe by (taskId, start) so repeated rescues don't stack work-blocks.
  const existing = await prisma.block.findFirst({ where: { taskId: task.id, start } });
  if (existing) {
    await prisma.block.update({
      where: { id: existing.id },
      data: { title: args.title, end: new Date(args.endISO), calendarEventId: ev.id, status: "scheduled" },
    });
  } else {
    await prisma.block.create({
      data: {
        taskId: task.id,
        title: args.title,
        start,
        end: new Date(args.endISO),
        calendarEventId: ev.id,
        status: "scheduled",
      },
    });
  }
  await railLog({
    tool: "schedule_block",
    summary: `Scheduled "${args.title}" ${new Date(args.startISO).toLocaleString()}`,
    ok: true,
    taskId: task.id,
  });
  return { eventId: ev.id, htmlLink: ev.htmlLink };
}

export async function generateArtifactStep(args: { taskId: string; kind: string }, ctx: RescueCtx) {
  "use step";
  const task = await loadTaskRow(args.taskId, ctx.userId);
  if (!task) {
    await railLog({ tool: "generate_artifact", summary: "generate_artifact: task not found", ok: false });
    return { error: "task not found" };
  }
  const { text } = await generateText({
    model: getModel(),
    prompt: artifactPrompt(args.kind, task.title),
  });
  // Dedupe by (taskId, kind) — replace this kind of artifact rather than stack it.
  await prisma.artifact.deleteMany({ where: { taskId: task.id, kind: args.kind } });
  await prisma.artifact.create({
    data: {
      taskId: task.id,
      kind: args.kind,
      title: ARTIFACT_TITLE[args.kind] ?? "Artifact",
      content: text,
    },
  });
  await railLog({
    tool: "generate_artifact",
    summary: `Generated ${args.kind} for "${task.title}"`,
    ok: true,
    taskId: task.id,
  });
  return { artifact: { kind: args.kind, content: text } };
}

export async function draftCommStep(
  args: { taskId: string; kind: string; context?: string },
  ctx: RescueCtx,
) {
  "use step";
  const task = await loadTaskRow(args.taskId, ctx.userId);
  const { object } = await generateObject({
    model: getModel(),
    schema: z.object({ subject: z.string(), body: z.string() }),
    prompt: `Write a brief, polite ${args.kind} email about "${task?.title ?? "a task"}".
${args.context ? "Context: " + args.context : ""}`,
  });
  const content = `Subject: ${object.subject}\n\n${object.body}`;
  if (task) {
    await prisma.artifact.deleteMany({ where: { taskId: task.id, kind: "email" } });
    await prisma.artifact.create({
      data: { taskId: task.id, kind: "email", title: ARTIFACT_TITLE.email, content },
    });
  }
  await railLog({
    tool: "draft_communication",
    summary: `Drafted ${args.kind} email for "${task?.title ?? ""}"`,
    ok: true,
    taskId: task?.id ?? null,
  });
  return object;
}

export async function setNudgeStep(
  args: { taskId: string; whenISO: string; message: string },
  ctx: RescueCtx,
) {
  "use step";
  const task = await loadTaskRow(args.taskId, ctx.userId);
  if (task) {
    const content = `Nudge @ ${args.whenISO}: ${args.message}`;
    await prisma.artifact.deleteMany({ where: { taskId: task.id, kind: "note" } });
    await prisma.artifact.create({
      data: { taskId: task.id, kind: "note", title: ARTIFACT_TITLE.note, content },
    });
  }
  await railLog({
    tool: "set_smart_nudge",
    summary: `Set nudge for "${task?.title ?? ""}" at ${new Date(args.whenISO).toLocaleString()}`,
    ok: true,
    taskId: task?.id ?? null,
  });
  return { ok: true };
}

// ── finalize ─────────────────────────────────────────────────────────────────

/**
 * Read the now-persisted tasks (with their fresh sub-steps/blocks/artifacts) and
 * emit the final `done` line so the client updates cards live, then close the rail.
 */
export async function finalizeStep(userId: string | null, finalText: string) {
  "use step";
  const rows = await prisma.task.findMany({
    where: userId ? { userId } : {},
    orderBy: { deadline: "asc" },
    include: {
      subSteps: { orderBy: { order: "asc" } },
      blocks: { orderBy: { start: "asc" } },
      artifacts: { orderBy: { createdAt: "asc" } },
    },
  });
  const tasks = rows.map((r) => ({
    id: r.id,
    title: r.title,
    deadlineISO: r.deadline.toISOString(),
    importance: r.importance,
    percentDone: r.percentDone,
    type: r.type,
    subSteps: r.subSteps.map((s) => ({ id: s.id, title: s.title, effortMin: s.effortMin, done: s.done })),
    blocks: r.blocks.map((b) => ({
      id: b.id,
      taskId: b.taskId,
      startISO: b.start.toISOString(),
      endISO: b.end.toISOString(),
      title: b.title,
      calendarEventId: b.calendarEventId ?? undefined,
    })),
    artifacts: r.artifacts.map((a) => ({ id: a.id, taskId: a.taskId, kind: a.kind, content: a.content })),
  }));
  await railDone(tasks, finalText);
  await railClose();
}
