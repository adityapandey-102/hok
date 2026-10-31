import { BadRequestError } from "../../../common/errors/app-error";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import { ACTIVITY_DEFAULT_DAYS, ACTIVITY_MAX_SPAN_DAYS, type ActivityItem, type ActivityRow } from "./activity.entity";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The window to read: default "the last 7 days" (ending now). `from` after
 * `to`, or a span over 31 days, is a 400 ACTIVITY_RANGE_INVALID.
 */
export function resolveActivityRange(input: { from?: Date; to?: Date }, now: Date): { from: Date; to: Date } {
  const to = input.to ?? now;
  const from = input.from ?? new Date(to.getTime() - ACTIVITY_DEFAULT_DAYS * DAY_MS);
  if (from.getTime() > to.getTime()) {
    throw new BadRequestError("`from` must not be after `to`", ERROR_CODES.ACTIVITY_RANGE_INVALID);
  }
  if (to.getTime() - from.getTime() > ACTIVITY_MAX_SPAN_DAYS * DAY_MS) {
    throw new BadRequestError(`The range can be at most ${ACTIVITY_MAX_SPAN_DAYS} days`, ERROR_CODES.ACTIVITY_RANGE_INVALID);
  }
  return { from, to };
}

const STATUS_LABELS: Record<string, string> = {
  todo: "To do",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
  received: "Received",
  solved: "Solved",
};

