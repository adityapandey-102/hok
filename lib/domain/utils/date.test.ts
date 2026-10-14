import { describe, expect, it } from "vitest";
import { diffDays, parseDateOnly, pluralize, startOfDay, timeAgoLabel, toDateInputValue } from "./date";

describe("parseDateOnly", () => {
  it("parses a YYYY-MM-DD string at local midnight", () => {
    const parsed = parseDateOnly("2026-03-05");
    expect(parsed).not.toBeNull();
    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(2); // 0-indexed
    expect(parsed?.getDate()).toBe(5);
  });

  it("returns null for null/undefined/empty input", () => {
    expect(parseDateOnly(null)).toBeNull();
    expect(parseDateOnly(undefined)).toBeNull();
    expect(parseDateOnly("")).toBeNull();
  });

  it("returns null for an unparseable string", () => {
    expect(parseDateOnly("not-a-date")).toBeNull();
  });
});

describe("diffDays", () => {
  it("counts whole days between two dates, ignoring time-of-day", () => {
    expect(diffDays(new Date("2026-03-10T23:00:00"), new Date("2026-03-05T01:00:00"))).toBe(5);
  });

  it("is negative when the later date is actually earlier", () => {
    expect(diffDays(new Date("2026-03-01"), new Date("2026-03-05"))).toBe(-4);
  });
});

describe("toDateInputValue", () => {
  it("formats a Date as YYYY-MM-DD", () => {
    expect(toDateInputValue(new Date(2026, 2, 5))).toBe("2026-03-05");
  });

  it("zero-pads single-digit months and days", () => {
    expect(toDateInputValue(new Date(2026, 0, 1))).toBe("2026-01-01");
  });
});

describe("pluralize", () => {
  it("stays singular for 1 or -1", () => {
    expect(pluralize("Day", 1)).toBe("Day");
    expect(pluralize("Day", -1)).toBe("Day");
  });

  it("pluralizes everything else, including 0", () => {
    expect(pluralize("Day", 0)).toBe("Days");
    expect(pluralize("Day", 5)).toBe("Days");
  });
});

describe("startOfDay", () => {
  it("strips the time-of-day component", () => {
    const result = startOfDay(new Date("2026-03-05T15:30:00"));
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
  });
});

describe("timeAgoLabel", () => {
  const now = new Date(2026, 8, 24, 12, 0, 0); // 24 Sep 2026, 12:00 local

  it("minutes and hours within the same day", () => {
    expect(timeAgoLabel(new Date(2026, 8, 24, 11, 59, 40).toISOString(), now)).toBe("just now");
    expect(timeAgoLabel(new Date(2026, 8, 24, 11, 15).toISOString(), now)).toBe("45 min ago");
    expect(timeAgoLabel(new Date(2026, 8, 24, 8, 0).toISOString(), now)).toBe("4 h ago");
  });

  it("calendar days after that", () => {
    expect(timeAgoLabel(new Date(2026, 8, 23, 23, 50).toISOString(), now)).toBe("yesterday");
    expect(timeAgoLabel(new Date(2026, 8, 21, 9, 0).toISOString(), now)).toBe("3 days ago");
  });

  it("missing or bad input reads Never", () => {
    expect(timeAgoLabel(null, now)).toBe("Never");
    expect(timeAgoLabel("nonsense", now)).toBe("Never");
  });
});
