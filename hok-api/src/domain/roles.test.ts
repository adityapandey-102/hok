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
      // Admin -> managers + staff; managers -> managers (incl. themselves) + staff; staff -> nobody.
      const expected = (LEVELS[assigner] === 1 && LEVELS[assignee] > 1) || (LEVELS[assigner] === 2 && LEVELS[assignee] >= 2);
      it(`${assigner} -> ${assignee}: ${expected}`, () => {
        expect(canAssignTo(assigner, assignee)).toBe(expected);
      });
    }
  }

  it("an Admin can't assign to an Admin; managers can assign sideways and to themselves (2026-11-20)", () => {
    expect(canAssignTo("admin", "admin")).toBe(false);
    expect(canAssignTo("social_media_manager", "project_manager")).toBe(true);
    expect(canAssignTo("project_manager", "project_manager")).toBe(true);
    expect(canAssignTo("marketing_manager", "admin")).toBe(false);
  });
});
