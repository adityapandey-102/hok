export const ROLES = [
  "admin",
  "social_media_manager",
  "marketing_manager",
  "project_manager",
  "marketing_agent",
  "developer",
  "editor",
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
