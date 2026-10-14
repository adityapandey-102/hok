import { describe, expect, it } from "vitest";
import { assertNotChangingOwnRole, assertNotDeactivatingSelf, assertPasswordCanBeRegenerated } from "./account-admin.rules";
import { BadRequestError, ForbiddenError } from "../../../common/errors/app-error";
import { ROLES } from "../../../domain";

const code = (c: string) => expect.objectContaining({ code: c }) as Error;

describe("assertNotDeactivatingSelf", () => {
  it("refuses deactivating your own account", () => {
    expect(() => assertNotDeactivatingSelf("me", "me")).toThrow(BadRequestError);
    expect(() => assertNotDeactivatingSelf("me", "me")).toThrow(code("USER_CANNOT_DEACTIVATE_SELF"));
  });

  it("allows deactivating someone else", () => {
    expect(() => assertNotDeactivatingSelf("them", "me")).not.toThrow();
  });
});

describe("assertNotChangingOwnRole", () => {
  it("refuses an Admin demoting themselves", () => {
    expect(() => assertNotChangingOwnRole("me", "me", "admin", "editor")).toThrow(code("USER_CANNOT_CHANGE_OWN_ROLE"));
  });

  it("allows resending your own unchanged role (a form that posts every field)", () => {
    expect(() => assertNotChangingOwnRole("me", "me", "admin", "admin")).not.toThrow();
  });

  it("allows changing anyone else's role, to any role", () => {
    for (const role of ROLES) {
      expect(() => assertNotChangingOwnRole("them", "me", "admin", role)).not.toThrow();
    }
  });
});

describe("assertPasswordCanBeRegenerated", () => {
  it("refuses regenerating your own password", () => {
    expect(() => assertPasswordCanBeRegenerated({ id: "me", role: "admin", lastLoginAt: null }, "me")).toThrow(ForbiddenError);
  });

  it("refuses another Admin's password once they have signed in", () => {
    expect(() => assertPasswordCanBeRegenerated({ id: "a2", role: "admin", lastLoginAt: "2026-10-13T09:00:00.000Z" }, "me")).toThrow(
      code("USER_PASSWORD_SELF_MANAGED"),
    );
  });

  it("allows another Admin's password before their first sign-in", () => {
    expect(() => assertPasswordCanBeRegenerated({ id: "a2", role: "admin", lastLoginAt: null }, "me")).not.toThrow();
  });

  it("always allows it for every non-admin role, signed in or not", () => {
    for (const role of ROLES.filter((r) => r !== "admin")) {
      expect(() => assertPasswordCanBeRegenerated({ id: "x", role, lastLoginAt: "2026-10-13T09:00:00.000Z" }, "me")).not.toThrow();
      expect(() => assertPasswordCanBeRegenerated({ id: "x", role, lastLoginAt: null }, "me")).not.toThrow();
    }
  });
});
