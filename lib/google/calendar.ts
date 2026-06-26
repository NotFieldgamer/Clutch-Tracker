// Google Calendar (client-side) via a GIS access token + Calendar API v3 REST.
const CAL = "https://www.googleapis.com/calendar/v3";

// The hour-of-day (0–23) of an instant *in a given IANA timezone*. Working-hours
// gating must use the USER's wall clock, not the server's — on Vercel the server
// is UTC, so server-local getHours() would schedule work in the middle of the
// user's night. Falls back to the server zone only if none is supplied.
function hourInTimeZone(date: Date, timeZone?: string): number {
  try {
    const h = new Intl.DateTimeFormat("en-US", {
      timeZone: timeZone || undefined,
      hour: "2-digit",
      hour12: false,
    }).format(date);
    return parseInt(h, 10) % 24;
  } catch {
    return date.getHours(); // invalid tz string → server-local fallback
  }
}

export async function listBusy(token: string, timeMinISO: string, timeMaxISO: string) {
  const res = await fetch(`${CAL}/freeBusy`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ timeMin: timeMinISO, timeMax: timeMaxISO, items: [{ id: "primary" }] }),
  });
  if (!res.ok) throw new Error(`freeBusy ${res.status}`);
  const data = await res.json();
  return (data.calendars?.primary?.busy ?? []) as Array<{ start: string; end: string }>;
}

export async function createCalendarEvent(
  token: string,
  summary: string,
  startISO: string,
  endISO: string,
  timeZone?: string,
) {
  const res = await fetch(`${CAL}/calendars/primary/events`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    // Pass the user's IANA tz so Google anchors the event unambiguously.
    body: JSON.stringify({
      summary,
      start: { dateTime: startISO, ...(timeZone ? { timeZone } : {}) },
      end: { dateTime: endISO, ...(timeZone ? { timeZone } : {}) },
    }),
  });
  if (!res.ok) throw new Error(`insert event ${res.status}`);
  return res.json(); // { id, htmlLink, ... }
}

// Free slots between now and byISO, avoiding busy windows, within working hours.
// `timeZone` is the user's IANA zone — working hours are gated against THEIR wall
// clock, so this is correct on a UTC server (Vercel) too.
export async function findFreeSlots(
  token: string, durationMin: number, byISO: string,
  opts?: { dayStartHour?: number; dayEndHour?: number; timeZone?: string }
) {
  const dayStart = opts?.dayStartHour ?? 9;
  const dayEnd = opts?.dayEndHour ?? 21;
  const timeZone = opts?.timeZone;
  const end = new Date(byISO);
  const busy = await listBusy(token, new Date().toISOString(), end.toISOString());
  const ranges = busy.map(b => [new Date(b.start).getTime(), new Date(b.end).getTime()] as [number, number]);

  const slots: Array<{ startISO: string; endISO: string }> = [];
  const stepMs = durationMin * 60000;
  const cursor = new Date(); cursor.setMinutes(0, 0, 0);

  while (cursor.getTime() + stepMs <= end.getTime() && slots.length < 12) {
    const h = hourInTimeZone(cursor, timeZone);
    if (h >= dayStart && h + durationMin / 60 <= dayEnd) {
      const s = cursor.getTime(), e = s + stepMs;
      const clash = ranges.some(([bs, be]) => s < be && e > bs);
      if (!clash && s > Date.now()) slots.push({ startISO: new Date(s).toISOString(), endISO: new Date(e).toISOString() });
    }
    cursor.setTime(cursor.getTime() + 30 * 60000); // advance 30 min
  }
  return slots;
}
