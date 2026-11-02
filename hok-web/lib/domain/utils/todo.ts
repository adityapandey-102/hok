import { dayKeyInZone, formatTimeInZone, type DayKey } from "./calendar";

/** Whole days from day key `a` to day key `b` (positive when `b` is later). */
function dayDiff(a: DayKey, b: DayKey): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export interface TodoDueLabel {
  text: string;
  /** Past its due moment and not done. */
  overdue: boolean;
  /** Due later today. */
  today: boolean;
}

/**
 * The due label of a to-do, by calendar day in the viewer's zone:
 * "Today 5:00 pm", "Tomorrow 9:00 am", "Wed 4 Nov, 2:00 pm", "Overdue · 2 days"
 * (or "Overdue · today 9:00 am" earlier the same day). Done to-dos show their
 * plain date; no due date gives "No due date".
 */
export function todoDueLabel(dueAt: string | null, done: boolean, zone: string, now: number = Date.now()): TodoDueLabel {
  if (!dueAt) return { text: "No due date", overdue: false, today: false };
  const time = formatTimeInZone(dueAt, zone);
  const diff = dayDiff(dayKeyInZone(now, zone), dayKeyInZone(dueAt, zone));
  const past = Date.parse(dueAt) < now;
  if (done) {
    return { text: `${new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: zone }).format(new Date(dueAt))}, ${time}`, overdue: false, today: false };
  }
  if (diff < 0) return { text: `Overdue · ${-diff} ${-diff === 1 ? "day" : "days"}`, overdue: true, today: false };
  if (diff === 0) return past ? { text: `Overdue · today ${time}`, overdue: true, today: false } : { text: `Today ${time}`, overdue: false, today: true };
  if (diff === 1) return { text: `Tomorrow ${time}`, overdue: false, today: false };
  const date = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: zone }).format(new Date(dueAt));
  return { text: `${date}, ${time}`, overdue: false, today: false };
}

/** The default due time for something added from a calendar day: 17:00 that day, as the "YYYY-MM-DDTHH:mm" the form's input holds (viewer's zone). */
export function defaultDueForDay(day: DayKey): string {
  return `${day}T17:00`;
}
