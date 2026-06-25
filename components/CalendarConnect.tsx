"use client";

import { Calendar, Check, Loader2 } from "lucide-react";
import Button from "@/components/ui/Button";

export type CalStatus = "idle" | "connecting" | "connected" | "error";

/**
 * CalendarConnect — the header control for Google Calendar (DESIGN.md §7 voice).
 * Presentational: RescueBoard owns the token + status and runs the GIS flow.
 */
export default function CalendarConnect({
  status,
  onConnect,
}: {
  status: CalStatus;
  onConnect: () => void;
}) {
  if (status === "connected") {
    return (
      <span
        className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] border border-line px-3 py-2"
        title="Google Calendar connected"
      >
        <span
          className="grid h-4 w-4 place-items-center rounded-full"
          style={{ backgroundColor: "color-mix(in srgb, var(--calm) 22%, transparent)" }}
        >
          <Check className="h-3 w-3" style={{ color: "var(--calm)" }} />
        </span>
        <span className="t-label" style={{ color: "var(--calm)" }}>
          Calendar connected
        </span>
      </span>
    );
  }

  const connecting = status === "connecting";

  return (
    <Button variant="ghost" onClick={onConnect} disabled={connecting}>
      {connecting ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" /> Connecting…
        </>
      ) : (
        <>
          <Calendar className="h-4 w-4" />
          {status === "error" ? "Reconnect calendar" : "Connect Google Calendar"}
        </>
      )}
    </Button>
  );
}
