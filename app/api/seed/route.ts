import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/**
 * "Load a sample week" — seeds a realistic at-risk week so the app is instantly
 * usable (CLAUDE.md §8). Deadlines are computed relative to "now" so the spread
 * across the heat scale stays true whenever it's run. Idempotent: skips titles
 * that already exist, so repeat clicks don't duplicate.
 */
const SAMPLE = [
  { title: "Reply to Prof. Rao about the recommendation letter", dayOffset: 0, hour: 21, importance: 4, percentDone: 0, type: "other" },
  { title: "Operating Systems assignment 3", dayOffset: 1, hour: 23, importance: 5, percentDone: 20, type: "assignment" },
  { title: "Pay the electricity bill", dayOffset: 2, hour: 18, importance: 4, percentDone: 0, type: "bill" },
  { title: "Buy Mom a birthday gift", dayOffset: 3, hour: 20, importance: 4, percentDone: 0, type: "errand" },
  { title: "Internship interview prep — React + DSA", dayOffset: 5, hour: 10, importance: 5, percentDone: 10, type: "interview" },
  { title: "Submit travel reimbursement form", dayOffset: 8, hour: 17, importance: 2, percentDone: 0, type: "errand" },
];

export async function POST() {
  try {
    const existing = await prisma.task.findMany({ select: { title: true } });
    const have = new Set(existing.map((t) => t.title));

    const now = new Date();
    const toCreate = SAMPLE.filter((s) => !have.has(s.title)).map((s) => {
      const d = new Date(now);
      d.setDate(d.getDate() + s.dayOffset);
      d.setHours(s.hour, 0, 0, 0);
      return {
        title: s.title,
        deadline: d,
        importance: s.importance,
        percentDone: s.percentDone,
        type: s.type,
      };
    });

    if (toCreate.length > 0) {
      await prisma.task.createMany({ data: toCreate });
    }

    const total = await prisma.task.count();
    return NextResponse.json({ added: toCreate.length, total });
  } catch (err) {
    console.error("[seed] error:", err);
    return NextResponse.json(
      { error: "Couldn't load the sample week — the database didn't respond." },
      { status: 503 },
    );
  }
}
