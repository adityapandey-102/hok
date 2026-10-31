import { describe, expect, it } from "vitest";
import { TeamMembersService, type TeamMemberFilters, type TeamMembersRepositoryPort } from "./team-members.service";
import { teamMemberQueryDtoSchema } from "../api/dto/team-member-query.dto";

class FakeRepo implements TeamMembersRepositoryPort {
  last: { f: TeamMemberFilters; page: { limit: number; offset: number } } | null = null;
  findActive(f: TeamMemberFilters, page: { limit: number; offset: number }) {
    this.last = { f, page };
    return Promise.resolve([{ id: "u1", fullName: "Neha Joshi", role: "marketing_agent" as const }]);
  }
  countActive() {
    return Promise.resolve(1);
  }
}

describe("TeamMembersService", () => {
  it("passes search/role through and returns the page envelope", async () => {
    const repo = new FakeRepo();
    const result = await new TeamMembersService(repo).list(teamMemberQueryDtoSchema.parse({ search: " neha ", role: "marketing_agent" }));
    expect(repo.last).toEqual({ f: { search: "neha", role: "marketing_agent" }, page: { limit: 20, offset: 0 } });
    expect(result).toEqual({ members: [{ id: "u1", fullName: "Neha Joshi", role: "marketing_agent" }], total: 1, limit: 20, offset: 0 });
  });

  it("clamps the page and refuses an unknown role", () => {
    expect(teamMemberQueryDtoSchema.parse({ limit: "999" }).limit).toBe(100);
    expect(teamMemberQueryDtoSchema.safeParse({ role: "client" }).success).toBe(false);
  });
});
