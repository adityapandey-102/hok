import { addDays, dayKeyInZone, zonedMidnight } from "../../../domain";
import { BadRequestError } from "../../../common/errors/app-error";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import { REPORT_MONTHS, WORKING_WINDOW_HOURS, type MonthWeek, type MonthWindow, type TeamStatus } from "./report.entity";

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** "YYYY-MM" -> its year and month (1-12), or null. */
export function parseMonth(month: string): { year: number; month: number } | null {
  const m = MONTH_RE.exec(month);
  return m ? { year: Number(m[1]), month: Number(m[2]) } : null;
}

const pad = (n: number) => String(n).padStart(2, "0");
const monthKey = (year: number, month: number) => `${year}-${pad(month)}`;
const firstDay = (year: number, month: number) => `${monthKey(year, month)}-01`;
const nextFirstDay = (year: number, month: number) => (month === 12 ? firstDay(year + 1, 1) : firstDay(year, month + 1));

/** The months a report may cover, newest first: the viewer's current month and the 5 before it. */
export function allowedMonths(now: Date, timeZone: string): string[] {
  const [y, m] = dayKeyInZone(now, timeZone).split("-").map(Number) as [number, number];
  return Array.from({ length: REPORT_MONTHS }, (_, i) => {
    const idx = y * 12 + (m - 1) - i;
    return monthKey(Math.floor(idx / 12), (idx % 12) + 1);
  });
}

/**
 * The month as [from, to) in the viewer's zone. Anything outside the last
 * REPORT_MONTHS (a future month, an older one) is a 400.
 */
export function monthWindow(month: string, now: Date, timeZone: string): MonthWindow {
  const p = parseMonth(month);
  if (!p || !allowedMonths(now, timeZone).includes(month)) {
    throw new BadRequestError(`Reports cover the last ${REPORT_MONTHS} months only.`, ERROR_CODES.REPORT_MONTH_OUT_OF_RANGE);
  }
  return {
    month,
    timeZone,
    from: zonedMidnight(firstDay(p.year, p.month), timeZone).toISOString(),
    to: zonedMidnight(nextFirstDay(p.year, p.month), timeZone).toISOString(),
  };
}

/** Day of week of a calendar day key, 0 = Monday .. 6 = Sunday. */
function weekday(key: string): number {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

/** The month's Monday-start weeks, the first and last clipped to the month, in the viewer's zone. */
export function monthWeeks(month: string, timeZone: string): MonthWeek[] {
  const p = parseMonth(month)!;
  const end = nextFirstDay(p.year, p.month);
  const weeks: MonthWeek[] = [];
  let start = firstDay(p.year, p.month);
  while (start < end) {
    const rawNext = addDays(start, 7 - weekday(start));
    const next = rawNext < end ? rawNext : end;
    weeks.push({
      startDay: start,
      endDay: addDays(next, -1),
      from: zonedMidnight(start, timeZone).toISOString(),
      to: zonedMidnight(next, timeZone).toISOString(),
    });
    start = next;
  }
  return weeks;
}

/** Working = open tasks AND (seen OR acted in the last WORKING_WINDOW_HOURS). Everyone else is idle. */
export function teamStatus(input: { openTasks: number; lastSeenAt: Date | null; activityLast24h: number; now: Date }): TeamStatus {
  if (input.openTasks <= 0) return "idle";
  const since = input.now.getTime() - WORKING_WINDOW_HOURS * 3_600_000;
  const seen = input.lastSeenAt !== null && input.lastSeenAt.getTime() >= since;
  return seen || input.activityLast24h > 0 ? "working" : "idle";
}
