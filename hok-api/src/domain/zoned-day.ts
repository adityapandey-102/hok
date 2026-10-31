/**
 * Calendar days in an IANA zone, without a date library: "today" for a user
 * in Asia/Kolkata starts at their local midnight, not UTC's. A day key is
 * "YYYY-MM-DD". Mirrors hok-web's lib/domain/utils/zonedTime.ts.
 */

export type DayKey = string;

interface WallParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function wallParts(instant: number, zone: string): WallParts {
  let f = formatters.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    formatters.set(zone, f);
  }
  const p: Record<string, number> = {};
  for (const part of f.formatToParts(instant)) if (part.type !== "literal") p[part.type] = Number(part.value);
  return { year: p.year!, month: p.month!, day: p.day!, hour: p.hour!, minute: p.minute! };
}

/** Minutes the zone is ahead of UTC at an instant (e.g. +330 for Asia/Kolkata). */
function zoneOffsetMinutes(instant: number, zone: string): number {
  const p = wallParts(instant, zone);
  const wallAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return Math.round((wallAsUtc - Math.floor(instant / 60_000) * 60_000) / 60_000);
}

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

/** The day an instant falls on in a zone. */
export function dayKeyInZone(instant: Date, zone: string): DayKey {
  const p = wallParts(instant.getTime(), zone);
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}`;
}

/** The day `n` days after `key` (calendar arithmetic, no zone involved). */
export function addDays(key: DayKey, n: number): DayKey {
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y!, m! - 1, d! + n));
  return `${pad(t.getUTCFullYear(), 4)}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** The instant local midnight begins `key` in `zone` (DST-safe: settles the offset in two passes). */
export function zonedMidnight(key: DayKey, zone: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  const wallAsUtc = Date.UTC(y!, m! - 1, d);
  let offset = zoneOffsetMinutes(wallAsUtc, zone);
  for (let i = 0; i < 2; i++) offset = zoneOffsetMinutes(wallAsUtc - offset * 60_000, zone);
  return new Date(wallAsUtc - offset * 60_000);
}
