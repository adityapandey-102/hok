/**
 * Pure domain shapes for client to-dos (REQUIREMENTS section 5.4, FR-CTSK-01..04).
 * A manager's internal to-dos for one client; never shown on the portal.
 * Instants are ISO strings (UTC).
 */

export const CLIENT_TODO_STATUSES = ["todo", "in_progress", "done"] as const;
export type ClientTodoStatus = (typeof CLIENT_TODO_STATUSES)[number];

export const CLIENT_TODO_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type ClientTodoPriority = (typeof CLIENT_TODO_PRIORITIES)[number];

export const CLIENT_TODO_TITLE_MAX = 200;
export const CLIENT_TODO_DESCRIPTION_MAX = 2000;

/** A to-do in full, as stored: one shape for list rows and every write's response. */
export interface ClientTodoEntity {
  id: string;
  clientId: string;
  /** The client's owner and status: needed for the row scope and the archived rule; not part of the response. */
  ownerId: string;
  clientStatus: "active" | "paused" | "archived";
  eventId: string | null;
  /** Joined in the same query, for display. */
  eventTitle: string | null;
  title: string;
  description: string | null;
  dueAt: string | null;
  priority: ClientTodoPriority;
  status: ClientTodoStatus;
  completedAt: string | null;
  createdBy: string | null;
  createdByName: string | null;
  /** Optimistic-lock token: send it back with a write; a stale one is 409 CLIENT_TODO_MODIFIED. */
  version: number;
  createdAt: string;
  updatedAt: string;
}

/** The fields a create/update sets. */
export interface ClientTodoFields {
  title: string;
  description: string | null;
  dueAt: string | null;
  priority: ClientTodoPriority;
  status: ClientTodoStatus;
  eventId: string | null;
}
