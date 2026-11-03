import { z } from "zod";
import { STAFF_TASK_PRIORITIES, TASK_BRIEF_LINKS_MAX_ON_CREATE, type StaffTaskPriority } from "../types/staffTask";
import { zonedWallTimeToIso } from "../utils/zonedTime";
import { isHttpUrl } from "./asset";

/** One row of the form's "Brief links" list, as typed. */
export interface BriefLinkRow {
  url: string;
  label: string;
}

/** The task form's raw values (all strings, as the inputs hold them). */
export interface StaffTaskFormValues {
  title: string;
  description: string;
  /** The script or instructions (every task has one, optional). */
  brief: string;
  assigneeId: string;
  /** Create only: the task template whose stages the task copies. */
  templateId: string;
  priority: StaffTaskPriority;
  /** "YYYY-MM-DDTHH:mm" in the creator's zone, or "". */
  due: string;
  clientId: string;
  eventId: string;
  /** Create only; after that links are added on the task page. */
  links: BriefLinkRow[];
}

/** A row the user left empty is ignored, not an error. */
function filledLinks(rows: readonly BriefLinkRow[]): BriefLinkRow[] {
  return rows.filter((r) => r.url.trim() || r.label.trim());
}

/**
 * Light client-side check of the task form; hok-api re-validates everything.
 * The template is required on create only (`creating`): an edit keeps the
 * stages the task already has.
 */
export function staffTaskFormSchema(creating: boolean) {
  return z
    .object({
      title: z.string().trim().min(1, "Please enter a title").max(160, "The title is too long"),
      description: z.string().max(5000, "The description is too long"),
      brief: z.string().max(20_000, "The brief is too long"),
      assigneeId: z.string().min(1, "Choose who the task is for"),
      templateId: creating ? z.string().min(1, "Pick a task template") : z.string(),
      priority: z.enum(STAFF_TASK_PRIORITIES),
      due: z.string().refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v), "Pick a due date and time"),
      clientId: z.string(),
      eventId: z.string(),
      links: z.array(z.object({ url: z.string(), label: z.string().max(120, "The label is too long") })),
    })
    .superRefine((v, ctx) => {
      const rows = filledLinks(v.links);
      if (rows.length > TASK_BRIEF_LINKS_MAX_ON_CREATE) {
        ctx.addIssue({ code: "custom", path: ["links"], message: `At most ${TASK_BRIEF_LINKS_MAX_ON_CREATE} links` });
      }
      if (rows.some((r) => !isHttpUrl(r.url))) {
        ctx.addIssue({ code: "custom", path: ["links"], message: "Each link needs a full address starting with https://" });
      }
    });
}

/**
 * The API body for create (blank optional fields omitted; template and links
 * included) or edit (blank ones sent as null so they clear; no template, no
 * links). The due date is the creator's wall time in their zone, sent as an
 * instant with its offset.
 */
export function buildStaffTaskPayload(values: StaffTaskFormValues, zone: string, editing: boolean) {
  const blank = editing ? null : undefined;
  const text = (s: string) => s.trim() || blank;
  const base = {
    title: values.title.trim(),
    description: text(values.description),
    brief: text(values.brief),
    assigneeId: values.assigneeId,
    priority: values.priority,
    dueAt: values.due ? zonedWallTimeToIso(values.due, zone) : blank,
    clientId: values.clientId || blank,
    eventId: values.eventId || blank,
  };
  if (editing) return base;
  const links = filledLinks(values.links).map((r) => ({ url: r.url.trim(), ...(r.label.trim() ? { label: r.label.trim() } : {}) }));
  return { ...base, templateId: values.templateId, links: links.length ? links : undefined };
}
