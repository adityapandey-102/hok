import { type ClientTodoPriority } from "../../../lib/domain";

/** Left accent per priority: urgent crimson, high amber, the rest a quiet hairline. */
export const TODO_PRIORITY_ACCENT: Record<ClientTodoPriority, string> = {
  low: "bg-border",
  medium: "bg-border",
  high: "bg-warning",
  urgent: "bg-primary",
};

/** The friendly message for a to-do API error code (falls back to the server's message). */
export function describeTodoError(err: unknown, fallback: string): string {
  const code = (err as { code?: string } | null)?.code;
  switch (code) {
    case "CLIENT_TODO_MODIFIED":
      return "Someone else changed this to-do. Close this and reopen it to see the latest.";
    case "CLIENT_TODO_NOT_FOUND":
      return "This to-do no longer exists.";
    case "CLIENT_TODO_EVENT_INVALID":
      return "Pick one of this client's events.";
    case "CLIENT_ARCHIVED":
      return "This client is archived and read-only.";
    default:
      return err instanceof Error ? err.message : fallback;
  }
}
