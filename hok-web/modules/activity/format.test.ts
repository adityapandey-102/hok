import { describe, expect, it } from "vitest";
import type { ActivityItem } from "./api/activityApi";
import { dayHeading, groupByDay, initials, rangeChips, rangeInstants, relativeTime } from "./format";

const item = (id: string, at: string): ActivityItem => ({ id, at, kind: "tasks", actor: null, summary: id, url: null });

describe("rangeChips", () => {
  it("is Today, Yesterday, four weekday names, then Last 7 days", () => {
    // 2026-10-21 is a Wednesday.
    const chips = rangeChips("2026-10-21");
    expect(chips.map((c) => c.label)).toEqual(["Today", "Yesterday", "Monday", "Sunday", "Saturday", "Friday", "Thursday", "Last 7 days"]);
    expect(chips[0]!.key).toBe("2026-10-21");
    expect(chips[1]!.key).toBe("2026-10-20");
    expect(chips.at(-1)!.key).toBe("week");
  });
});

describe("rangeInstants", () => {
  it("is local midnight to local midnight in the viewer's zone", () => {
    expect(rangeInstants("2026-10-21", "2026-10-21", "Asia/Kolkata")).toEqual({ from: "2026-10-20T18:30:00.000Z", to: "2026-10-21T18:30:00.000Z" });
  });
  it("covers seven days for the week chip (within the API's 31-day cap)", () => {
    const { from, to } = rangeInstants("week", "2026-10-21", "UTC");
    expect(from).toBe("2026-10-15T00:00:00.000Z");
    expect(to).toBe("2026-10-22T00:00:00.000Z");
  });
  it("handles a 25-hour DST day", () => {
    const { from, to } = rangeInstants("2026-10-25", "2026-10-25", "Europe/London");
    expect((Date.parse(to) - Date.parse(from)) / 3600_000).toBe(25);
  });
});

describe("relativeTime", () => {
  const now = Date.parse("2026-10-21T12:00:00Z");
  it("reads in minutes, hours, days, then a date", () => {
    expect(relativeTime("2026-10-21T11:59:40Z", now)).toBe("just now");
    expect(relativeTime("2026-10-21T11:35:00Z", now)).toBe("25 min ago");
    expect(relativeTime("2026-10-21T11:00:00Z", now)).toBe("1 hour ago");
    expect(relativeTime("2026-10-21T07:00:00Z", now)).toBe("5 hours ago");
    expect(relativeTime("2026-10-19T12:00:00Z", now)).toBe("2 days ago");
    expect(relativeTime("2026-10-01T12:00:00Z", now, "UTC")).toBe("1 Oct");
  });
});

describe("dayHeading / groupByDay", () => {
  it("names today and yesterday, else the weekday and date", () => {
    expect(dayHeading("2026-10-21", "2026-10-21")).toBe("Today");
    expect(dayHeading("2026-10-20", "2026-10-21")).toBe("Yesterday");
    expect(dayHeading("2026-10-18", "2026-10-21")).toMatch(/^Sun,? 18 Oct$/);
  });
  it("groups newest-first items under their day in the viewer's zone", () => {
    const groups = groupByDay([item("a", "2026-10-21T20:00:00Z"), item("b", "2026-10-21T10:00:00Z"), item("c", "2026-10-20T10:00:00Z")], "Asia/Kolkata");
    // 20:00Z is 01:30 on the 22nd in Kolkata.
    expect(groups.map((g) => [g.day, g.items.map((i) => i.id)])).toEqual([
      ["2026-10-22", ["a"]],
      ["2026-10-21", ["b"]],
      ["2026-10-20", ["c"]],
    ]);
  });
});

describe("initials", () => {
  it("takes up to two capitals", () => {
    expect(initials("Meera Nair")).toBe("MN");
    expect(initials("rohan")).toBe("R");
  });
});
