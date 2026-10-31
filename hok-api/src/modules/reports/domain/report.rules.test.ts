import { describe, expect, it } from "vitest";
import { allowedMonths, monthWeeks, monthWindow, parseMonth, teamStatus } from "./report.rules";

const NOW = new Date("2026-10-21T10:00:00Z");

describe("allowedMonths", () => {
  it("is the current month and the 5 before it, newest first, across a year boundary", () => {
    expect(allowedMonths(NOW, "Asia/Kolkata")).toEqual(["2026-10", "2026-09", "2026-08", "2026-07", "2026-06", "2026-05"]);
    expect(allowedMonths(new Date("2026-02-10T00:00:00Z"), "UTC")).toEqual(["2026-02", "2026-01", "2025-12", "2025-11", "2025-10", "2025-09"]);
  });

  it("follows the viewer's zone at a month boundary", () => {
    const edge = new Date("2026-10-31T20:00:00Z"); // already 1 Nov in Kolkata (+05:30)
    expect(allowedMonths(edge, "Asia/Kolkata")[0]).toBe("2026-11");
    expect(allowedMonths(edge, "UTC")[0]).toBe("2026-10");
  });
});

describe("monthWindow", () => {
  it("is local midnight to local midnight in the viewer's zone", () => {
    const w = monthWindow("2026-10", NOW, "Asia/Kolkata");
    expect(w.from).toBe("2026-09-30T18:30:00.000Z");
    expect(w.to).toBe("2026-10-31T18:30:00.000Z");
  });

  it("handles December (rolls into the next year)", () => {
    const w = monthWindow("2025-12", new Date("2026-02-01T00:00:00Z"), "UTC");
    expect(w.from).toBe("2025-12-01T00:00:00.000Z");
    expect(w.to).toBe("2026-01-01T00:00:00.000Z");
  });

  it("rejects a future month, one older than 6 months, and a malformed one", () => {
    for (const bad of ["2026-11", "2026-04", "2027-01", "2026-13", "2026-1", "garbage"]) {
      expect(() => monthWindow(bad, NOW, "UTC"), bad).toThrow(expect.objectContaining({ statusCode: 400, code: "REPORT_MONTH_OUT_OF_RANGE" }) as Error);
    }
  });

  it("accepts the oldest allowed month", () => {
    expect(() => monthWindow("2026-05", NOW, "UTC")).not.toThrow();
  });
});

describe("parseMonth", () => {
  it("parses YYYY-MM only", () => {
    expect(parseMonth("2026-10")).toEqual({ year: 2026, month: 10 });
    expect(parseMonth("2026-00")).toBeNull();
    expect(parseMonth("26-10")).toBeNull();
  });
});

describe("monthWeeks", () => {
  it("splits a month into Monday-start weeks, first and last clipped", () => {
    const weeks = monthWeeks("2026-10", "UTC"); // 1 Oct 2026 is a Thursday
    expect(weeks.map((w) => [w.startDay, w.endDay])).toEqual([
      ["2026-10-01", "2026-10-04"],
      ["2026-10-05", "2026-10-11"],
      ["2026-10-12", "2026-10-18"],
      ["2026-10-19", "2026-10-25"],
      ["2026-10-26", "2026-10-31"],
    ]);
  });

  it("covers the month exactly: contiguous, from its first instant to its last", () => {
    const w = monthWindow("2026-10", NOW, "Asia/Kolkata");
    const weeks = monthWeeks("2026-10", "Asia/Kolkata");
    expect(weeks[0]!.from).toBe(w.from);
    expect(weeks.at(-1)!.to).toBe(w.to);
    weeks.slice(1).forEach((wk, i) => expect(wk.from).toBe(weeks[i]!.to));
  });

  it("a month starting on a Monday has whole weeks", () => {
    const weeks = monthWeeks("2026-06", "UTC"); // 1 Jun 2026 is a Monday
    expect(weeks[0]).toMatchObject({ startDay: "2026-06-01", endDay: "2026-06-07" });
    expect(weeks).toHaveLength(5);
    expect(weeks.at(-1)).toMatchObject({ startDay: "2026-06-29", endDay: "2026-06-30" });
  });
});

describe("teamStatus", () => {
  const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);
  it("working: open tasks and seen in the last 24 h", () => {
    expect(teamStatus({ openTasks: 2, lastSeenAt: hoursAgo(3), activityLast24h: 0, now: NOW })).toBe("working");
  });
  it("working: open tasks and acted in the last 24 h though not seen", () => {
    expect(teamStatus({ openTasks: 1, lastSeenAt: hoursAgo(80), activityLast24h: 2, now: NOW })).toBe("working");
    expect(teamStatus({ openTasks: 1, lastSeenAt: null, activityLast24h: 1, now: NOW })).toBe("working");
  });
  it("idle: no open tasks, however active", () => {
    expect(teamStatus({ openTasks: 0, lastSeenAt: hoursAgo(1), activityLast24h: 9, now: NOW })).toBe("idle");
  });
  it("idle: open tasks but neither seen nor acted in 24 h", () => {
    expect(teamStatus({ openTasks: 4, lastSeenAt: hoursAgo(30), activityLast24h: 0, now: NOW })).toBe("idle");
    expect(teamStatus({ openTasks: 4, lastSeenAt: null, activityLast24h: 0, now: NOW })).toBe("idle");
  });
  it("the window edge counts as seen", () => {
    expect(teamStatus({ openTasks: 1, lastSeenAt: hoursAgo(24), activityLast24h: 0, now: NOW })).toBe("working");
  });
});
