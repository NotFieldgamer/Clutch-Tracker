import { prisma } from "@/lib/db";
import { riskScore, riskReason } from "@/lib/riskScore";
import type { ScoredTask } from "@/lib/types";
import AddTaskBar from "@/components/AddTaskBar";
import TaskList from "@/components/TaskList";
import RescueButton from "@/components/RescueButton";
import GlassPanel from "@/components/ui/GlassPanel";
import CountUp from "@/components/ui/CountUp";

// Always read fresh tasks on request (the page reflects DB writes immediately).
export const dynamic = "force-dynamic";

const AT_RISK_THRESHOLD = 0.55; // hot / critical

async function loadTasks(): Promise<ScoredTask[]> {
  try {
    const rows = await prisma.task.findMany({ orderBy: { deadline: "asc" } });
    const now = Date.now();
    return rows.map((t) => {
      const dto = {
        id: t.id,
        title: t.title,
        deadlineISO: t.deadline.toISOString(),
        importance: t.importance,
        percentDone: t.percentDone,
        type: t.type,
      };
      return { ...dto, risk: riskScore(dto, now), reason: riskReason(dto, now) };
    });
  } catch (err) {
    console.error("[page] Could not read tasks:", err);
    return [];
  }
}

export default async function Home() {
  const tasks = await loadTasks();
  const hasTasks = tasks.length > 0;
  const atRisk = tasks.filter((t) => t.risk >= AT_RISK_THRESHOLD).length;

  return (
    <main className="relative mx-auto w-full max-w-[760px] px-6 pb-28 pt-16 sm:pt-24">
      {/* Hero — a live thesis, not a stat block (DESIGN.md §6) */}
      <header className="mb-10">
        <p className="t-caption mb-3 inline-flex items-center gap-2">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: "var(--agent)", boxShadow: "0 0 10px var(--agent-glow)" }}
          />
          Today · Clutch
        </p>

        {!hasTasks ? (
          <h1 className="t-display-xl text-text">
            Nothing&rsquo;s at risk <span className="text-muted">yet.</span>
          </h1>
        ) : atRisk > 0 ? (
          <h1 className="t-display-xl text-text">
            <CountUp value={atRisk} />{" "}
            <span className="text-muted">
              {atRisk === 1 ? "thing may slip." : "things may slip."}
            </span>
          </h1>
        ) : (
          <h1 className="t-display-xl text-text">
            You&rsquo;re clear. <span className="text-muted">Nothing&rsquo;s slipping.</span>
          </h1>
        )}

        <p className="t-body-l mt-4 max-w-xl text-muted">
          {hasTasks
            ? "Your week, ranked by what's closest to slipping. Hand it to the agent and it'll plan, schedule, and draft."
            : "Add your week in plain language and I'll find what's about to slip — then do something about it."}
        </p>

        <div className="mt-6">
          <RescueButton disabled={!hasTasks} />
        </div>
      </header>

      {/* Capture */}
      <section className="mb-10">
        <AddTaskBar />
      </section>

      {/* Ranked list / empty state */}
      {hasTasks ? (
        <TaskList tasks={tasks} />
      ) : (
        <GlassPanel className="py-14 text-center">
          <p className="t-h2 text-text">Nothing&rsquo;s at risk yet.</p>
          <p className="t-body mt-2 text-muted">
            Add your week above, or load a sample to see Clutch in action.
          </p>
        </GlassPanel>
      )}
    </main>
  );
}
