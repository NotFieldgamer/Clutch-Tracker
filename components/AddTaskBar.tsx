"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Loader2 } from "lucide-react";
import GlassPanel from "@/components/ui/GlassPanel";
import Button from "@/components/ui/Button";

/**
 * AddTaskBar — one input where the user types their week in plain language.
 * On submit it POSTs to /api/parse, then refreshes the server component so the
 * new tasks appear. Includes the "Load a sample week" seed action.
 */
export default function AddTaskBar() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<null | "parse" | "seed">(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy("parse");
    setError(null);
    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Try again.");
        return;
      }
      setText("");
      router.refresh();
    } catch {
      setError("Couldn't reach the agent. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  async function loadSample() {
    if (busy) return;
    setBusy("seed");
    setError(null);
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't load the sample week.");
        return;
      }
      router.refresh();
    } catch {
      setError("Couldn't load the sample week. Try again.");
    } finally {
      setBusy(null);
    }
  }

  const parsing = busy === "parse";

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <GlassPanel className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-2 sm:py-3">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={parsing}
            placeholder="Type your week — “essay due Friday, electricity bill on the 27th, interview Tuesday”"
            aria-label="Describe your week in plain language"
            className="t-body-l min-w-0 flex-1 bg-transparent text-text outline-none placeholder:text-faint disabled:opacity-60"
          />
          <Button type="submit" variant="primary" disabled={!text.trim() || busy !== null}>
            {parsing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Reading your week…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Add tasks
              </>
            )}
          </Button>
        </GlassPanel>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button type="button" variant="ghost" onClick={loadSample} disabled={busy !== null}>
          {busy === "seed" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Loading a sample week…
            </>
          ) : (
            "Load a sample week"
          )}
        </Button>

        <AnimatePresence>
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
    </div>
  );
}
