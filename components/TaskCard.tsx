"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ListChecks, CalendarClock, FileText } from "lucide-react";
import GlassPanel from "@/components/ui/GlassPanel";
import RiskMeter from "@/components/ui/RiskMeter";
import type { ScoredTask } from "@/lib/types";

const TYPE_LABEL: Record<string, string> = {
  assignment: "Assignment",
  bill: "Bill",
  interview: "Interview",
  errand: "Errand",
  email: "Email",
  generic: "Task",
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

/**
 * TaskCard — title (display), a RiskMeter + plain-language reason, a mono
 * deadline countdown, and an expand affordance. After a rescue the expanded
 * area will hold sub-steps, scheduled blocks, and artifacts.
 */
export default function TaskCard({ task }: { task: ScoredTask }) {
  const [open, setOpen] = useState(false);
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

  return (
    <GlassPanel className="p-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-start gap-4 rounded-[var(--radius)] p-5 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      >
        <div className="min-w-0 flex-1">
          <p className="t-caption mb-1.5">{TYPE_LABEL[task.type] ?? "Task"}</p>
          <h3 className="t-h2 truncate text-text">{task.title}</h3>
          <div className="mt-3 flex items-center gap-3">
            <RiskMeter value={task.risk} className="max-w-[160px]" aria-label={`Risk: ${task.reason}`} />
            <span className="t-label truncate text-muted">{task.reason}</span>
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
            <div className="space-y-3 border-t border-line px-5 pb-5 pt-4">
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
          </motion.div>
        )}
      </AnimatePresence>
    </GlassPanel>
  );
}
