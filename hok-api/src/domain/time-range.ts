/**
 * Time-span checks shared by every module that stores scheduled things
 * (client events, personal events, the calendar feed, the portal calendar).
 * Pure functions returning a problem message (or null); each module throws
 * its own registered error code with it.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Longest scheduled item anywhere in HOK; lets range queries bound their scan on starts_at. */
export const MAX_ITEM_DAYS = 31;
/** Widest range one calendar request may ask for. */
export const MAX_RANGE_DAYS = 92;

/** Null when `endsAt` is on/after `startsAt` and the span is at most `maxDays`; else why not. */
export function spanProblem(startsAt: string, endsAt: string, maxDays = MAX_ITEM_DAYS): string | null {
  const start = Date.parse(startsAt);
  const end = Date.parse(endsAt);
  if (Number.isNaN(start) || Number.isNaN(end)) return "Use ISO date-times with an offset";
  if (end < start) return "It can't end before it starts";
  if (end - start > maxDays * DAY_MS) return `It can last at most ${maxDays} days`;
  return null;
}

/** Null for a valid calendar range (`to` after `from`, at most `maxDays`); else why not. */
export function rangeProblem(from: string, to: string, maxDays = MAX_RANGE_DAYS): string | null {
  const span = Date.parse(to) - Date.parse(from);
  if (Number.isNaN(span) || !(span > 0)) return "`to` must be after `from`";
  if (span > maxDays * DAY_MS) return `A range can span at most ${maxDays} days`;
  return null;
}

/** The earliest starts_at an item overlapping [from, …) can have, given the MAX_ITEM_DAYS cap. */
export function scanLowerBound(from: string): Date {
  return new Date(Date.parse(from) - MAX_ITEM_DAYS * DAY_MS);
}
