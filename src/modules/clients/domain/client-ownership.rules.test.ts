import { describe, expect, it } from "vitest";
import { AppError } from "../../../common/errors/app-error";
import { ROLES, type Role } from "../../../domain";
import { assertValidOwner, assertVisible, resolveNewOwner, type ClientScope } from "./client-ownership.rules";

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
  const rohans = { id: "c1", ownerId: "rohan" };
  const saras = { id: "c2", ownerId: "sara" };

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

  it.each(["admin", "social_media_manager", "marketing_manager"] as const)("accepts an active %s", (role) => {
    expect(codeOf(() => assertValidOwner(candidate(role)))).toBeNull();
  });

  it.each(ROLES.filter((r) => !["admin", "social_media_manager", "marketing_manager"].includes(r)))(
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
