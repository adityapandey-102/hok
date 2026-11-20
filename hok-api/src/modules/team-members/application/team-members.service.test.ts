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
    const result = await new TeamMembersService(repo).list(teamMemberQueryDtoSchema.parse({ search: " neha ", role: "marketing_agent" }), "admin");
    expect(repo.last).toEqual({ f: { search: "neha", role: "marketing_agent" }, page: { limit: 20, offset: 0 } });
    expect(result).toEqual({ members: [{ id: "u1", fullName: "Neha Joshi", role: "marketing_agent" }], total: 1, limit: 20, offset: 0 });
  });

  it("assignable=true narrows to the roles the caller may assign (an Admin: managers and task-only; a manager: managers and task-only; task-only: nobody)", async () => {
    const repo = new FakeRepo();
    const service = new TeamMembersService(repo);
    const q = teamMemberQueryDtoSchema.parse({ assignable: "true" });
    await service.list(q, "admin");
    expect(repo.last?.f.roles).toEqual(["social_media_manager", "marketing_manager", "project_manager", "marketing_agent", "developer", "editor", "content_writer"]);
    await service.list(q, "project_manager");
    expect(repo.last?.f.roles).toEqual(["social_media_manager", "marketing_manager", "project_manager", "marketing_agent", "developer", "editor", "content_writer"]);
    repo.last = null;
    expect(await service.list(q, "editor")).toEqual({ members: [], total: 0, limit: 20, offset: 0 });
    expect(repo.last).toBeNull();
  });

  it("without assignable, no role list is applied", async () => {
    const repo = new FakeRepo();
    await new TeamMembersService(repo).list(teamMemberQueryDtoSchema.parse({}), "social_media_manager");
    expect(repo.last?.f.roles).toBeUndefined();
  });

  it("clamps the page and refuses an unknown role", () => {
    expect(teamMemberQueryDtoSchema.parse({ limit: "999" }).limit).toBe(100);
    expect(teamMemberQueryDtoSchema.safeParse({ role: "client" }).success).toBe(false);
  });
});
