/**
 * Registry of the actions `audit_log` records. Like ERROR_CODES, these strings
 * are a stable vocabulary -- reports group by them -- so add new ones here
 * rather than inlining a literal at a call site.
 *
 * audit_log holds sign-ins, account events and client lifecycle events
 * (create / edit / archive / reassign, ADR 0005). Business changes (event stage
 * moves, comment status changes, task updates) get their own typed history
 * tables, written in the same transaction as the change -- needleye's pattern
 * (its ADR 0008).
 *
 * Convention: `<entity>.<verb>` in past tense-ish dotted form.
 */
export const AUDIT_ACTIONS = {
  // Auth / session
  AUTH_LOGIN: "auth.login",
  AUTH_LOGOUT: "auth.logout",
  AUTH_PASSWORD_CHANGED: "auth.password_changed",
  /** The one-time first-Admin setup ran (POST /auth/bootstrap). */
  AUTH_BOOTSTRAP: "auth.bootstrap",

  // Users / accounts (Admin administration)
  USER_CREATED: "user.created",
  USER_UPDATED: "user.updated",
  USER_DEACTIVATED: "user.deactivated",
  USER_REACTIVATED: "user.reactivated",
  USER_PASSWORD_REGENERATED: "user.password_regenerated",
  /** A user edited their own profile (name, phone, time zone, photo URL). */
  USER_PROFILE_UPDATED: "user.profile_updated",

  // Clients
  CLIENT_CREATED: "client.created",
  /** Profile fields or active/paused status changed; metadata lists the fields (never their values). */
  CLIENT_UPDATED: "client.updated",
  CLIENT_ARCHIVED: "client.archived",
  CLIENT_UNARCHIVED: "client.unarchived",
  /** The Admin moved a client to another manager; metadata { from, to } owner ids. */
  CLIENT_REASSIGNED: "client.reassigned",

  // Stage templates (Admin)
  STAGE_TEMPLATE_CREATED: "stage_template.created",
  /** Name, stage list or active flag changed; metadata lists which. */
  STAGE_TEMPLATE_UPDATED: "stage_template.updated",

  // Events. Stage moves are NOT audited here: event_stage_history is their
  // typed, append-only history (who, when, note), written in the same transaction.
  EVENT_CREATED: "event.created",
  /** Details, schedule or state changed; metadata lists the fields (never their values). */
  EVENT_UPDATED: "event.updated",

  // Personal events (M5): owner-only calendar entries. Field names only, never values.
  PERSONAL_EVENT_CREATED: "personal_event.created",
  PERSONAL_EVENT_UPDATED: "personal_event.updated",
  PERSONAL_EVENT_DELETED: "personal_event.deleted",

  // Calendar subscribe link (FR-CAL-08), the person's own. The token is never logged or audited.
  CALENDAR_FEED_CREATED: "calendar_feed.created",
  CALENDAR_FEED_REVOKED: "calendar_feed.revoked",

  // Client portal (M8). The token itself is never logged or audited.
  PORTAL_LINK_GENERATED: "portal_link.generated",
  PORTAL_LINK_DISABLED: "portal_link.disabled",
  // Client comments (M8). Status changes are ALSO in client_comment_history (the typed record).
  COMMENT_UPDATED: "comment.updated",

  // Assets (link library). Metadata carries ids / field names, never the URL.
  ASSET_CREATED: "asset.created",
  ASSET_UPDATED: "asset.updated",
  /** Soft delete. */
  ASSET_DELETED: "asset.deleted",

  // Staff tasks (Admin's actions). Status changes, comments and reopens are NOT
  // audited here: staff_task_updates is their typed, append-only timeline.
  STAFF_TASK_CREATED: "staff_task.created",
  /** Fields edited; metadata lists the field names (never their values). */
  STAFF_TASK_UPDATED: "staff_task.updated",
  /** metadata { from, to } assignee ids. */
  STAFF_TASK_REASSIGNED: "staff_task.reassigned",
  /** Hard delete (its timeline goes with it); this entry is the trace. */
  STAFF_TASK_DELETED: "staff_task.deleted",

  // Client to-dos (Phase 2). Metadata carries ids / field names, never the text.
  CLIENT_TODO_CREATED: "client_todo.created",
  CLIENT_TODO_UPDATED: "client_todo.updated",
  /** Hard delete; this entry is the trace. */
  CLIENT_TODO_DELETED: "client_todo.deleted",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

/** Entity types an audit record can reference. */
export const AUDIT_ENTITIES = {
  USER: "user",
  SESSION: "session",
  CLIENT: "client",
  STAGE_TEMPLATE: "stage_template",
  EVENT: "event",
  PERSONAL_EVENT: "personal_event",
  PORTAL_LINK: "portal_link",
  COMMENT: "comment",
  ASSET: "asset",
  STAFF_TASK: "staff_task",
  CLIENT_TODO: "client_todo",
} as const;

export type AuditEntity = (typeof AUDIT_ENTITIES)[keyof typeof AUDIT_ENTITIES];
