/**
 * Reminders (REQUIREMENTS FR-EVT-10, FR-TSK-11, FR-NTF-07; ARCHITECTURE §9).
 *
 * One reminder per event (to the client's owner) and per open task with a due
 * time (to the assignee), about 2 hours ahead. A background check inside the
 * API looks every 10 minutes, so a reminder arrives within 10 minutes after
 * its moment (between 2 h and 1 h 50 min ahead). Anything whose moment has
 * already passed by the time the check runs (the API was down) is skipped, not
 * sent late: "starts in 2 hours" about a shoot that already began helps no one.
 */

/** How far ahead a reminder goes out. */
export const REMINDER_LEAD_MS = 2 * 60 * 60 * 1000;
/** How often the API looks for due reminders. */
export const REMINDER_CHECK_EVERY_MS = 10 * 60 * 1000;
/** The first look after the API starts (a deploy doesn't wait a full interval). */
export const REMINDER_FIRST_CHECK_MS = 30 * 1000;
/** At most this many of each kind per claim, so one check can never swamp the API. */
export const REMINDER_BATCH = 50;
/** A full batch means more may be waiting: claim again, but never more than this many times per check. */
export const REMINDER_MAX_ROUNDS = 10;

/** The moments a check covers: strictly after `now`, up to `now + lead`. */
export function reminderWindow(now: Date, leadMs = REMINDER_LEAD_MS): { after: Date; until: Date } {
  return { after: now, until: new Date(now.getTime() + leadMs) };
}
