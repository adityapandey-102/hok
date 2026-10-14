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
  INTERNAL: "INTERNAL",

  // -- Auth / session ---------------------------------------------------------
  AUTH_TOKEN_MISSING: "AUTH_TOKEN_MISSING",
  AUTH_SESSION_INVALID: "AUTH_SESSION_INVALID",
  AUTH_INVALID_CREDENTIALS: "AUTH_INVALID_CREDENTIALS",
  AUTH_LINK_INVALID: "AUTH_LINK_INVALID",
  AUTH_PROFILE_MISSING: "AUTH_PROFILE_MISSING",
  AUTH_ACCOUNT_DEACTIVATED: "AUTH_ACCOUNT_DEACTIVATED",
  AUTH_BOOTSTRAP_ALREADY_DONE: "AUTH_BOOTSTRAP_ALREADY_DONE",

  // -- Users ------------------------------------------------------------------
  USER_NOT_FOUND: "USER_NOT_FOUND",
  USER_CANNOT_DEACTIVATE_SELF: "USER_CANNOT_DEACTIVATE_SELF",
  /** Admin regenerating their own password, or another admin's after that admin has signed in (403). */
  USER_PASSWORD_SELF_MANAGED: "USER_PASSWORD_SELF_MANAGED",
  /** Admin changing their own role -- would let the last admin lock everyone out (400). */
  USER_CANNOT_CHANGE_OWN_ROLE: "USER_CANNOT_CHANGE_OWN_ROLE",
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
  /** The chosen owner isn't an active admin / social_media_manager / marketing_manager (400). */
  CLIENT_OWNER_INVALID: "CLIENT_OWNER_INVALID",
  /** A manager tried to create a client owned by someone else -- only the Admin may (403). */
  CLIENT_OWNER_FORBIDDEN: "CLIENT_OWNER_FORBIDDEN",
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
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
