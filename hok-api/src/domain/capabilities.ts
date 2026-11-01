import type { Role } from "./roles";

export const CAPABILITIES = [
  // Staff accounts and roles (Admin only).
  "users:manage",
  // Stage templates: Admin creates and edits them; managers only pick one
  // when creating an event (that read is part of events:write).
  "stage_templates:manage",
  // Clients. "own" = clients whose team (client_members) includes the caller.
  "clients:read",
  "clients:write",
  "clients:reassign",
  // Client events and their stages.
  "events:read",
  "events:write",
  // A manager's personal calendar entries (not tied to a client).
  "personal_events:manage",
  // Asset link library.
  "assets:read",
  "assets:write",
  // Generate / regenerate / disable a client's portal link.
  "portal:manage",
  // Client comments inbox: read, change status, reply.
  "comments:read",
  "comments:manage",
  // Staff tasks: only Admin assigns; everyone works on their own.
  // "own" = tasks whose assignee_id is the caller.
  "staff_tasks:assign",
  "staff_tasks:read",
  "staff_tasks:update",
  // Firm-wide dashboard figures and the global calendar.
  "dashboard:global",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

/**
 * `true`  -> allowed on any record.
 * `"own"` -> allowed only on the caller's own records: clients whose team they're on (and
 *            everything under those clients), personal events they own, or
 *            staff tasks assigned to them.
 * `false` -> never allowed.
 *
 * Kept as a flat lookup table on purpose (not a generic policy engine), the
 * same as needleye: six roles, a fixed list of capabilities, all known up front.
 */
type CapabilityScope = boolean | "own";

const ADMIN_ONLY: Record<Role, CapabilityScope> = {
  admin: true,
  social_media_manager: false,
  marketing_manager: false,
  project_manager: false,
  marketing_agent: false,
  developer: false,
  editor: false,
  content_writer: false,
};

/** Admin sees everything; Social Media / Marketing / Project Managers only clients they're assigned to; task-only staff nothing. */
const CLIENT_MANAGERS_OWN: Record<Role, CapabilityScope> = {
  admin: true,
  social_media_manager: "own",
  marketing_manager: "own",
  project_manager: "own",
  marketing_agent: false,
  developer: false,
  editor: false,
  content_writer: false,
};

/** Admin sees every task; every other role sees and works on the tasks assigned to them. */
const EVERYONE_OWN_TASKS: Record<Role, CapabilityScope> = {
  admin: true,
  social_media_manager: "own",
  marketing_manager: "own",
  project_manager: "own",
  marketing_agent: "own",
  developer: "own",
  editor: "own",
  content_writer: "own",
};

export const CAPABILITY_MATRIX: Record<Capability, Record<Role, CapabilityScope>> = {
  "users:manage": ADMIN_ONLY,
  "stage_templates:manage": ADMIN_ONLY,
  "clients:read": CLIENT_MANAGERS_OWN,
  "clients:write": CLIENT_MANAGERS_OWN,
  "clients:reassign": ADMIN_ONLY,
  "events:read": CLIENT_MANAGERS_OWN,
  "events:write": CLIENT_MANAGERS_OWN,
  "personal_events:manage": CLIENT_MANAGERS_OWN,
  "assets:read": CLIENT_MANAGERS_OWN,
  "assets:write": CLIENT_MANAGERS_OWN,
  "portal:manage": CLIENT_MANAGERS_OWN,
  "comments:read": CLIENT_MANAGERS_OWN,
  "comments:manage": CLIENT_MANAGERS_OWN,
  "staff_tasks:assign": ADMIN_ONLY,
  "staff_tasks:read": EVERYONE_OWN_TASKS,
  "staff_tasks:update": EVERYONE_OWN_TASKS,
  "dashboard:global": ADMIN_ONLY,
};

export function getCapabilityScope(role: Role, capability: Capability): CapabilityScope {
  return CAPABILITY_MATRIX[capability][role];
}

/** True if the role has this capability at all (globally or scoped to own records). */
export function hasCapability(role: Role, capability: Capability): boolean {
  return getCapabilityScope(role, capability) !== false;
}

/** True if the role's access to this capability is limited to its own records. */
export function isScopedToOwnRecords(role: Role, capability: Capability): boolean {
  return getCapabilityScope(role, capability) === "own";
}
