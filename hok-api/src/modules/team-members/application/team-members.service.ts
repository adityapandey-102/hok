import type { Role } from "../../../domain";
import type { TeamMemberEntity } from "../domain/team-member.entity";
import type { TeamMemberQueryDto } from "../api/dto/team-member-query.dto";

export interface TeamMemberFilters {
  search?: string;
  role?: Role;
}

/** Read-only lookup of ACTIVE staff (inactive accounts never appear: they can't be put on anything new). */
export interface TeamMembersRepositoryPort {
  findActive(filters: TeamMemberFilters, page: { limit: number; offset: number }): Promise<TeamMemberEntity[]>;
  countActive(filters: TeamMemberFilters): Promise<number>;
}

/**
 * Staff picker for client managers (needleye's team-members idea): the Admin
 * and SMM / MM pick an event's team from it. The route gates it on
 * events:write -- the only thing it serves today.
 */
export class TeamMembersService {
  constructor(private readonly repo: TeamMembersRepositoryPort) {}

  async list(query: TeamMemberQueryDto) {
    const filters = { search: query.search, role: query.role };
    const page = { limit: query.limit, offset: query.offset };
    const [members, total] = await Promise.all([this.repo.findActive(filters, page), this.repo.countActive(filters)]);
    return { members, total, limit: page.limit, offset: page.offset };
  }
}
