export const ROLES = [
  "admin",
  "social_media_manager",
  "marketing_manager",
  "project_manager",
  "marketing_agent",
  "developer",
  "editor",
  "content_writer",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  social_media_manager: "Social Media Manager",
  marketing_manager: "Marketing Manager",
  project_manager: "Project Manager",
  marketing_agent: "Marketing Agent",
  developer: "Developer",
  editor: "Editor",
  content_writer: "Content Writer",
};

/**
 * Roles that own and manage clients (events, assets, calendars, portal,
 * comments). Everyone else is "task-only staff": they only receive staff tasks
 * from the Admin. See docs/REQUIREMENTS.md §3.
 */
export const CLIENT_MANAGER_ROLES = ["admin", "social_media_manager", "marketing_manager", "project_manager"] as const satisfies readonly Role[];

export function isClientManager(role: Role): boolean {
  return (CLIENT_MANAGER_ROLES as readonly Role[]).includes(role);
}

/** Task-assignment ladder (decision 2026-11-02): 1 = Admin (incl. the Owner), 2 = client managers, 3 = everyone else. */
export function roleLevel(role: Role): 1 | 2 | 3 {
  if (role === "admin") return 1;
  return isClientManager(role) ? 2 : 3;
}

/** Only downwards: level 1 -> 2 and 3, level 2 -> 3. Level 3 assigns nobody. */
export function canAssignTo(assigner: Role, assignee: Role): boolean {
  return roleLevel(assigner) <= 2 && roleLevel(assigner) < roleLevel(assignee);
}
