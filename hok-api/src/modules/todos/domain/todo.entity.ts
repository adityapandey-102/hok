/**
 * Pure domain shapes for My to-dos (round 1, decision 2026-11-02): private,
 * per-person to-do lists. Nobody else reads them, the Admin included.
 * Instants are ISO strings (UTC).
 */

export const TODO_URGENCIES = ["low", "medium", "high", "urgent"] as const;
export type TodoUrgency = (typeof TODO_URGENCIES)[number];

export const TODO_TITLE_MAX = 200;
export const TODO_NOTES_MAX = 2000;

/** A to-do as stored: one shape for list rows and every write's response (the owner is implied: it is always the caller's). */
export interface TodoEntity {
  id: string;
  title: string;
  notes: string | null;
  dueAt: string | null;
  urgency: TodoUrgency;
  doneAt: string | null;
  /** The next reminder still to send; null = none left. Internal: never in a response. */
  nextRemindAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

/** `status` filter of GET /todos. */
export const TODO_STATUS_FILTERS = ["open", "done", "all"] as const;
export type TodoStatusFilter = (typeof TODO_STATUS_FILTERS)[number];
