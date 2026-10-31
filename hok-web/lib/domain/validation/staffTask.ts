import { z } from "zod";
import type { Role } from "../constants/roles";
import { STAFF_TASK_PRIORITIES, isEditorRole, type StaffTaskPriority } from "../types/staffTask";
import { zonedWallTimeToIso } from "../utils/zonedTime";
import { isHttpUrl } from "./asset";

/** The task form's raw values (all strings, as the inputs hold them). */
export interface StaffTaskFormValues {
  title: string;
  description: string;
  assigneeId: string;
  priority: StaffTaskPriority;
  /** "YYYY-MM-DDTHH:mm" in the Admin's zone, or "". */
  due: string;
  clientId: string;
  eventId: string;
  rawFilesUrl: string;
  referenceUrl: string;
  script: string;
  /** One link per line. */
  referenceLinks: string;
}

const optionalUrl = z
  .string()
  .trim()
  .refine((v) => v === "" || isHttpUrl(v), "Use a full link starting with https://");

/**
 * Light client-side check of the task form; hok-api re-validates everything.
 * `assigneeRole` decides the editor rule (FR-TSK-10): an editor task needs the
 * raw files link; reference link and script are optional.
 */
export function staffTaskFormSchema(assigneeRole: Role | null) {
  return z
    .object({
      title: z.string().trim().min(1, "Please enter a title").max(160, "The title is too long"),
      description: z.string().max(5000, "The description is too long"),
      assigneeId: z.string().min(1, "Choose who the task is for"),
      priority: z.enum(STAFF_TASK_PRIORITIES),
      due: z.string().refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v), "Pick a due date and time"),
      clientId: z.string(),
      eventId: z.string(),
      rawFilesUrl: optionalUrl,
      referenceUrl: optionalUrl,
      script: z.string().max(20_000, "The script is too long"),
      referenceLinks: z.string().refine(
        (v) => parseReferenceLinks(v).every((l) => isHttpUrl(l.url)),
        "Each reference link must be a full https:// link, one per line",
      ),
    })
    .refine((v) => !isEditorRole(assigneeRole) || v.rawFilesUrl.trim() !== "", {
      path: ["rawFilesUrl"],
      message: "An editor task needs the raw files (Google Drive) link",
    })
    .refine((v) => parseReferenceLinks(v.referenceLinks).length <= 10, {
      path: ["referenceLinks"],
      message: "At most 10 reference links",
    });
}

/** "https://a\n\n https://b " -> [{ url: "https://a" }, { url: "https://b" }]. */
export function parseReferenceLinks(text: string): { url: string; label: null }[] {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((url) => ({ url, label: null }));
}

/**
 * The API body for create (blank optional fields omitted) or edit (blank ones
 * sent as null so they clear). The due date is the Admin's wall time in their
 * zone, sent as an instant with its offset. The editor brief is sent only for
 * an editor; for anyone else it is cleared on edit (the API clears it on
 * reassign anyway).
 */
export function buildStaffTaskPayload(values: StaffTaskFormValues, assigneeRole: Role | null, zone: string, editing: boolean) {
  const blank = editing ? null : undefined;
  const text = (s: string) => s.trim() || blank;
  const editor = isEditorRole(assigneeRole);
  return {
    title: values.title.trim(),
    description: text(values.description),
    assigneeId: values.assigneeId,
    priority: values.priority,
    dueAt: values.due ? zonedWallTimeToIso(values.due, zone) : blank,
    clientId: values.clientId || blank,
    eventId: values.eventId || blank,
    referenceLinks: parseReferenceLinks(values.referenceLinks),
    rawFilesUrl: editor ? text(values.rawFilesUrl) : blank,
    referenceUrl: editor ? text(values.referenceUrl) : blank,
    script: editor ? text(values.script) : blank,
  };
}
