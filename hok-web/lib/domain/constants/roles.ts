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

/**
 * Who may assign a task to whom. Level 1 (Admin) -> levels 2 and 3. Level 2 (the client managers: SMM, MM, PM)
 * -> level 2 and 3, i.e. sideways to each other and to themselves too (decision 2026-11-20: the Admin is busy,
 * so managers create and hand out work among themselves). Level 3 assigns nobody. Nobody assigns to the Admin.
 */
export function canAssignTo(assigner: Role, assignee: Role): boolean {
  const from = roleLevel(assigner);
  const to = roleLevel(assignee);
  if (from === 1) return to > 1;
  if (from === 2) return to >= 2;
  return false;
}
