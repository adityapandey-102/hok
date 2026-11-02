import { ConflictError } from "../../../common/errors/app-error";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import type { TodoUrgency } from "./todo.entity";

/**
 * To-do rules. Pure functions (ADR 0002). There is no visibility rule: every
 * query already carries `owner_id = caller`, so another person's to-do is a
 * plain 404 (the Admin's included).
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Reminder offsets before the due time, per urgency (decision 2026-11-02). Largest first. */
const OFFSETS_MS: Record<TodoUrgency, readonly number[]> = {
  urgent: [DAY, HOUR, 0],
  high: [HOUR, 0],
  medium: [0],
  low: [],
};

/**
 * The earliest reminder moment strictly after `after`, or null (no due date,
 * a low-urgency to-do, or every moment already passed). Recomputed on create
 * and on any change to the due time, the urgency or the done state; stepping
 * `after` forward as reminders go out walks through the offsets in order.
 */
export function nextTodoReminder(dueAt: Date | null, urgency: TodoUrgency, after: Date): Date | null {
  if (!dueAt) return null;
  for (const offset of OFFSETS_MS[urgency]) {
    const moment = dueAt.getTime() - offset;
    if (moment > after.getTime()) return new Date(moment);
  }
  return null;
}

/**
 * How late a reminder may still go out (the API was down, a check was
 * missed). Older ones are skipped silently: "due in 1 h" an hour after the
 * fact helps no one. Wider than the task reminder's tolerance because to-do
 * moments are exact rather than "about 2 hours ahead".
 */
export const TODO_REMINDER_GRACE_MS = 30 * 60 * 1000;

/** Optimistic lock. */
export function assertTodoVersion(current: number, expected: number): void {
  if (current !== expected) {
    throw new ConflictError("This to-do was changed elsewhere. Reload and try again.", ERROR_CODES.TODO_MODIFIED);
  }
}
