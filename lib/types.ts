/**
 * App-facing types. The DB shape lives in prisma/schema.prisma; these are the
 * serialized (Date → ISO string) shapes that cross the server→client boundary.
 *
 * Note: CLAUDE.md §5 expects a fuller lib/types.ts from LOGIC_SNIPPETS.md in a
 * later step; this is the minimal set the Today view needs now.
 */

export type TaskType =
  | "assignment"
  | "bill"
  | "interview"
  | "errand"
  | "email"
  | "generic";

export const TASK_TYPES: TaskType[] = [
  "assignment",
  "bill",
  "interview",
  "errand",
  "email",
  "generic",
];

/** What Gemini returns from /api/parse for each item of free text. */
export interface ParsedTask {
  title: string;
  deadlineISO: string;
  importance: number; // 1–5
  percentDone: number; // 0–100
  type: string;
}

/** A persisted task, serialized for the client (deadline as an ISO string). */
export interface TaskDTO {
  id: string;
  title: string;
  deadlineISO: string;
  importance: number;
  percentDone: number;
  type: string;
}

/** A task plus its server-computed risk, ready to render in a TaskCard. */
export interface ScoredTask extends TaskDTO {
  risk: number; // 0..1
  reason: string; // plain-language risk reason
}
