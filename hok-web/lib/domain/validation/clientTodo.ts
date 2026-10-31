import { z } from "zod";
import { CLIENT_TODO_PRIORITIES, CLIENT_TODO_STATUSES, type ClientTodoPriority, type ClientTodoStatus } from "../types/clientTodo";
import { zonedWallTimeToIso } from "../utils/zonedTime";

/** The to-do form's raw values (all strings, as the inputs hold them). */
export interface ClientTodoFormValues {
  title: string;
  description: string;
  priority: ClientTodoPriority;
  status: ClientTodoStatus;
  /** "YYYY-MM-DDTHH:mm" in the viewer's zone, or "". */
  due: string;
  eventId: string;
}

/** Light client-side check of the to-do form; hok-api re-validates everything. */
export const clientTodoFormSchema = z.object({
  title: z.string().trim().min(1, "Please enter a title").max(200, "The title is too long (200 characters at most)"),
  description: z.string().max(2000, "The description is too long (2000 characters at most)"),
  priority: z.enum(CLIENT_TODO_PRIORITIES),
  status: z.enum(CLIENT_TODO_STATUSES),
  due: z.string().refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v), "Pick a due date and time"),
  eventId: z.string(),
});

/**
 * The API body for create (blank optional fields omitted; status is not sent,
 * a new to-do is always "to do") or edit (blank ones sent as null so they
 * clear). The due date is the viewer's wall time in their zone, sent as an
 * instant with its offset.
 */
export function buildClientTodoPayload(values: ClientTodoFormValues, zone: string, editing: boolean) {
  const blank = editing ? null : undefined;
  return {
    title: values.title.trim(),
    description: values.description.trim() || blank,
    priority: values.priority,
    ...(editing ? { status: values.status } : {}),
    dueAt: values.due ? zonedWallTimeToIso(values.due, zone) : blank,
    eventId: values.eventId || blank,
  };
}
