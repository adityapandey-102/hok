/**
 * Time-zone-aware helpers for events (FR-CAL-07). Instants are ISO strings;
 * the zone decides how they are shown. Built on Intl only (no date library),
 * and DST-safe: a wall-clock time is converted to an instant by asking Intl
 * for the zone's real offset at that moment.
 */

const PARTS = ["year", "month", "day", "hour", "minute", "second"] as const;

function wallParts(ms: number, zone: string): Record<(typeof PARTS)[number], number> {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const out: Record<string, number> = {};
  for (const p of fmt.formatToParts(new Date(ms))) {
    if ((PARTS as readonly string[]).includes(p.type)) out[p.type] = Number(p.value);
  }
  return out as Record<(typeof PARTS)[number], number>;
}

/** The zone UTC offset in minutes at an instant (e.g. 330 for Asia/Kolkata). */
export function zoneOffsetMinutes(ms: number, zone: string): number {
  const p = wallParts(ms, zone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60_000);
}

function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

/**
 * A wall-clock time typed in a zone ("2026-10-20T10:00" in "Asia/Kolkata")
 * becomes the exact instant as an ISO string WITH that zone offset
 * ("2026-10-20T10:00:00+05:30"), ready to send to the API. Returns null for
 * an unparseable value. In a daylight-saving gap the time shifts forward; in
 * an overlap the earlier occurrence wins.
 */
export function zonedWallTimeToIso(local: string, zone: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const wallAsUtc = Date.UTC(y, mo - 1, d, h, mi);
  // The offset at the guessed instant can differ from the offset at the real one (DST edge): settle in two passes.
  let offset = zoneOffsetMinutes(wallAsUtc, zone);
  for (let i = 0; i < 2; i++) offset = zoneOffsetMinutes(wallAsUtc - offset * 60_000, zone);
  const instant = wallAsUtc - offset * 60_000;
  const real = zoneOffsetMinutes(instant, zone);
  const p = wallParts(instant, zone);
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:00${formatOffset(real)}`;
}

/** An instant as the "YYYY-MM-DDTHH:mm" wall time in a zone, for a datetime-local input. */
export function isoToZonedInput(iso: string, zone: string): string {
  const p = wallParts(new Date(iso).getTime(), zone);
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** "Tue, 20 Oct 2026, 10:00 am" in a zone, plus the zone short name when asked. */
export function formatInZone(iso: string, zone: string, withZoneName = false): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    ...(withZoneName ? { timeZoneName: "short" } : {}),
  }).format(new Date(iso));
}

/**
 * How to show an event time to a viewer: always in the viewer zone, plus the
 * event own local time when the two zones show a different wall clock at that
 * instant (FR-CAL-07).
 */
export function describeEventTime(
  iso: string,
  viewerZone: string,
  eventZone: string,
): { primary: string; secondary: string | null } {
  const primary = formatInZone(iso, viewerZone, true);
  const same = isoToZonedInput(iso, viewerZone) === isoToZonedInput(iso, eventZone);
  return { primary, secondary: same ? null : `${formatInZone(iso, eventZone, true)} (event time)` };
}
