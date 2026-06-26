export type TaskType = "assignment" | "bill" | "interview" | "meeting" | "errand" | "other";

export interface SubStep { id: string; title: string; effortMin: number; done: boolean; }
export interface Block {
  id: string; taskId: string; startISO: string; endISO: string; title: string; calendarEventId?: string;
}
export interface Artifact {
  id: string; taskId: string; kind: "outline" | "draft" | "email" | "prep" | "note"; content: string;
  approved?: boolean; // user accepted it; persisted so the badge survives a refresh
}
export interface Task {
  id: string;
  title: string;
  deadlineISO: string;
  importance: number;   // 1..5
  percentDone: number;  // 0..100
  type: TaskType;
  subSteps: SubStep[];
  blocks: Block[];
  artifacts: Artifact[];
}
export interface ActionLogEntry { id: string; tool: string; summary: string; at: string; ok: boolean; }
