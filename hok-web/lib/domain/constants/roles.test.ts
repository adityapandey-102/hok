import { describe, expect, it } from "vitest";
import { ROLES, canAssignTo, roleLevel, type Role } from "./roles";

const LEVEL: Record<Role, 1 | 2 | 3> = {
  admin: 1,
  social_media_manager: 2,
  marketing_manager: 2,
  project_manager: 2,
  marketing_agent: 3,
  developer: 3,
  editor: 3,
  content_writer: 3,
};

describe("role ladder", () => {
  it("puts the Admin on level 1, client managers on 2 and everyone else on 3", () => {
    for (const role of ROLES) expect(roleLevel(role), role).toBe(LEVEL[role]);
  });

  it("Admin -> managers and staff; managers -> each other and staff; staff -> nobody (8x8 table)", () => {
    for (const assigner of ROLES) {
      for (const assignee of ROLES) {
        const expected = (LEVEL[assigner] === 1 && LEVEL[assignee] > 1) || (LEVEL[assigner] === 2 && LEVEL[assignee] >= 2);
        expect(canAssignTo(assigner, assignee), `${assigner} -> ${assignee}`).toBe(expected);
      }
    }
  });

  it("never lets the Admin assign to another Admin or to themselves", () => {
    expect(canAssignTo("admin", "admin")).toBe(false);
  });

  it("lets the Admin assign to managers and staff, and a manager to other managers, themselves and staff", () => {
    expect(canAssignTo("admin", "project_manager")).toBe(true);
    expect(canAssignTo("admin", "editor")).toBe(true);
    expect(canAssignTo("social_media_manager", "editor")).toBe(true);
    expect(canAssignTo("social_media_manager", "marketing_manager")).toBe(true);
    expect(canAssignTo("marketing_manager", "project_manager")).toBe(true);
    expect(canAssignTo("project_manager", "project_manager")).toBe(true);
    expect(canAssignTo("social_media_manager", "admin")).toBe(false);
  });

  it("lets task-only staff assign nobody", () => {
    for (const assigner of ["marketing_agent", "developer", "editor", "content_writer"] as const) {
      for (const assignee of ROLES) expect(canAssignTo(assigner, assignee), `${assigner} -> ${assignee}`).toBe(false);
    }
  });
});
