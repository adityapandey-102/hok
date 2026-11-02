import { ROLES, canAssignTo, type Role } from "../../../domain";
import type { TeamMemberEntity } from "../domain/team-member.entity";
import type { TeamMemberQueryDto } from "../api/dto/team-member-query.dto";

export interface TeamMemberFilters {
  search?: string;
  /** Exactly this role. */
  role?: Role;
  /** Any of these roles (the assignable filter); never empty -- the service short-circuits that. */
  roles?: readonly Role[];
}

/** Read-only lookup of ACTIVE staff (inactive accounts never appear: they can't be put on anything new). */
export interface TeamMembersRepositoryPort {
  findActive(filters: TeamMemberFilters, page: { limit: number; offset: number }): Promise<TeamMemberEntity[]>;
  countActive(filters: TeamMemberFilters): Promise<number>;
}

/**
 * Staff picker for client managers (needleye's team-members idea): the Admin
 * and SMM / MM pick an event's team from it. The route gates it on
 * events:write (the Admin and the client managers). With `assignable`, it is
 * also the task assignee picker: only roles below the caller's on the ladder.
 */
export class TeamMembersService {
  constructor(private readonly repo: TeamMembersRepositoryPort) {}

  async list(query: TeamMemberQueryDto, callerRole: Role) {
    const page = { limit: query.limit, offset: query.offset };
    // Filtered by role in SQL (not in memory after paging), so a page is always full.
    const roles = query.assignable ? ROLES.filter((r) => canAssignTo(callerRole, r)) : undefined;
    if (roles && roles.length === 0) return { members: [], total: 0, limit: page.limit, offset: page.offset };
    const filters: TeamMemberFilters = { search: query.search, role: query.role, ...(roles ? { roles } : {}) };
    const [members, total] = await Promise.all([this.repo.findActive(filters, page), this.repo.countActive(filters)]);
    return { members, total, limit: page.limit, offset: page.offset };
  }
}
