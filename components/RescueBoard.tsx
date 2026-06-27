"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Wand2, Loader2, Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";
import CountUp from "@/components/ui/CountUp";
import GlassPanel from "@/components/ui/GlassPanel";
import AddTaskBar from "@/components/AddTaskBar";
import TaskList, { type ScoredCard } from "@/components/TaskList";
import AgentActivityRail from "@/components/AgentActivityRail";
import CalendarConnect, { type CalStatus } from "@/components/CalendarConnect";
import AuthControls from "@/components/AuthControls";
import ProactiveScanBanner from "@/components/ProactiveScanBanner";
import { getCalendarToken } from "@/lib/google/auth";
import { useReduced } from "@/lib/motion";
import { riskScore } from "@/lib/riskScore";
import type { Task, ActionLogEntry } from "@/lib/types";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID;
const AT_RISK_THRESHOLD = 0.5;
// Once the agent has a real plan in place (steps/blocks/drafts), the risk of
// the task slipping drops — this is the de-escalation payoff (DESIGN.md §4.2).
const RESCUED_RISK = 0.1;
const isRescued = (t: Task) =>
  t.subSteps.length > 0 || t.blocks.length > 0 || t.artifacts.length > 0;

/** Ids of artifacts the user has approved — seeds the UI from persisted state. */
const approvedIds = (tasks: Task[]) =>
  new Set(tasks.flatMap((t) => t.artifacts.filter((a) => a.approved).map((a) => a.id)));

/**
 * Minutes the agent put back on the user's plan: real scheduled-block time where
 * blocks exist, otherwise the planned sub-step effort it broke the task into.
 */
function reclaimedMinutes(tasks: Task[]): number {
  return Math.round(
    tasks.reduce((sum, t) => {
      const blockMin = t.blocks.reduce((s, b) => {
        const ms = new Date(b.endISO).getTime() - new Date(b.startISO).getTime();
        return s + (ms > 0 ? ms / 60_000 : 0);
      }, 0);
      const stepMin = t.subSteps.reduce((s, x) => s + (x.effortMin || 0), 0);
      return sum + (blockMin > 0 ? blockMin : stepMin);
    }, 0),
  );
}
const RESCUE_GOAL =
  "Rescue my week. For each task at risk of slipping: prioritize, decompose it into concrete sub-steps, and generate a real first-draft artifact (an outline, draft section, or interview-prep questions as fits the task). Also try to schedule work blocks — but if the calendar isn't connected, skip only the scheduling and still do everything else. Finish with a short, specific, past-tense summary of what you did.";

/**
 * RescueBoard — the interactive Today / Rescue view. Owns task + activity-feed
 * state so the "Rescue my week" button can stream the agent's log into the rail
 * live and drop the updated tasks (sub-steps, blocks, artifacts) onto the cards
 * when it finishes.
 */
