"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wand2, Loader2 } from "lucide-react";
import Button from "@/components/ui/Button";
import CountUp from "@/components/ui/CountUp";
import GlassPanel from "@/components/ui/GlassPanel";
import AddTaskBar from "@/components/AddTaskBar";
import TaskList, { type ScoredCard } from "@/components/TaskList";
import AgentActivityRail from "@/components/AgentActivityRail";
import CalendarConnect, { type CalStatus } from "@/components/CalendarConnect";
import ProactiveScanBanner from "@/components/ProactiveScanBanner";
import { getCalendarToken } from "@/lib/google/auth";
import { riskScore } from "@/lib/riskScore";
import type { Task, ActionLogEntry } from "@/lib/types";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID;
const AT_RISK_THRESHOLD = 0.5;
// Once the agent has a real plan in place (steps/blocks/drafts), the risk of
// the task slipping drops — this is the de-escalation payoff (DESIGN.md §4.2).
const RESCUED_RISK = 0.1;
const isRescued = (t: Task) =>
  t.subSteps.length > 0 || t.blocks.length > 0 || t.artifacts.length > 0;
const RESCUE_GOAL =
  "Rescue my week. For each task at risk of slipping: prioritize, decompose it into concrete sub-steps, and generate a real first-draft artifact (an outline, draft section, or interview-prep questions as fits the task). Also try to schedule work blocks — but if the calendar isn't connected, skip only the scheduling and still do everything else. Finish with a short, specific, past-tense summary of what you did.";

/**
 * RescueBoard — the interactive Today / Rescue view. Owns task + activity-feed
 * state so the "Rescue my week" button can stream the agent's log into the rail
 * live and drop the updated tasks (sub-steps, blocks, artifacts) onto the cards
 * when it finishes.
 */
export default function RescueBoard({ initialTasks }: { initialTasks: Task[] }) {
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
  const [approvedArtifacts, setApprovedArtifacts] = useState<Set<string>>(new Set());
  const [scanState, setScanState] = useState<"scanning" | "ready" | "dismissed">("scanning");

  // Re-sync when the server re-renders (e.g. after AddTaskBar adds tasks).
  useEffect(() => {
    setTasks(initialTasks);
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

  // Proactive scan: surface at-risk items on load without a click (cap. 4).
  useEffect(() => {
    if (!hasTasks || scanState !== "scanning") return;
    const id = setTimeout(() => setScanState("ready"), 900);
    return () => clearTimeout(id);
  }, [hasTasks, scanState]);

  const showScan =
    hasTasks && atRisk > 0 && scanState !== "dismissed" && feed.length === 0 && !running;

  function toggleApprove(artifactId: string) {
    setApprovedArtifacts((s) => {
      const next = new Set(s);
      if (next.has(artifactId)) next.delete(artifactId);
      else next.add(artifactId);
      return next;
    });
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
        body: JSON.stringify({ goal: RESCUE_GOAL, tasks, calendarToken: calToken }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Couldn't start the rescue. Try again.");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          let msg: { type: string; entry?: ActionLogEntry; tasks?: Task[]; finalText?: string; error?: string };
          try {
            msg = JSON.parse(line);
          } catch {
            continue;
          }
          if (msg.type === "log" && msg.entry) {
            setFeed((f) => [...f, msg.entry as ActionLogEntry]);
          } else if (msg.type === "done") {
            if (msg.tasks) setTasks(msg.tasks);
            setSummary(msg.finalText ?? "");
          } else if (msg.type === "error") {
            setError(msg.error ?? "The rescue failed. Try again.");
          }
        }
      }
    } catch {
      setError("Lost the connection mid-rescue. Try again.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="relative mx-auto w-full max-w-6xl px-6 pb-28 pt-10 sm:pt-12">
      {/* Header bar — brand left, calendar control right */}
      <div className="mb-9 flex items-center justify-between gap-4">
        <span className="t-caption inline-flex items-center gap-2">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: "var(--agent)", boxShadow: "0 0 10px var(--agent-glow)" }}
          />
          Clutch
        </span>
        <CalendarConnect status={calStatus} onConnect={connectCalendar} />
      </div>

      <AnimatePresence>
        {calError && (
          <motion.p
            role="alert"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="t-body mb-6 text-hot"
          >
            {calError}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
        {/* Main column */}
        <div className="min-w-0">
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
                : "Add your week in plain language and I'll find what's about to slip — then do something about it."}
            </p>

            <div className="mt-6 flex flex-col items-start gap-3">
              <Button variant="primary" onClick={rescue} disabled={!hasTasks || running}>
                {running ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Rescuing your week…
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4" /> Rescue my week
                  </>
                )}
              </Button>

              <AnimatePresence>
                {summary && !running && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
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
                    role="alert"
                    initial={{ opacity: 0, y: -4 }}
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

          <section className="mb-8">
            <AddTaskBar />
          </section>

          {hasTasks ? (
            <TaskList
              cards={scored}
              approvedArtifacts={approvedArtifacts}
              onToggleApprove={toggleApprove}
            />
          ) : (
            <GlassPanel className="py-14 text-center">
              <p className="t-h2 text-text">Nothing&rsquo;s at risk yet.</p>
              <p className="t-body mt-2 text-muted">
                Add your week above, or load a sample to see Clutch in action.
              </p>
            </GlassPanel>
          )}
        </div>

        {/* Activity rail — docked right on desktop, below on mobile */}
        <aside className="lg:sticky lg:top-16 lg:self-start">
          <AgentActivityRail feed={feed} running={running} />
        </aside>
      </div>
    </main>
  );
}
