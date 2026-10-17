import { ROLE_LABELS, type Role } from "../../../lib/domain";
import { apiFetch } from "../../../lib/api/client";
import { SEARCH_SELECT_LIMIT, type SelectOption } from "../../../lib/api/options";

/** An active staff member as GET /team-members returns them (anyone who can create events may list them). */
export interface TeamMember {
  id: string;
  fullName: string;
  role: Role;
}

/**
 * Pickers for people: event teams, task assignees, client owners. The API
 * returns ACTIVE staff only and searches by name, so nothing is filtered here.
 */
export const teamMembersApi = {
  async searchOptions(search: string, role?: Role): Promise<SelectOption<TeamMember>[]> {
    const q = new URLSearchParams({ limit: String(SEARCH_SELECT_LIMIT), offset: "0" });
    if (search) q.set("search", search);
    if (role) q.set("role", role);
    const page = (await apiFetch(`/team-members?${q.toString()}`)) as { members: TeamMember[] };
    return page.members.map((m) => ({ id: m.id, label: m.fullName, hint: ROLE_LABELS[m.role], data: m }));
  },
};