export default function RescueBoard({ initialTasks }: { initialTasks: Task[] }) {
  const { stagger, fadeUp, prefersReduced } = useReduced();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [feed, setFeed] = useState<ActionLogEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Google Calendar (client-side OAuth token, held in memory).
  const [calToken, setCalToken] = useState<string | null>(null);
  const [calStatus, setCalStatus] = useState<CalStatus>("idle");
  const [calError, setCalError] = useState<string | null>(null);

  // Approved artifact ids (UI accept/undo) and the proactive scan state.
  // Seeded from the persisted `approved` flag so the badge survives a refresh.
  const [approvedArtifacts, setApprovedArtifacts] = useState<Set<string>>(() =>
    approvedIds(initialTasks),
  );
  const [scanState, setScanState] = useState<"scanning" | "ready" | "dismissed">("scanning");

  // "Clear week" two-step confirm (guards a demo against an accidental wipe).
  const [confirmClear, setConfirmClear] = useState(false);

  // Re-sync when the server re-renders (e.g. after AddTaskBar adds tasks) —
  // including the persisted approval state.
  useEffect(() => {
    setTasks(initialTasks);
    setApprovedArtifacts(approvedIds(initialTasks));
  }, [initialTasks]);

  const hasTasks = tasks.length > 0;

  // Score + sort by effective risk (rescued tasks de-escalate to --calm and sink
  // down the list — the live re-ranking, DESIGN.md §4.3).
  const scored: ScoredCard[] = tasks
    .map((t) => {
      const { score, reason } = riskScore(t);
      const rescued = isRescued(t);
      return {
        task: t,
        risk: rescued ? RESCUED_RISK : score,
        reason: rescued ? "Rescued · the agent's on it" : reason,
        rescued,
      };
    })
    .sort((a, b) => b.risk - a.risk);
  const atRiskCards = scored.filter((c) => c.risk >= AT_RISK_THRESHOLD);
  const atRisk = atRiskCards.length;

  // "Minutes reclaimed" — the payoff stat, shown once a rescue settles.
  const reclaimed = reclaimedMinutes(tasks.filter(isRescued));
  const showReclaimed = !running && reclaimed > 0;

  // Proactive scan: surface at-risk items on load without a click (cap. 4).
  useEffect(() => {
    if (!hasTasks || scanState !== "scanning") return;
    const id = setTimeout(() => setScanState("ready"), 900);
    return () => clearTimeout(id);
  }, [hasTasks, scanState]);

  const showScan =
    hasTasks && atRisk > 0 && scanState !== "dismissed" && feed.length === 0 && !running;

  // Optimistically flip the badge, then persist; roll back if the save fails so
  // the UI never claims an approval the DB didn't keep.
  async function toggleApprove(artifactId: string) {
    const willApprove = !approvedArtifacts.has(artifactId);
    const flip = (on: boolean) =>
      setApprovedArtifacts((s) => {
        const next = new Set(s);
        if (on) next.add(artifactId);
        else next.delete(artifactId);
        return next;
      });
    flip(willApprove);
    try {
      const res = await fetch(`/api/artifact/${artifactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved: willApprove }),
      });
      if (!res.ok) throw new Error("patch failed");
    } catch {
      flip(!willApprove); // roll back
      setError("Couldn't save that change. Try again.");
    }
  }

  // Optimistically drop a task from the board, then delete it server-side; on
  // failure put it back and say so (cascade removes its sub-steps/blocks/etc).
  async function deleteTask(id: string) {
    if (running) return;
    const prev = tasks;
    setTasks((ts) => ts.filter((t) => t.id !== id));
    try {
      const res = await fetch(`/api/task/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
    } catch {
      setTasks(prev);
      setError("Couldn't remove that task. Try again.");
    }
  }

  // Clear the whole week at once — same optimistic pattern over every task id.
  async function clearWeek() {
    if (running) return;
    const prev = tasks;
    const ids = prev.map((t) => t.id);
    setConfirmClear(false);
    setTasks([]);
    try {
      const results = await Promise.all(
        ids.map((id) => fetch(`/api/task/${id}`, { method: "DELETE" })),
      );
      if (results.some((r) => !r.ok)) throw new Error("partial clear");
    } catch {
      setTasks(prev);
      setError("Couldn't clear your week — some tasks may remain. Try again.");
    }
  }

  async function connectCalendar() {
    if (calStatus === "connecting") return;
    setCalError(null);
    if (!CLIENT_ID) {
      setCalStatus("error");
      setCalError("Calendar isn't set up yet — add NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID and reload.");
      return;
    }
    // Google Identity Services loads async (see app/layout.tsx).
    const gis = (window as unknown as { google?: { accounts?: { oauth2?: unknown } } }).google;
    if (!gis?.accounts?.oauth2) {
      setCalStatus("error");
      setCalError("Google sign-in is still loading — give it a second and try again.");
      return;
    }
    setCalStatus("connecting");
    try {
      const token = await getCalendarToken(CLIENT_ID);
      setCalToken(token);
      setCalStatus("connected");
    } catch {
      setCalStatus("error");
      setCalError("Couldn't reach your calendar. Allow calendar access and try again.");
    }
  }

  async function rescue() {
    if (running || !hasTasks) return;
    setRunning(true);
    setFeed([]);
    setSummary("");
    setError(null);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: RESCUE_GOAL,
          tasks,
          calendarToken: calToken,
          // The agent schedules work-blocks in the user's working hours, so it
          // needs their wall-clock zone (the server is UTC on Vercel).
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Couldn't start the rescue. Try again.");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const processLine = (raw: string) => {
        const line = raw.trim();
        if (!line) return;
        let msg: { type: string; entry?: ActionLogEntry; tasks?: Task[]; finalText?: string; error?: string };
        try {
          msg = JSON.parse(line);
        } catch {
          return;
        }
        if (msg.type === "log" && msg.entry) {
          setFeed((f) => [...f, msg.entry as ActionLogEntry]);
        } else if (msg.type === "tasks" && msg.tasks) {
          // Live card updates: each tool that lands streams the updated tasks so
          // the card fills + de-escalates as the agent works, not only at the end.
          setTasks(msg.tasks);
        } else if (msg.type === "done") {
          if (msg.tasks) setTasks(msg.tasks);
          setSummary(msg.finalText ?? "");
        } else if (msg.type === "error") {
          setError(msg.error ?? "The rescue failed. Try again.");
        }
      };

      const drain = () => {
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          processLine(buffer.slice(0, nl));
          buffer = buffer.slice(nl + 1);
        }
      };

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        drain();
      }
      // Flush a trailing multi-byte char + any final line that arrived in the EOF
      // chunk without a trailing newline, so a `done` frame is never dropped.
      buffer += decoder.decode();
      drain();
      if (buffer.trim()) processLine(buffer);
    } catch {
      setError("Lost the connection mid-rescue. Try again.");
    } finally {
      setRunning(false);
      // Re-read persisted state from the server so the work shows even if the
      // terminal "done" frame was cut (e.g. the function hit its time limit).
      router.refresh();
    }
  }

  return (
    <motion.main
      variants={stagger}
      initial="hidden"
      animate="show"
      className="relative mx-auto w-full max-w-6xl px-6 pb-28 pt-10 sm:pt-12"
    >
      {/* Banner — brand left, calendar control right (reveal step 1) */}
      <motion.header
        variants={fadeUp}
        className="mb-9 flex items-center justify-between gap-4"
      >
        <span className="t-caption inline-flex items-center gap-2">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: "var(--agent)", boxShadow: "0 0 10px var(--agent-glow)" }}
          />
          Clutch
        </span>
        <div className="flex items-center gap-3">
          <CalendarConnect status={calStatus} onConnect={connectCalendar} />
          <AuthControls />
        </div>
      </motion.header>

      <AnimatePresence>
        {calError && (
          <motion.p
            key="cal-error"
            role="alert"
            initial={{ opacity: 0, y: prefersReduced ? 0 : -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="t-body mb-6 text-hot"
          >
            {calError}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Body grid — relays the stagger so the list (step 2) settles before the
          rail (step 3): header → list → rail (DESIGN.md §4.1). */}
      <motion.div
        variants={stagger}
        className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]"
      >
        {/* Main column */}
        <motion.div variants={fadeUp} className="min-w-0">
          <AnimatePresence>
            {showScan && (
              <ProactiveScanBanner
                key="scan"
                scanning={scanState === "scanning"}
                atRiskTasks={atRiskCards.map((c) => c.task)}
                onHandle={() => {
                  setScanState("dismissed");
                  rescue();
                }}
                onDismiss={() => setScanState("dismissed")}
              />
            )}
          </AnimatePresence>

          <header className="mb-8">
            <p className="t-caption mb-3">Today</p>

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
                ? "Your week, ranked by what's closest to slipping. Hand it to the agent and watch it work."
                : "Add your week in plain language and I'll find what's about to slip — then handle it."}
            </p>

            <div className="mt-6 flex flex-col items-start gap-4">
              <Button variant="primary" onClick={rescue} disabled={!hasTasks || running}>
                {running ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Rescuing your week&hellip;
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4" /> Rescue my week
                  </>
                )}
              </Button>

              <AnimatePresence>
                {showReclaimed && (
                  <motion.div
                    key="reclaimed"
                    initial={{ opacity: 0, y: prefersReduced ? 0 : -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    <div className="flex items-baseline gap-2">
                      <CountUp value={reclaimed} className="t-display-l text-text" />
                      <span className="t-label text-muted">min reclaimed</span>
                    </div>
                    <p className="t-body mt-1 max-w-xl text-muted">
                      Time the agent broke down and put on your plan.
                    </p>
                  </motion.div>
                )}
                {summary && !running && (
                  <motion.p
                    key="summary"
                    initial={{ opacity: 0, y: prefersReduced ? 0 : -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="t-body max-w-xl whitespace-pre-wrap"
                    style={{ color: "var(--calm)" }}
                  >
                    {summary}
                  </motion.p>
                )}
                {error && (
                  <motion.p
                    key="error"
                    role="alert"
                    initial={{ opacity: 0, y: prefersReduced ? 0 : -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="t-body text-hot"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </header>

          <section aria-label="Add to your week" className="mb-8">
            <AddTaskBar />
          </section>

          <section aria-label="Your week, ranked by what's closest to slipping">
            {hasTasks ? (
              <>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <p className="t-caption">Ranked by risk</p>
                  {confirmClear ? (
                    <div className="flex items-center gap-2">
                      <span className="t-label text-muted">
                        Clear all {tasks.length}?
                      </span>
                      <button
                        type="button"
                        autoFocus
                        onClick={() => setConfirmClear(false)}
                        className="t-label inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] px-3 py-1 text-muted outline-none hover:text-text focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={clearWeek}
                        className="t-label inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--radius-sm)] px-3 py-1 outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                        style={{ color: "var(--hot)" }}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Clear week
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmClear(true)}
                      disabled={running}
                      className="t-label inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--radius-sm)] px-3 py-1 text-faint outline-none transition-colors hover:text-hot focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:pointer-events-none disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Clear week
                    </button>
                  )}
                </div>
                <TaskList
                  cards={scored}
                  approvedArtifacts={approvedArtifacts}
                  onToggleApprove={toggleApprove}
                  onDelete={running ? undefined : deleteTask}
                />
              </>
            ) : (
              <GlassPanel className="py-14 text-center">
                <p className="t-h2 text-text">Nothing&rsquo;s at risk yet.</p>
                <p className="t-body mt-2 text-muted">
                  Add your week above and I&rsquo;ll find what&rsquo;s about to slip — then handle
                  it. Or load a sample week to see Clutch in action.
                </p>
              </GlassPanel>
            )}
          </section>
        </motion.div>

        {/* Activity rail — docked right on desktop, below on mobile */}
        <motion.aside
          variants={fadeUp}
          aria-label="Agent activity"
          className="lg:sticky lg:top-16 lg:self-start"
        >
          <AgentActivityRail feed={feed} running={running} />
        </motion.aside>
      </motion.div>
    </motion.main>
  );
}
