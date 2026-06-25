"use client";

import { motion } from "framer-motion";
import { Radar, Wand2, Loader2 } from "lucide-react";
import GlassPanel from "@/components/ui/GlassPanel";
import Button from "@/components/ui/Button";
import type { Task } from "@/lib/types";

/**
 * ProactiveScanBanner — the unprompted risk scan (CLAUDE.md cap. 4). On load it
 * "scans" the week and surfaces the at-risk items with a one-click handle.
 * The agent speaks proactively; this never just notifies — it offers to act.
 */
export default function ProactiveScanBanner({
  scanning,
  atRiskTasks,
  onHandle,
  onDismiss,
}: {
  scanning: boolean;
  atRiskTasks: Task[];
  onHandle: () => void;
  onDismiss: () => void;
}) {
  const n = atRiskTasks.length;
  const names = atRiskTasks.slice(0, 3).map((t) => t.title).join(" · ");

  return (
    <motion.div
      className="mb-6"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <GlassPanel
        className="relative overflow-hidden"
        style={{ borderColor: "color-mix(in srgb, var(--agent) 40%, var(--border))" }}
      >
        {/* agent glow accent */}
        <div
          className="pointer-events-none absolute -left-10 -top-12 h-36 w-36 rounded-full blur-3xl"
          style={{ background: "var(--agent-glow)" }}
        />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span
              className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full"
              style={{ background: "color-mix(in srgb, var(--agent) 18%, transparent)" }}
            >
              {scanning ? (
                <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--agent-2)" }} />
              ) : (
                <Radar className="h-4 w-4" style={{ color: "var(--agent-2)" }} />
              )}
            </span>
            <div className="min-w-0">
              {scanning ? (
                <p className="t-body-l text-text">Scanning your week…</p>
              ) : (
                <>
                  <p className="t-body-l text-text">
                    {n} {n === 1 ? "thing may" : "things may"} slip — want me to handle{" "}
                    {n === 1 ? "it" : "them"}?
                  </p>
                  {names && <p className="t-body mt-0.5 truncate text-muted">{names}</p>}
                </>
              )}
            </div>
          </div>

          {!scanning && (
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="primary" onClick={onHandle}>
                <Wand2 className="h-4 w-4" /> Handle them
              </Button>
              <Button variant="subtle" onClick={onDismiss}>
                Dismiss
              </Button>
            </div>
          )}
        </div>
      </GlassPanel>
    </motion.div>
  );
}
