/**
 * The single registry of stable application error codes. Every error the API
 * returns carries one in its `{ error, code, details?, requestId }` body, and
 * **clients branch on the code, never on the message** -- messages are free to
 * change for humans; codes are the contract and must stay stable.
 *
 * Grouped by area. Generic HTTP-shaped codes (VALIDATION_ERROR, INTERNAL,
 * ROUTE_NOT_FOUND) cover the cases with no more specific meaning; everything
 * a client might reasonably want to distinguish gets its own code.
 *
 * Adding an error? Add its code here first, then reference it at the throw
 * site -- don't inline a string literal. Each milestone adds its module's
 * codes in its own group.
 */
export const ERROR_CODES = {
  // -- Generic / cross-cutting ------------------------------------------------
  /** Defaults of the AppError subclasses (app-error.ts), used when a throw site has no more specific code. */
  BAD_REQUEST: "BAD_REQUEST",
  UNAUTHORIZED: "UNAUTHORIZED",
  /** The caller's role lacks the route's capability (requireCapability), 403. */
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  VALIDATION_NO_FIELDS: "VALIDATION_NO_FIELDS",
  ROUTE_NOT_FOUND: "ROUTE_NOT_FOUND",
  RATE_LIMITED: "RATE_LIMITED",
  /** The JSON body is malformed (400). */
  MALFORMED_REQUEST: "MALFORMED_REQUEST",
  /** The body is over the route's size limit (413) -- e.g. the public portal's small limit. */
  PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",
  DATABASE_ERROR: "DATABASE_ERROR",
  /** A dependency (Supabase Auth) is unreachable, overloaded or erroring (503) -- retry, don't sign out. */
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  INTERNAL: "INTERNAL",

  // -- Auth / session ---------------------------------------------------------
  AUTH_TOKEN_MISSING: "AUTH_TOKEN_MISSING",
  AUTH_SESSION_INVALID: "AUTH_SESSION_INVALID",
  AUTH_INVALID_CREDENTIALS: "AUTH_INVALID_CREDENTIALS",
  AUTH_LINK_INVALID: "AUTH_LINK_INVALID",
  AUTH_PROFILE_MISSING: "AUTH_PROFILE_MISSING",
  AUTH_ACCOUNT_DEACTIVATED: "AUTH_ACCOUNT_DEACTIVATED",
  AUTH_BOOTSTRAP_ALREADY_DONE: "AUTH_BOOTSTRAP_ALREADY_DONE",
  AUTH_BOOTSTRAP_DISABLED: "AUTH_BOOTSTRAP_DISABLED",
  AUTH_BOOTSTRAP_KEY_INVALID: "AUTH_BOOTSTRAP_KEY_INVALID",
  AUTH_CURRENT_PASSWORD_INVALID: "AUTH_CURRENT_PASSWORD_INVALID",

  // -- Users ------------------------------------------------------------------
  USER_NOT_FOUND: "USER_NOT_FOUND",
  USER_CANNOT_DEACTIVATE_SELF: "USER_CANNOT_DEACTIVATE_SELF",
  /** Admin regenerating their own password, or another admin's after that admin has signed in (403). */
  USER_PASSWORD_SELF_MANAGED: "USER_PASSWORD_SELF_MANAGED",
  /** Admin changing their own role -- would let the last admin lock everyone out (400). */
  USER_CANNOT_CHANGE_OWN_ROLE: "USER_CANNOT_CHANGE_OWN_ROLE",
  /** Only the Owner (first Admin) can create, demote or deactivate an Admin, or regenerate an Admin's password (403). */
  USER_OWNER_ONLY: "USER_OWNER_ONLY",
  /** The Owner can never be demoted or deactivated (403). */
  USER_OWNER_PROTECTED: "USER_OWNER_PROTECTED",
  /** An account with this email already exists (409). */
  USER_EMAIL_TAKEN: "USER_EMAIL_TAKEN",

  // -- Clients ----------------------------------------------------------------
  /** No such client, or it belongs to another manager -- the same 404 either way, so existence never leaks. */
  CLIENT_NOT_FOUND: "CLIENT_NOT_FOUND",
  /** The write named an older `version` than the stored one (409): someone else changed it first. */
  CLIENT_MODIFIED: "CLIENT_MODIFIED",
  /** Editing or archiving a client that is already archived (409). Unarchive first. */
  CLIENT_ARCHIVED: "CLIENT_ARCHIVED",
  /** Unarchiving a client that isn't archived (409). */
  CLIENT_NOT_ARCHIVED: "CLIENT_NOT_ARCHIVED",
  /** A chosen lead or team member isn't an active client manager (admin / social media / marketing / project manager), or the team is too big (400). */
  CLIENT_OWNER_INVALID: "CLIENT_OWNER_INVALID",
  /** A manager tried to create a client led by someone else -- only the Admin may (403). */
  CLIENT_OWNER_FORBIDDEN: "CLIENT_OWNER_FORBIDDEN",
  /** Archive, unarchive and team changes are the Admin's; a team member who tries gets this (403). */
  CLIENT_ADMIN_ONLY: "CLIENT_ADMIN_ONLY",
  /** Only the client's lead (or the Admin) manages its portal link; another team member gets this (403). */
  PORTAL_LEAD_ONLY: "PORTAL_LEAD_ONLY",
  /** contract_end is before contract_start (400). */
  CLIENT_CONTRACT_DATES_INVALID: "CLIENT_CONTRACT_DATES_INVALID",

  // -- Stage templates (Admin) ---------------------------------------------------
  STAGE_TEMPLATE_NOT_FOUND: "STAGE_TEMPLATE_NOT_FOUND",
  /** Stale `version` on a template edit (409). */
  STAGE_TEMPLATE_MODIFIED: "STAGE_TEMPLATE_MODIFIED",
  /** Another template already has this name, ignoring case (409). */
  STAGE_TEMPLATE_NAME_TAKEN: "STAGE_TEMPLATE_NAME_TAKEN",
  /** Two stages with the same name (ignoring case) in one template (400). */
  STAGE_TEMPLATE_STAGES_INVALID: "STAGE_TEMPLATE_STAGES_INVALID",
  /** `roles` sent for an event template, or on a task template a role that can't be assigned tasks (400). */
  STAGE_TEMPLATE_ROLES_INVALID: "STAGE_TEMPLATE_ROLES_INVALID",

  // -- Events -------------------------------------------------------------------
  /** No such event, or it belongs to another manager's client -- the same 404 either way. */
  EVENT_NOT_FOUND: "EVENT_NOT_FOUND",
  /** Stale `version` on an event write (409). */
  EVENT_MODIFIED: "EVENT_MODIFIED",
  /** Ends before it starts, or lasts more than 31 days (400). */
  EVENT_TIMES_INVALID: "EVENT_TIMES_INVALID",
  /** The chosen stage template doesn't exist or is inactive (400). */
  EVENT_TEMPLATE_INVALID: "EVENT_TEMPLATE_INVALID",
  /** An assigned team member isn't an active staff account (400). */
  EVENT_TEAM_INVALID: "EVENT_TEAM_INVALID",
  /** The target stage isn't one of this event's stages (400). */
  EVENT_STAGE_INVALID: "EVENT_STAGE_INVALID",
  /** The event is already at that stage (409). */
  EVENT_STAGE_UNCHANGED: "EVENT_STAGE_UNCHANGED",
  /** Stage moves need an active event, not a cancelled or postponed one (409). */
  EVENT_NOT_ACTIVE: "EVENT_NOT_ACTIVE",
  /** `from`/`to` missing one side, reversed, or more than 92 days apart (400). */
  EVENT_RANGE_INVALID: "EVENT_RANGE_INVALID",

  // -- Personal events + calendar feed (M5) ---------------------------------------
  /** No such personal event, or someone else's (managers see only their own) -- 404 either way. */
  PERSONAL_EVENT_NOT_FOUND: "PERSONAL_EVENT_NOT_FOUND",
  PERSONAL_EVENT_MODIFIED: "PERSONAL_EVENT_MODIFIED",
  /** Ends before it starts, or lasts more than 31 days (400). */
  PERSONAL_EVENT_TIMES_INVALID: "PERSONAL_EVENT_TIMES_INVALID",
  /** `from`/`to` missing, reversed, or more than 92 days apart (400). */
  CALENDAR_RANGE_INVALID: "CALENDAR_RANGE_INVALID",
  /** Public: unknown, malformed, replaced or turned-off subscribe link, or a person who no longer has a calendar -- always the same 404. */
  CALENDAR_FEED_INVALID: "CALENDAR_FEED_INVALID",

  // -- Client portal + comments (M8) ----------------------------------------------
  /** Public: unknown, malformed, regenerated or disabled link, or an archived client -- always the same 404. */
  PORTAL_LINK_INVALID: "PORTAL_LINK_INVALID",
  /** Public: the event isn't one of this portal's client's events (404). */
  PORTAL_EVENT_NOT_FOUND: "PORTAL_EVENT_NOT_FOUND",
  /** No such comment, or one on another manager's client (404). */
  COMMENT_NOT_FOUND: "COMMENT_NOT_FOUND",
  COMMENT_MODIFIED: "COMMENT_MODIFIED",
  /** A status change the lifecycle doesn't allow (409), e.g. back to "received". */
  COMMENT_STATUS_TRANSITION_INVALID: "COMMENT_STATUS_TRANSITION_INVALID",

  // -- Assets (link library) ----------------------------------------------------
  /** No such asset (or soft-deleted), or it belongs to another manager's client -- the same 404 either way. */
  ASSET_NOT_FOUND: "ASSET_NOT_FOUND",
  /** Stale `version` on an asset write (409). */
  ASSET_MODIFIED: "ASSET_MODIFIED",
  /** The linked event doesn't exist or belongs to a different client (400). */
  ASSET_EVENT_INVALID: "ASSET_EVENT_INVALID",
  /** `from`/`to` reversed (400). */
  ASSET_RANGE_INVALID: "ASSET_RANGE_INVALID",
  /** Marking an asset visible to the client needs an event: the portal shows assets per event (400). */
  ASSET_CLIENT_VISIBLE_NEEDS_EVENT: "ASSET_CLIENT_VISIBLE_NEEDS_EVENT",
  /** The stage isn't one of the asset's event's stages (400). */
  ASSET_STAGE_INVALID: "ASSET_STAGE_INVALID",

  // -- Staff tasks ----------------------------------------------------------------
  /** No such task, or one the caller may not see (not theirs, not created by them, not their client's) -- the same 404 either way. */
  STAFF_TASK_NOT_FOUND: "STAFF_TASK_NOT_FOUND",
  /** Stale `version` on a task write (409). */
  STAFF_TASK_MODIFIED: "STAFF_TASK_MODIFIED",
  /** The assignee isn't an active staff account (400). */
  STAFF_TASK_ASSIGNEE_INVALID: "STAFF_TASK_ASSIGNEE_INVALID",
  /** The assignee's role is not below the caller's on the ladder: "You can only assign tasks to roles below yours" (400). */
  STAFF_TASK_ASSIGNEE_NOT_ALLOWED: "STAFF_TASK_ASSIGNEE_NOT_ALLOWED",
  /** The caller can see the task (their client's team) but isn't its creator or assignee, so may not write to it (403). */
  STAFF_TASK_FORBIDDEN: "STAFF_TASK_FORBIDDEN",
  /** The linked client doesn't exist (400). */
  STAFF_TASK_CLIENT_INVALID: "STAFF_TASK_CLIENT_INVALID",
  /** The linked event doesn't exist or belongs to another client (400). */
  STAFF_TASK_EVENT_INVALID: "STAFF_TASK_EVENT_INVALID",
  /** A stage move or block on a done task -- a manager reopens it first (409). */
  STAFF_TASK_DONE: "STAFF_TASK_DONE",
  /** Reopening a task that isn't done (409). */
  STAFF_TASK_NOT_DONE: "STAFF_TASK_NOT_DONE",
  /** The chosen task template doesn't exist, is inactive, isn't a task template, or isn't offered for the assignee's role (400). */
  STAFF_TASK_TEMPLATE_INVALID: "STAFF_TASK_TEMPLATE_INVALID",
  /** The stage isn't one of this task's stages (400). */
  STAFF_TASK_STAGE_INVALID: "STAFF_TASK_STAGE_INVALID",
  /** The task is already at that stage (409). */
  STAFF_TASK_STAGE_UNCHANGED: "STAFF_TASK_STAGE_UNCHANGED",
  /** "Mark complete" is only offered from the last stage (409). */
  STAFF_TASK_NOT_AT_LAST_STAGE: "STAFF_TASK_NOT_AT_LAST_STAGE",
  /** Blocking a task that is already blocked (409). */
  STAFF_TASK_ALREADY_BLOCKED: "STAFF_TASK_ALREADY_BLOCKED",
  /** Unblocking a task that isn't blocked (409). */
  STAFF_TASK_NOT_BLOCKED: "STAFF_TASK_NOT_BLOCKED",
  /** A task holds at most 50 links (409). */
  STAFF_TASK_LINKS_LIMIT: "STAFF_TASK_LINKS_LIMIT",
  /** No such link on this task (404); also a "brief" link where a delivered one is needed to share. */
  STAFF_TASK_LINK_NOT_FOUND: "STAFF_TASK_LINK_NOT_FOUND",
  /** The delivered link was already shared with the client (409). */
  STAFF_TASK_LINK_ALREADY_SHARED: "STAFF_TASK_LINK_ALREADY_SHARED",
  /** Sharing needs the task to be linked to an event (409). */
  STAFF_TASK_NO_EVENT: "STAFF_TASK_NO_EVENT",

  // -- My to-dos (round 1): private, per person ---------------------------------------
  /** No such to-do, or it is someone else's (the Admin included) -- the same 404 either way. */
  TODO_NOT_FOUND: "TODO_NOT_FOUND",
  /** Stale `version` on a to-do write (409). */
  TODO_MODIFIED: "TODO_MODIFIED",

  // -- Client to-dos (Phase 2) --------------------------------------------------------
  /** No such to-do, or it belongs to another manager's client -- the same 404 either way. */
  CLIENT_TODO_NOT_FOUND: "CLIENT_TODO_NOT_FOUND",
  /** Stale `version` on a to-do write (409). */
  CLIENT_TODO_MODIFIED: "CLIENT_TODO_MODIFIED",
  /** The linked event doesn't exist or belongs to a different client (400). */
  CLIENT_TODO_EVENT_INVALID: "CLIENT_TODO_EVENT_INVALID",
  /** `dueFrom` not before `dueTo` (400). */
  CLIENT_TODO_RANGE_INVALID: "CLIENT_TODO_RANGE_INVALID",

  // -- Reports (Phase 2) ------------------------------------------------------------
  /** `month` is outside the last 6 months (a future month or an older one) (400). */
  REPORT_MONTH_OUT_OF_RANGE: "REPORT_MONTH_OUT_OF_RANGE",

  // -- Activity log (Phase 2) -------------------------------------------------------
  /** `from` is after `to`, or the range is longer than 31 days (400). */
  ACTIVITY_RANGE_INVALID: "ACTIVITY_RANGE_INVALID",

  // -- Stage approvals (round 3) ---------------------------------------------------
  /** A forward move or completion would pass a stage that needs approval and has none yet (409). */
  STAGE_APPROVAL_REQUIRED: "STAGE_APPROVAL_REQUIRED",
  /** Requesting approval on a stage that has no approvers (409). */
  STAGE_APPROVAL_NOT_NEEDED: "STAGE_APPROVAL_NOT_NEEDED",
  /** The current stage is already approved (409). */
  STAGE_APPROVAL_ALREADY_APPROVED: "STAGE_APPROVAL_ALREADY_APPROVED",
  /** A request for this stage is already waiting (409). */
  STAGE_APPROVAL_PENDING: "STAGE_APPROVAL_PENDING",
  /** Deciding or cancelling a request that is not pending any more (409). */
  STAGE_APPROVAL_NOT_PENDING: "STAGE_APPROVAL_NOT_PENDING",
  /** Stale `version` on a decision or cancel (409). */
  STAGE_APPROVAL_MODIFIED: "STAGE_APPROVAL_MODIFIED",
  /** The caller is not one of the stage's approvers (403). */
  STAGE_APPROVAL_NOT_APPROVER: "STAGE_APPROVAL_NOT_APPROVER",
  /** You can't decide your own request (the Admin can) (403). */
  STAGE_APPROVAL_SELF: "STAGE_APPROVAL_SELF",
  /** Requesting changes needs a comment (400). */
  STAGE_APPROVAL_COMMENT_REQUIRED: "STAGE_APPROVAL_COMMENT_REQUIRED",
  /** No such approval, or one on an item the caller can't see -- the same 404 either way. */
  STAGE_APPROVAL_NOT_FOUND: "STAGE_APPROVAL_NOT_FOUND",
  /** Approvers on a stage template are unknown tokens, repeated, or include 'client' on a task template (400). */
  STAGE_TEMPLATE_APPROVERS_INVALID: "STAGE_TEMPLATE_APPROVERS_INVALID",
  /** Public: no such approval for this portal's client, it doesn't ask the client, or it is already decided -- always the same 404. */
  PORTAL_APPROVAL_NOT_FOUND: "PORTAL_APPROVAL_NOT_FOUND",

  // -- Parent and child work (round 4) ---------------------------------------------
  /** A forward move or completion would pass a stage that still has unfinished child events or tasks (409). */
  STAGE_CHILDREN_OPEN: "STAGE_CHILDREN_OPEN",
  /** A child of an item that is already a grandchild: at most 3 levels (409). */
  WORK_TOO_DEEP: "WORK_TOO_DEEP",
  /** The chosen stage isn't one of the parent's stages (400). */
  WORK_PARENT_STAGE_INVALID: "WORK_PARENT_STAGE_INVALID",
  /** A child event of a task that has no client (400). */
  WORK_CHILD_EVENT_NEEDS_CLIENT: "WORK_CHILD_EVENT_NEEDS_CLIENT",
  /** A child event names a client other than its parent's (400). */
  WORK_CHILD_CLIENT_MISMATCH: "WORK_CHILD_CLIENT_MISMATCH",

  // -- Notifications (M9) -----------------------------------------------------------
  /** No such notification, or someone else's (the same 404). */
  NOTIFICATION_NOT_FOUND: "NOTIFICATION_NOT_FOUND",
  /** No such push device, or someone else's (404). */
  PUSH_SUBSCRIPTION_NOT_FOUND: "PUSH_SUBSCRIPTION_NOT_FOUND",
  /** The server has no VAPID keys, so it can't send web push (503). */
  PUSH_NOT_CONFIGURED: "PUSH_NOT_CONFIGURED",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
