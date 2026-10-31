import { describe, expect, it } from "vitest";
import { AppError } from "../../../common/errors/app-error";
import { assertArchivable, assertEditable, assertUnarchivable, assertVersion } from "./client-status.rules";

function codeOf(fn: () => void): { status: number; code: string } | null {
  try {
    fn();
    return null;
  } catch (err) {
    if (!(err instanceof AppError)) throw err;
    return { status: err.statusCode, code: err.code };
  }
}

describe("assertVersion (optimistic lock)", () => {
  it("passes when the version matches or wasn't sent", () => {
    expect(codeOf(() => assertVersion(3, 3))).toBeNull();
    expect(codeOf(() => assertVersion(3, undefined))).toBeNull();
  });

  it("refuses a stale (or future) version with 409 CLIENT_MODIFIED", () => {
    expect(codeOf(() => assertVersion(3, 2))).toEqual({ status: 409, code: "CLIENT_MODIFIED" });
    expect(codeOf(() => assertVersion(3, 4))).toEqual({ status: 409, code: "CLIENT_MODIFIED" });
  });
});

describe("status transitions", () => {
  it("active and paused clients can be edited; an archived one can't (409 CLIENT_ARCHIVED)", () => {
    expect(codeOf(() => assertEditable("active"))).toBeNull();
    expect(codeOf(() => assertEditable("paused"))).toBeNull();
    expect(codeOf(() => assertEditable("archived"))).toEqual({ status: 409, code: "CLIENT_ARCHIVED" });
  });

  it("active or paused -> archived; archiving twice is 409 CLIENT_ARCHIVED", () => {
    expect(codeOf(() => assertArchivable("active"))).toBeNull();
    expect(codeOf(() => assertArchivable("paused"))).toBeNull();
    expect(codeOf(() => assertArchivable("archived"))).toEqual({ status: 409, code: "CLIENT_ARCHIVED" });
  });

  it("only an archived client can be unarchived (else 409 CLIENT_NOT_ARCHIVED)", () => {
    expect(codeOf(() => assertUnarchivable("archived"))).toBeNull();
    expect(codeOf(() => assertUnarchivable("active"))).toEqual({ status: 409, code: "CLIENT_NOT_ARCHIVED" });
    expect(codeOf(() => assertUnarchivable("paused"))).toEqual({ status: 409, code: "CLIENT_NOT_ARCHIVED" });
  });
});
