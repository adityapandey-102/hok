import { describe, expect, it } from "vitest";
import { AppError } from "../../../common/errors/app-error";
import { hasCapability, ROLES } from "../../../domain";
import { assertTemplateVersion, normalizeStageNames, normalizeStages, normalizeTemplateRoles } from "./stage-template.rules";

function codeOf(fn: () => unknown): string | null {
  try {
    fn();
    return null;
  } catch (err) {
    if (!(err instanceof AppError)) throw err;
    return err.code;
  }
}

describe("normalizeStageNames", () => {
  it("trims names and keeps the order", () => {
    expect(normalizeStageNames([" Planned ", "Shoot", "Editing"])).toEqual(["Planned", "Shoot", "Editing"]);
  });

  it("refuses a repeated stage, ignoring case (400 STAGE_TEMPLATE_STAGES_INVALID)", () => {
    expect(codeOf(() => normalizeStageNames(["Shoot", "Editing", "shoot"]))).toBe("STAGE_TEMPLATE_STAGES_INVALID");
  });

  it("refuses a blank stage", () => {
    expect(codeOf(() => normalizeStageNames(["Planned", "  "]))).toBe("STAGE_TEMPLATE_STAGES_INVALID");
  });
});

describe("assertTemplateVersion", () => {
  it("passes on a match or when no version is sent; 409 STAGE_TEMPLATE_MODIFIED when stale", () => {
    expect(codeOf(() => assertTemplateVersion(2, 2))).toBeNull();
    expect(codeOf(() => assertTemplateVersion(2, undefined))).toBeNull();
    expect(codeOf(() => assertTemplateVersion(2, 1))).toBe("STAGE_TEMPLATE_MODIFIED");
  });
});

describe("normalizeTemplateRoles", () => {
  it("keeps a task template's roles, dropping repeats; empty means any role", () => {
    expect(normalizeTemplateRoles("task", ["editor", "developer", "editor"])).toEqual(["editor", "developer"]);
    expect(normalizeTemplateRoles("task", [])).toEqual([]);
    expect(normalizeTemplateRoles("event", [])).toEqual([]);
  });

  it("refuses roles on an event template and Admin on a task template (400 STAGE_TEMPLATE_ROLES_INVALID)", () => {
    expect(codeOf(() => normalizeTemplateRoles("event", ["editor"]))).toBe("STAGE_TEMPLATE_ROLES_INVALID");
    expect(codeOf(() => normalizeTemplateRoles("task", ["admin"]))).toBe("STAGE_TEMPLATE_ROLES_INVALID");
  });
});

describe("who reads templates", () => {
  it("every role that assigns tasks also passes the router's events:read gate, so managers can load task templates", () => {
    for (const role of ROLES) {
      if (hasCapability(role, "staff_tasks:assign")) expect(hasCapability(role, "events:read"), role).toBe(true);
    }
  });
});

describe("normalizeStages (round 3)", () => {
  it("keeps names in order with their approvers; a string has none", () => {
    expect(normalizeStages("task", ["A", { name: " B ", approvers: ["admin", "editor"] }, { name: "C" }])).toEqual([
      { name: "A", approvers: [] },
      { name: "B", approvers: ["admin", "editor"] },
      { name: "C", approvers: [] },
    ]);
  });

  it("still refuses blank and repeated names", () => {
    expect(codeOf(() => normalizeStages("event", ["A", { name: "a" }]))).toBe("STAGE_TEMPLATE_STAGES_INVALID");
  });

  it("judges the client approver by the kind", () => {
    expect(codeOf(() => normalizeStages("event", [{ name: "A", approvers: ["client"] }]))).toBeNull();
    expect(codeOf(() => normalizeStages("task", [{ name: "A", approvers: ["client"] }]))).toBe("STAGE_TEMPLATE_APPROVERS_INVALID");
  });
});
