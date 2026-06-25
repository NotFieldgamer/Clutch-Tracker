"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ListChecks,
  CalendarClock,
  FileText,
  Mail,
  Check,
} from "lucide-react";
import GlassPanel from "@/components/ui/GlassPanel";
import RiskMeter from "@/components/ui/RiskMeter";
import { riskScore } from "@/lib/riskScore";
import type { Task } from "@/lib/types";

const TYPE_LABEL: Record<string, string> = {
  assignment: "Assignment",
  bill: "Bill",
  interview: "Interview",
  meeting: "Meeting",
  errand: "Errand",
  other: "Task",
};

function formatCountdown(deadlineISO: string, now: number): string {
  const ms = new Date(deadlineISO).getTime() - now;
  if (ms <= 0) return "OVERDUE";
  const mins = Math.floor(ms / 60_000);
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const fmtTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

/**
 * TaskCard — title (display), a RiskMeter + plain-language reason, a mono
 * deadline countdown, and an expand affordance. After a rescue the expanded
 * area fills with the agent's sub-steps, scheduled blocks, and artifacts.
 */
export default function TaskCard({ task }: { task: Task }) {
  const [open, setOpen] = useState(false);
  const { score, reason } = riskScore(task);

  // Countdown is time-dependent → compute on the client to avoid hydration
  // mismatch, and tick it so it stays live.
  const [countdown, setCountdown] = useState(() =>
    formatCountdown(task.deadlineISO, Date.now()),
  );
  useEffect(() => {
    const tick = () => setCountdown(formatCountdown(task.deadlineISO, Date.now()));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [task.deadlineISO]);

  const overdue = countdown === "OVERDUE";
  const hasResults =
    task.subSteps.length > 0 || task.blocks.length > 0 || task.artifacts.length > 0;

  return (
    <GlassPanel className="p-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-start gap-4 rounded-[var(--radius)] p-5 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      >
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="t-caption">{TYPE_LABEL[task.type] ?? "Task"}</span>
            {hasResults && (
              <span className="t-caption" style={{ color: "var(--calm)" }}>
                · rescued
              </span>
            )}
          </div>
          <h3 className="t-h2 truncate text-text">{task.title}</h3>
          <div className="mt-3 flex items-center gap-3">
            <RiskMeter value={score} className="max-w-[160px]" aria-label={`Risk: ${reason}`} />
            <span className="t-label truncate text-muted">{reason}</span>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <span
            className={`t-mono ${overdue ? "text-critical" : "text-muted"}`}
            suppressHydrationWarning
          >
            {countdown}
          </span>
          <ChevronDown
            className={`h-4 w-4 text-faint transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-line px-5 pb-5 pt-4">
              {hasResults ? (
                <div className="space-y-5">
                  {task.subSteps.length > 0 && (
                    <section>
                      <p className="t-caption mb-2 inline-flex items-center gap-1.5">
                        <ListChecks className="h-3.5 w-3.5" /> Sub-steps
                      </p>
                      <ul className="space-y-1.5">
                        {task.subSteps.map((s) => (
                          <li key={s.id} className="flex items-center gap-2.5">
                            <span
                              className="grid h-4 w-4 shrink-0 place-items-center rounded-[5px] border border-line"
                              aria-hidden
                            >
                              {s.done && <Check className="h-3 w-3" style={{ color: "var(--calm)" }} />}
                            </span>
                            <span className="t-body flex-1 text-text">{s.title}</span>
                            <span className="t-mono text-faint">~{s.effortMin}m</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {task.blocks.length > 0 && (
                    <section>
                      <p className="t-caption mb-2 inline-flex items-center gap-1.5">
                        <CalendarClock className="h-3.5 w-3.5" /> Scheduled blocks
                      </p>
                      <ul className="space-y-1.5">
                        {task.blocks.map((b) => (
                          <li key={b.id} className="flex items-center justify-between gap-3">
                            <span className="flex min-w-0 items-center gap-2">
                              {b.calendarEventId && (
                                <Check
                                  className="h-3.5 w-3.5 shrink-0"
                                  style={{ color: "var(--calm)" }}
                                  aria-label="On Google Calendar"
                                />
                              )}
                              <span className="t-body truncate text-text">{b.title}</span>
                            </span>
                            <span className="t-mono shrink-0 text-muted">{fmtTime(b.startISO)}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {task.artifacts.length > 0 && (
                    <section>
                      <p className="t-caption mb-2 inline-flex items-center gap-1.5">
                        {task.artifacts.some((a) => a.kind === "email") ? (
                          <Mail className="h-3.5 w-3.5" />
                        ) : (
                          <FileText className="h-3.5 w-3.5" />
                        )}
                        Artifacts
                      </p>
                      <div className="space-y-3">
                        {task.artifacts.map((a) => (
                          <div key={a.id} className="rounded-[var(--radius-sm)] border border-line bg-ink-2/60 p-3">
                            <p className="t-caption mb-1.5">{a.kind}</p>
                            <pre className="t-body whitespace-pre-wrap break-words font-sans text-muted">
                              {a.content}
                            </pre>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="t-body text-faint">
                    The agent hasn&rsquo;t rescued this yet. Run a rescue and its
                    sub-steps, scheduled blocks, and drafts will appear here.
                  </p>
                  <div className="flex flex-wrap gap-4">
                    <span className="t-label inline-flex items-center gap-1.5 text-faint">
                      <ListChecks className="h-3.5 w-3.5" /> Sub-steps
                    </span>
                    <span className="t-label inline-flex items-center gap-1.5 text-faint">
                      <CalendarClock className="h-3.5 w-3.5" /> Blocks
                    </span>
                    <span className="t-label inline-flex items-center gap-1.5 text-faint">
                      <FileText className="h-3.5 w-3.5" /> Artifacts
                    </span>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassPanel>
  );
}
