"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import GlassPanel from "@/components/ui/GlassPanel";
import Skeleton from "@/components/ui/Skeleton";
import type { ActionLogEntry } from "@/lib/types";

/**
 * AgentActivityRail — the signature element (DESIGN.md §5). A refined mono
 * operations log: each line is a violet leading tick, a verb-first summary, and
 * a faint mono timestamp. New lines stream in via AnimatePresence; successes
 * settle to --text with a brief --calm glow, failures flash --hot. A "● live"
 * indicator pulses while a rescue is running.
 */
export default function AgentActivityRail({
  feed,
  running,
}: {
  feed: ActionLogEntry[];
  running: boolean;
}) {
  const reduce = useReducedMotion();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the newest line in view as the log streams.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [feed.length, running]);

  return (
    <GlassPanel variant="rail" className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between">
        <p className="t-caption">Agent activity</p>
        {running ? (
          <span className="inline-flex items-center gap-1.5">
            <motion.span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: "var(--calm)" }}
              animate={reduce ? undefined : { opacity: [1, 0.3, 1], scale: [1, 0.85, 1] }}
              transition={reduce ? undefined : { duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
            />
            <span className="t-mono" style={{ color: "var(--calm)" }}>
              live
            </span>
          </span>
        ) : feed.length > 0 ? (
          <span className="t-mono text-faint">done</span>
        ) : null}
      </div>

      <div
        ref={scrollRef}
        className="max-h-[58vh] flex-1 overflow-y-auto pr-1"
        role="log"
        aria-live="polite"
        aria-label="Agent action log"
      >
        {feed.length === 0 && running ? (
          // Loading: say what's happening + skeleton lines until the first
          // action streams in (DESIGN.md §7).
          <div className="space-y-2.5">
            <p className="t-body text-muted">Reading your week&hellip;</p>
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ) : feed.length === 0 ? (
          <p className="t-body text-faint">
            The agent&rsquo;s log appears here. Hit{" "}
            <span className="text-muted">Rescue my week</span> to watch it work.
          </p>
        ) : (
          <ul className="space-y-1">
            <AnimatePresence initial={false}>
              {feed.map((entry, i) => {
                const tick = entry.ok ? "var(--agent)" : "var(--hot)";
                const flash = entry.ok ? "rgba(52,211,153,0.14)" : "rgba(251,113,133,0.18)";
                const newest = i === feed.length - 1;
                return (
                  <motion.li
                    key={entry.id}
                    initial={{ opacity: 0, x: reduce ? 0 : -8 }}
                    animate={{
                      opacity: 1,
                      x: 0,
                      backgroundColor: [flash, "rgba(0,0,0,0)"],
                    }}
                    exit={{ opacity: 0 }}
                    transition={{
                      default: { type: "spring", stiffness: 320, damping: 30 },
                      backgroundColor: { duration: 1.5, ease: "easeOut" },
                    }}
                    className="flex items-start gap-2.5 rounded-[8px] px-2 py-1.5"
                  >
                    <span
                      className="mt-[3px] h-3 w-0.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor: tick,
                        boxShadow: newest && entry.ok ? "0 0 8px var(--agent-glow)" : undefined,
                      }}
                      aria-hidden
                    />
                    <p
                      className="t-mono min-w-0 flex-1 leading-snug"
                      style={{ color: entry.ok ? "var(--text)" : "var(--hot)" }}
                    >
                      {entry.summary}
                    </p>
                    <time className="t-mono shrink-0 text-faint" dateTime={entry.at}>
                      {timeOf(entry.at)}
                    </time>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </GlassPanel>
  );
}

function timeOf(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return "";
  }
}
