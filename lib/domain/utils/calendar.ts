/**
 * Calendar maths (M5). Days are "YYYY-MM-DD" keys in some time zone; the
 * arithmetic on keys is pure calendar arithmetic (UTC dates, no local zone), and
 * the conversion between instants and day keys always goes through the zone, so
 * a day is always someone day: the viewer on the staff calendar. Weeks start on
 * Monday. DST-safe: a day range is the instants of local midnight to local
 * midnight, so a 23 or 25 hour day is handled by zonedTime.
 */
import { isoToZonedInput, zonedWallTimeToIso } from "./zonedTime";

export type DayKey = string;

function parse(key: DayKey): { y: number; m: number; d: number } {
  const [y, m, d] = key.split("-").map(Number);
  return { y, m, d };
}

function toKey(date: Date): DayKey {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${String(date.getUTCFullYear()).padStart(4, "0")}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function utc(key: DayKey): Date {
  const { y, m, d } = parse(key);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(key: DayKey, days: number): DayKey {
  const date = utc(key);
  date.setUTCDate(date.getUTCDate() + days);
  return toKey(date);
}

/** 0 = Monday ... 6 = Sunday. */
export function weekdayIndex(key: DayKey): number {
  return (utc(key).getUTCDay() + 6) % 7;
}

export function startOfWeek(key: DayKey): DayKey {
  return addDays(key, -weekdayIndex(key));
}

export function weekDays(key: DayKey): DayKey[] {
  const first = startOfWeek(key);
  return Array.from({ length: 7 }, (_, i) => addDays(first, i));
}

export function startOfMonth(key: DayKey): DayKey {
  const { y, m } = parse(key);
  return toKey(new Date(Date.UTC(y, m - 1, 1)));
}

export function endOfMonth(key: DayKey): DayKey {
  const { y, m } = parse(key);
  return toKey(new Date(Date.UTC(y, m, 0)));
}

/** The first day of the month `delta` months away. */
export function shiftMonth(key: DayKey, delta: number): DayKey {
  const { y, m } = parse(key);
  return toKey(new Date(Date.UTC(y, m - 1 + delta, 1)));
}

export function isSameMonth(a: DayKey, b: DayKey): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

/** Whole weeks (Monday first) covering the month of `key`: 4 to 6 rows of 7 day keys. */
export function monthGrid(key: DayKey): DayKey[][] {
  const first = startOfMonth(key);
  const last = endOfMonth(key);
  const weeks: DayKey[][] = [];
  let cursor = startOfWeek(first);
  while (cursor <= last) {
    weeks.push(weekDays(cursor));
    cursor = addDays(cursor, 7);
  }
  return weeks;
}

/** The day an instant falls on in a zone. */
export function dayKeyInZone(iso: string | number | Date, zone: string): DayKey {
  const date = iso instanceof Date ? iso : new Date(iso);
  return isoToZonedInput(date.toISOString(), zone).slice(0, 10);
}

export function todayKey(zone: string, now: number = Date.now()): DayKey {
  return dayKeyInZone(now, zone);
}

/**
 * The instant range [from, to) covering the days firstKey..lastKey (inclusive)
 * in a zone: local midnight of the first day to local midnight after the last.
 */
export function dayRange(firstKey: DayKey, lastKey: DayKey, zone: string): { from: string; to: string } {
  const from = zonedWallTimeToIso(`${firstKey}T00:00`, zone);
  const to = zonedWallTimeToIso(`${addDays(lastKey, 1)}T00:00`, zone);
  if (!from || !to) throw new Error("Invalid day range");
  return { from, to };
}

/** The visible range of a view: the month grid, one week, or the calendar month (list). */
export function visibleRange(view: "month" | "week" | "list", cursor: DayKey): { first: DayKey; last: DayKey } {
  if (view === "week") {
    const days = weekDays(cursor);
    return { first: days[0], last: days[6] };
  }
  if (view === "list") return { first: startOfMonth(cursor), last: endOfMonth(cursor) };
  const grid = monthGrid(cursor);
  return { first: grid[0][0], last: grid[grid.length - 1][6] };
}

export interface Spans {
  startsAt: string;
  endsAt: string;
}

/** Items that touch a given day in a zone (a multi-day item appears on each day it covers), earliest first. */
export function itemsOnDay<T extends Spans>(items: T[], key: DayKey, zone: string): T[] {
  return items
    .filter((it) => {
      const start = dayKeyInZone(it.startsAt, zone);
      const endMs = new Date(it.endsAt).getTime();
      const end = endMs > new Date(it.startsAt).getTime() ? dayKeyInZone(endMs - 1, zone) : start;
      return start <= key && key <= end;
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}

/** "October 2026" for a day key. */
export function formatMonthTitle(key: DayKey): string {
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(utc(key));
}

/** "Tue 20 Oct" for a day key. */
export function formatDayLabel(key: DayKey): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(utc(key));
}

/** "10:00 am" for an instant in a zone. */
export function formatTimeInZone(iso: string, zone: string): string {
  return new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: zone }).format(new Date(iso));
}
