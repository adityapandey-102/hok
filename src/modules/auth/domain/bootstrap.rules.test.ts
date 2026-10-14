import { describe, expect, it } from "vitest";
import { assertNoAdminExists } from "./bootstrap.rules";
import { ForbiddenError } from "../../../common/errors/app-error";

describe("assertNoAdminExists", () => {
  it("allows bootstrap on a fresh install with zero admin accounts", () => {
    expect(() => assertNoAdminExists(0)).not.toThrow();
  });

  it("refuses bootstrap once an admin account already exists", () => {
    expect(() => assertNoAdminExists(1)).toThrow(ForbiddenError);
  });

  it("refuses with the stable AUTH_BOOTSTRAP_ALREADY_DONE code regardless of how many admins exist", () => {
    expect(() => assertNoAdminExists(5)).toThrow(expect.objectContaining({ code: "AUTH_BOOTSTRAP_ALREADY_DONE" }) as Error);
  });
});
