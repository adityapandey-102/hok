import { describe, expect, it } from "vitest";
import { AppError } from "../../../common/errors/app-error";
import {
  assertClientLinkable,
  assertPersonalTimes,
  assertPersonalVersion,
  assertPersonalVisible,
  resolveCalendarRange,
} from "./personal-event.rules";

function codeOf(fn: () => unknown): string | null {
  try {
    fn();
    return null;
  } catch (err) {
    if (!(err instanceof AppError)) throw err;
    return err.code;
  }
}

describe("assertPersonalVisible", () => {
  it("owner and Admin see it; another manager gets 404", () => {
    expect(codeOf(() => assertPersonalVisible({ kind: "own", userId: "rohan" }, { ownerId: "rohan" }))).toBeNull();
    expect(codeOf(() => assertPersonalVisible({ kind: "all" }, { ownerId: "rohan" }))).toBeNull();
    expect(codeOf(() => assertPersonalVisible({ kind: "own", userId: "sara" }, { ownerId: "rohan" }))).toBe("PERSONAL_EVENT_NOT_FOUND");
    expect(codeOf(() => assertPersonalVisible({ kind: "all" }, null))).toBe("PERSONAL_EVENT_NOT_FOUND");
  });
});

describe("assertClientLinkable", () => {
  it("only the owner's own client can be linked (even for an Admin-owned entry)", () => {
    expect(codeOf(() => assertClientLinkable("rohan", { ownerId: "rohan" }))).toBeNull();
    expect(codeOf(() => assertClientLinkable("rohan", { ownerId: "sara" }))).toBe("CLIENT_NOT_FOUND");
    expect(codeOf(() => assertClientLinkable("admin", { ownerId: "sara" }))).toBe("CLIENT_NOT_FOUND");
    expect(codeOf(() => assertClientLinkable("rohan", null))).toBe("CLIENT_NOT_FOUND");
  });
});

describe("assertPersonalTimes / assertPersonalVersion", () => {
  it("validates the span and the version", () => {
    expect(codeOf(() => assertPersonalTimes("2026-10-14T10:00:00Z", "2026-10-14T11:00:00Z"))).toBeNull();
    expect(codeOf(() => assertPersonalTimes("2026-10-14T10:00:00Z", "2026-10-14T09:00:00Z"))).toBe("PERSONAL_EVENT_TIMES_INVALID");
    expect(codeOf(() => assertPersonalVersion(2, 1))).toBe("PERSONAL_EVENT_MODIFIED");
    expect(codeOf(() => assertPersonalVersion(2, undefined))).toBeNull();
  });
});

describe("resolveCalendarRange", () => {
  it("optional for lists, required for the feed, capped at 92 days", () => {
    expect(resolveCalendarRange(undefined, undefined)).toBeUndefined();
    expect(codeOf(() => resolveCalendarRange(undefined, undefined, true))).toBe("CALENDAR_RANGE_INVALID");
    expect(codeOf(() => resolveCalendarRange("2026-10-01T00:00:00Z", undefined))).toBe("CALENDAR_RANGE_INVALID");
    expect(codeOf(() => resolveCalendarRange("2026-10-01T00:00:00Z", "2027-02-01T00:00:00Z"))).toBe("CALENDAR_RANGE_INVALID");
    expect(resolveCalendarRange("2026-10-01T00:00:00Z", "2026-11-01T00:00:00Z", true)).toEqual({ from: "2026-10-01T00:00:00Z", to: "2026-11-01T00:00:00Z" });
  });
});