/** "in_progress" -> "In progress": raw codes never reach a sentence. */
export function statusLabel(code: string | null | undefined): string {
  if (!code) return "a new status";
  const known = STATUS_LABELS[code];
  if (known) return known;
  const spaced = code.replace(/_/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const named = (value: string | null, fallback: string) => (value && value.trim() ? value : fallback);

/** A sentence for an audit_log action. Names and titles only, never values. */
function describeAudit(r: ActivityRow, who: string): string {
  const client = named(r.clientName, "a client");
  const theClient = r.clientName ? `the client ${r.clientName}` : "a client";
  const theEvent = r.eventTitle ? `the event ${r.eventTitle}` : "an event";
  const theTask = r.taskTitle ? `the task ${r.taskTitle}` : "a task";
  const person = named(r.targetUserName, "a team member");
  switch (r.action) {
    case "auth.login":
      return `${who} signed in`;
    case "auth.logout":
      return `${who} signed out`;
    case "auth.password_changed":
      return `${who} changed their password`;
    case "auth.bootstrap":
      return `${who} set up the first Admin account`;
    case "user.created":
      return `${who} created the account for ${person}`;
    case "user.updated":
      return `${who} updated the account of ${person}`;
    case "user.deactivated":
      return `${who} deactivated the account of ${person}`;
    case "user.reactivated":
      return `${who} reactivated the account of ${person}`;
    case "user.password_regenerated":
      return `${who} reset the password of ${person}`;
    case "user.profile_updated":
      return `${who} updated their profile`;
    case "calendar_feed.created":
      return `${who} made a calendar subscribe link`;
    case "calendar_feed.revoked":
      return `${who} turned off their calendar subscribe link`;
    case "client.created":
      return `${who} added ${theClient}`;
    case "client.updated":
      return `${who} updated ${theClient}`;
    case "client.archived":
      return `${who} archived ${theClient}`;
    case "client.unarchived":
      return `${who} restored ${theClient}`;
    case "client.reassigned":
      return r.subjectName ? `${who} moved ${theClient} to ${r.subjectName}` : `${who} moved ${theClient} to another manager`;
    case "portal_link.generated":
      return `${who} created a portal link for ${client}`;
    case "portal_link.disabled":
      return `${who} turned off the portal link for ${client}`;
    case "event.created":
      return `${who} created ${theEvent}`;
    case "event.updated":
      return `${who} updated ${theEvent}`;
    case "personal_event.created":
      return `${who} added a personal event`;
    case "personal_event.updated":
      return `${who} updated a personal event`;
    case "personal_event.deleted":
      return `${who} deleted a personal event`;
    case "stage_template.created":
      return r.templateName ? `${who} created the stage template ${r.templateName}` : `${who} created a stage template`;
    case "stage_template.updated":
      return r.templateName ? `${who} updated the stage template ${r.templateName}` : `${who} updated a stage template`;
    case "staff_task.created":
      return `${who} created ${theTask}`;
    case "staff_task.updated":
      return `${who} edited ${theTask}`;
    case "staff_task.reassigned":
      return `${who} reassigned ${theTask}`;
    case "staff_task.deleted":
      return `${who} deleted a task`;
    case "client_todo.created":
      return r.todoTitle ? `${who} added the to-do ${r.todoTitle} for ${client}` : `${who} added a to-do for ${client}`;
    case "client_todo.updated":
      return r.todoTitle ? `${who} updated the to-do ${r.todoTitle} for ${client}` : `${who} updated a to-do for ${client}`;
    case "client_todo.deleted":
      return `${who} deleted a to-do`;
    case "comment.updated":
      return `${who} replied to a comment from ${client}`;
    case "asset.created":
      return r.assetTitle ? `${who} added the asset ${r.assetTitle}` : `${who} added an asset`;
    case "asset.updated":
      return r.assetTitle ? `${who} updated the asset ${r.assetTitle}` : `${who} updated an asset`;
    case "asset.deleted":
      return r.assetTitle ? `${who} removed the asset ${r.assetTitle}` : `${who} removed an asset`;
    default:
      return `${who} made a change (${r.action.replace(/[._]/g, " ")})`;
  }
}

/** The plain-English sentence for a row. Pure: built from structured fields only. */
export function describeActivity(r: ActivityRow): string {
  const who = named(r.actorName, "Someone");
  switch (r.source) {
    case "audit":
      return describeAudit(r, who);
    case "stage":
      return `${who} moved ${named(r.eventTitle, "an event")} to ${named(r.stageName, "a new stage")}`;
    case "task": {
      const task = named(r.taskTitle, "a task");
      if (r.action === "status") return `${who} marked ${task} as ${statusLabel(r.toStatus)}`;
      if (r.action === "comment") return `${who} commented on ${task}`;
      if (r.action === "reassigned") return r.subjectName ? `${who} reassigned ${task} to ${r.subjectName}` : `${who} reassigned ${task}`;
      if (r.action === "reopened") return `${who} reopened ${task}`;
      return `${who} updated ${task}`;
    }
    case "comment":
      return `${named(r.clientName, "A client")} posted a comment`;
    case "comment_status":
      return `${who} marked a comment from ${named(r.clientName, "a client")} as ${statusLabel(r.toStatus)}`;
  }
}

/** Where the row's subject lives in the staff app, or null when there is no page for it. */
export function activityUrl(r: ActivityRow): string | null {
  if (r.source === "stage" || r.action.startsWith("event.")) return r.eventId && r.eventTitle ? `/app/events/${r.eventId}` : null;
  if (r.source === "task" || r.action.startsWith("staff_task.")) return r.taskId && r.taskTitle ? `/app/tasks/${r.taskId}` : null;
  if (r.kind === "comments") return "/app/comments";
  if (r.kind === "assets") return r.assetTitle ? "/app/assets" : null;
  if (r.action.startsWith("user.")) {
    return r.targetUserId && r.targetUserName && r.action !== "user.profile_updated" ? `/app/admin/users/${r.targetUserId}` : null;
  }
  if (r.kind === "clients" || r.action.startsWith("client_todo.")) return r.clientId && r.clientName ? `/app/clients/${r.clientId}` : null;
  return null;
}

export function toActivityItem(r: ActivityRow): ActivityItem {
  return {
    id: r.id,
    at: r.at.toISOString(),
    kind: r.kind,
    actor: r.actorId && r.actorName ? { id: r.actorId, name: r.actorName } : null,
    summary: describeActivity(r),
    url: activityUrl(r),
  };
}
