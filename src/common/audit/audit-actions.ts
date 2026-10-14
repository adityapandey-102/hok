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
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

/** Entity types an audit record can reference. */
export const AUDIT_ENTITIES = {
  USER: "user",
  SESSION: "session",
  CLIENT: "client",
  STAGE_TEMPLATE: "stage_template",
  EVENT: "event",
} as const;

export type AuditEntity = (typeof AUDIT_ENTITIES)[keyof typeof AUDIT_ENTITIES];
