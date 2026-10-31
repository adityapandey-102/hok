import { describe, expect, it } from "vitest";
import { AppError } from "../../../common/errors/app-error";
import { assertFeedRange, mergeByStart, resolveCalendarScope } from "./calendar.rules";
import type { CalendarItem } from "./calendar.entity";

function codeOf(fn: () => unknown): string | null {
  try {
    fn();
    return null;
  } catch (err) {
    if (!(err instanceof AppError)) throw err;
    return err.code;
  }
}

describe("resolveCalendarScope", () => {
  it("a manager: own clients' events + own entries, ownerId ignored", () => {
    expect(resolveCalendarScope({ userId: "rohan", role: "social_media_manager" }, "sara")).toEqual({
      events: { ownerId: "rohan" },
      personal: { ownerId: "rohan" },
    });
  });

  it("the Admin: every event and their own entries; or one owner's events + entries", () => {
    expect(resolveCalendarScope({ userId: "admin", role: "admin" }, undefined)).toEqual({ events: { ownerId: undefined }, personal: { ownerId: "admin" } });
    expect(resolveCalendarScope({ userId: "admin", role: "admin" }, "sara")).toEqual({ events: { ownerId: "sara" }, personal: { ownerId: "sara" } });
  });

  it("task-only staff have no calendar (403)", () => {
    expect(codeOf(() => resolveCalendarScope({ userId: "meera", role: "editor" }, undefined))).toBe("FORBIDDEN");
  });
});

describe("assertFeedRange", () => {
  it("requires to > from and at most 92 days", () => {
    expect(codeOf(() => assertFeedRange("2026-10-01T00:00:00Z", "2026-11-01T00:00:00Z"))).toBeNull();
    expect(codeOf(() => assertFeedRange("2026-11-01T00:00:00Z", "2026-10-01T00:00:00Z"))).toBe("CALENDAR_RANGE_INVALID");
    expect(codeOf(() => assertFeedRange("2026-10-01T00:00:00Z", "2027-03-01T00:00:00Z"))).toBe("CALENDAR_RANGE_INVALID");
  });
});

describe("mergeByStart", () => {
  const item = (kind: "event" | "personal", id: string, startsAt: string): CalendarItem =>
    ({ kind, id, title: id, startsAt, endsAt: startsAt, timeZone: "UTC", clientId: null, clientName: null, ownerId: "o" }) as CalendarItem;

  it("interleaves the two kinds by start time", () => {
    const merged = mergeByStart(
      [item("event", "e1", "2026-10-01T10:00:00.000Z"), item("event", "e2", "2026-10-03T10:00:00.000Z")],
      [item("personal", "p1", "2026-10-02T10:00:00.000Z")],
    );
    expect(merged.map((m) => m.id)).toEqual(["e1", "p1", "e2"]);
  });
});
