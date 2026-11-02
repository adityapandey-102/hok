import { describe, expect, it } from "vitest";
import { ROLES, canAssignTo, roleLevel, type Role } from "./roles";

const LEVELS: Record<Role, 1 | 2 | 3> = {
  admin: 1,
  social_media_manager: 2,
  marketing_manager: 2,
  project_manager: 2,
  marketing_agent: 3,
  developer: 3,
  editor: 3,
  content_writer: 3,
};

describe("roleLevel", () => {
  it.each(ROLES)("%s has its ladder level", (role) => {
    expect(roleLevel(role)).toBe(LEVELS[role]);
  });
});

describe("canAssignTo (full 8x8 table)", () => {
  for (const assigner of ROLES) {
    for (const assignee of ROLES) {
      const expected = LEVELS[assigner] < LEVELS[assignee] && LEVELS[assigner] <= 2;
      it(`${assigner} -> ${assignee}: ${expected}`, () => {
        expect(canAssignTo(assigner, assignee)).toBe(expected);
      });
    }
  }

  it("never lets anyone assign to their own level, so an Admin cannot assign to an Admin", () => {
    expect(canAssignTo("admin", "admin")).toBe(false);
    expect(canAssignTo("social_media_manager", "project_manager")).toBe(false);
  });
});
