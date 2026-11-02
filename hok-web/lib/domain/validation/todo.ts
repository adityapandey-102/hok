import { z } from "zod";
import { TODO_URGENCIES, type TodoUrgency } from "../types/todo";
import { zonedWallTimeToIso } from "../utils/zonedTime";

/** The to-do form's raw values (all strings, as the inputs hold them). */
export interface TodoFormValues {
  title: string;
  notes: string;
  urgency: TodoUrgency;
  /** "YYYY-MM-DDTHH:mm" in the viewer's zone, or "". */
  due: string;
}

/** Light client-side check of the to-do form; hok-api re-validates everything. */
export const todoFormSchema = z.object({
  title: z.string().trim().min(1, "Please enter a title").max(200, "The title is too long (200 characters at most)"),
  notes: z.string().max(2000, "The notes are too long (2000 characters at most)"),
  urgency: z.enum(TODO_URGENCIES),
  due: z.string().refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v), "Pick a due date and time"),
});

/**
 * The API body for create (blank optional fields omitted) or edit (blank ones
 * sent as null so they clear). The due time is the viewer's wall time in their
 * zone, sent as an instant with its offset.
 */
export function buildTodoPayload(values: TodoFormValues, zone: string, editing: boolean) {
  const blank = editing ? null : undefined;
  return {
    title: values.title.trim(),
    notes: values.notes.trim() || blank,
    urgency: values.urgency,
    dueAt: values.due ? zonedWallTimeToIso(values.due, zone) : blank,
  };
}
