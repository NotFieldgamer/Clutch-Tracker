// Google Calendar (client-side) via a GIS access token + Calendar API v3 REST.
const CAL = "https://www.googleapis.com/calendar/v3";

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

export async function createCalendarEvent(token: string, summary: string, startISO: string, endISO: string) {
  const res = await fetch(`${CAL}/calendars/primary/events`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ summary, start: { dateTime: startISO }, end: { dateTime: endISO } }),
  });
  if (!res.ok) throw new Error(`insert event ${res.status}`);
  return res.json(); // { id, htmlLink, ... }
}

// Free slots between now and byISO, avoiding busy windows, within working hours.
export async function findFreeSlots(
  token: string, durationMin: number, byISO: string,
  opts?: { dayStartHour?: number; dayEndHour?: number }
) {
  const dayStart = opts?.dayStartHour ?? 9;
  const dayEnd = opts?.dayEndHour ?? 21;
  const end = new Date(byISO);
  const busy = await listBusy(token, new Date().toISOString(), end.toISOString());
  const ranges = busy.map(b => [new Date(b.start).getTime(), new Date(b.end).getTime()] as [number, number]);

  const slots: Array<{ startISO: string; endISO: string }> = [];
  const stepMs = durationMin * 60000;
  const cursor = new Date(); cursor.setMinutes(0, 0, 0);

  while (cursor.getTime() + stepMs <= end.getTime() && slots.length < 12) {
    const h = cursor.getHours();
    if (h >= dayStart && h + durationMin / 60 <= dayEnd) {
      const s = cursor.getTime(), e = s + stepMs;
      const clash = ranges.some(([bs, be]) => s < be && e > bs);
      if (!clash && s > Date.now()) slots.push({ startISO: new Date(s).toISOString(), endISO: new Date(e).toISOString() });
    }
    cursor.setTime(cursor.getTime() + 30 * 60000); // advance 30 min
  }
  return slots;
}
