import { describe, expect, it } from "vitest";
import { AppError } from "../../../common/errors/app-error";
import { CLIENT_MANAGER_ROLES, ROLES, isClientManager, type Role } from "../../../domain";
import {
  assertAdmin,
  assertValidOwner,
  assertValidTeam,
  assertVisible,
  normalizeTeam,
  resolveNewOwner,
  teamDiff,
  type ClientScope,
} from "./client-ownership.rules";

function codeOf(fn: () => unknown): { status: number; code: string } | null {
  try {
    fn();
    return null;
  } catch (err) {
    if (!(err instanceof AppError)) throw err;
    return { status: err.statusCode, code: err.code };
  }
}

const ALL: ClientScope = { kind: "all" };
const ROHAN: ClientScope = { kind: "own", userId: "rohan" };

describe("assertVisible (row scope)", () => {
  const rohans = { id: "c1", team: [{ id: "rohan" }] };
  const saras = { id: "c2", team: [{ id: "sara" }] };

  it("the Admin sees every client", () => {
    expect(assertVisible(ALL, rohans)).toBe(rohans);
    expect(assertVisible(ALL, saras)).toBe(saras);
  });

  it("a manager sees their own client", () => {
    expect(assertVisible(ROHAN, rohans)).toBe(rohans);
  });

  it("another manager's client is a 404 CLIENT_NOT_FOUND -- the same answer as a missing one", () => {
    expect(codeOf(() => assertVisible(ROHAN, saras))).toEqual({ status: 404, code: "CLIENT_NOT_FOUND" });
    expect(codeOf(() => assertVisible(ROHAN, null))).toEqual({ status: 404, code: "CLIENT_NOT_FOUND" });
    expect(codeOf(() => assertVisible(ALL, null))).toEqual({ status: 404, code: "CLIENT_NOT_FOUND" });
  });
});

describe("resolveNewOwner (create)", () => {
  it("defaults to the creator", () => {
    expect(resolveNewOwner(ROHAN, "rohan", undefined)).toBe("rohan");
    expect(resolveNewOwner(ALL, "admin", undefined)).toBe("admin");
  });

  it("a manager naming themselves is fine", () => {
    expect(resolveNewOwner(ROHAN, "rohan", "rohan")).toBe("rohan");
  });

  it("the Admin may create a client for someone else", () => {
    expect(resolveNewOwner(ALL, "admin", "sara")).toBe("sara");
  });

  it("a manager naming another owner is 403 CLIENT_OWNER_FORBIDDEN", () => {
    expect(codeOf(() => resolveNewOwner(ROHAN, "rohan", "sara"))).toEqual({ status: 403, code: "CLIENT_OWNER_FORBIDDEN" });
  });
});

describe("assertValidOwner (create-for-someone, reassign)", () => {
  const candidate = (role: Role, active = true) => ({ id: "u1", role, active });

  it.each(CLIENT_MANAGER_ROLES)("accepts an active %s", (role) => {
    expect(codeOf(() => assertValidOwner(candidate(role)))).toBeNull();
  });

  it.each(ROLES.filter((r) => !isClientManager(r)))(
    "refuses task-only staff: %s (400 CLIENT_OWNER_INVALID)",
    (role) => {
      expect(codeOf(() => assertValidOwner(candidate(role)))).toEqual({ status: 400, code: "CLIENT_OWNER_INVALID" });
    },
  );

  it("refuses a deactivated manager and an unknown user", () => {
    expect(codeOf(() => assertValidOwner(candidate("social_media_manager", false)))).toEqual({ status: 400, code: "CLIENT_OWNER_INVALID" });
    expect(codeOf(() => assertValidOwner(null))).toEqual({ status: 400, code: "CLIENT_OWNER_INVALID" });
  });
});

describe("client teams", () => {
  it("a manager on the team sees the client even when not its lead", () => {
    expect(assertVisible({ kind: "own", userId: "kiran" }, { id: "c1", team: [{ id: "rohan" }, { id: "kiran" }] }).id).toBe("c1");
  });

  it("archive / unarchive / team changes are the Admin's: a team member gets 403 CLIENT_ADMIN_ONLY", () => {
    expect(codeOf(() => assertAdmin(ALL, "archive a client"))).toBeNull();
    expect(codeOf(() => assertAdmin({ kind: "own", userId: "rohan" }, "archive a client"))).toEqual({ status: 403, code: "CLIENT_ADMIN_ONLY" });
  });

  it("normalises a team: lead always on it, duplicates dropped, capped at 20", () => {
    expect(normalizeTeam("rohan", ["kiran", "rohan", "kiran"])).toEqual(["rohan", "kiran"]);
    expect(normalizeTeam("rohan", [])).toEqual(["rohan"]);
    expect(codeOf(() => normalizeTeam("x", Array.from({ length: 20 }, (_, i) => `m${i}`)))).toEqual({ status: 400, code: "CLIENT_OWNER_INVALID" });
  });

  it("every member must be an active client manager (project managers included)", () => {
    const ok = [
      { id: "a", role: "project_manager" as Role, active: true },
      { id: "b", role: "marketing_manager" as Role, active: true },
    ];
    expect(codeOf(() => assertValidTeam(["a", "b"], ok))).toBeNull();
    expect(codeOf(() => assertValidTeam(["a", "c"], ok))).toEqual({ status: 400, code: "CLIENT_OWNER_INVALID" });
    expect(codeOf(() => assertValidTeam(["e"], [{ id: "e", role: "editor", active: true }]))).toEqual({ status: 400, code: "CLIENT_OWNER_INVALID" });
  });

  it("works out who was added and removed", () => {
    expect(teamDiff(["rohan", "sara"], ["rohan", "kiran"])).toEqual({ added: ["kiran"], removed: ["sara"] });
  });
});
