import { describe, expect, it } from "vitest";
import {
  addDays,
  dayKeyInZone,
  dayRange,
  itemsOnDay,
  monthGrid,
  shiftMonth,
  startOfWeek,
  todayKey,
  visibleRange,
  weekDays,
} from "./calendar";

describe("day arithmetic", () => {
  it("adds days across month and year ends and leap days", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("starts weeks on Monday", () => {
    expect(startOfWeek("2026-10-14")).toBe("2026-10-12"); // a Wednesday
    expect(startOfWeek("2026-10-18")).toBe("2026-10-12"); // the Sunday
    expect(weekDays("2026-10-14")).toHaveLength(7);
    expect(weekDays("2026-10-14")[6]).toBe("2026-10-18");
  });

  it("shifts months", () => {
    expect(shiftMonth("2026-10-14", 1)).toBe("2026-11-01");
    expect(shiftMonth("2026-01-20", -1)).toBe("2025-12-01");
  });
});

describe("monthGrid", () => {
  it("covers the month in whole Monday-first weeks", () => {
    const grid = monthGrid("2026-10-14");
    expect(grid.every((w) => w.length === 7)).toBe(true);
    expect(grid[0][0]).toBe("2026-09-28");
    expect(grid[grid.length - 1][6]).toBe("2026-11-01");
    expect(grid).toHaveLength(5);
  });

  it("uses 4 rows for a 28-day February that starts on Monday", () => {
    expect(monthGrid("2027-02-10")).toHaveLength(4);
  });

  it("uses 6 rows when needed", () => {
    expect(monthGrid("2026-08-10")).toHaveLength(6);
  });

  it("stays within the 92-day API window", () => {
    for (let m = 0; m < 12; m++) {
      const { first, last } = visibleRange("month", `2026-${String(m + 1).padStart(2, "0")}-01`);
      const days = (Date.parse(last) - Date.parse(first)) / 86_400_000 + 1;
      expect(days).toBeLessThanOrEqual(42);
    }
  });
});

describe("zones and DST", () => {
  it("assigns an instant to the day it falls on in each zone", () => {
    const iso = "2026-10-20T20:00:00Z";
    expect(dayKeyInZone(iso, "Asia/Kolkata")).toBe("2026-10-21");
    expect(dayKeyInZone(iso, "America/New_York")).toBe("2026-10-20");
    expect(todayKey("Asia/Dubai", Date.parse("2026-10-20T21:00:00Z"))).toBe("2026-10-21");
  });

  it("gives a 23 hour day when clocks go forward", () => {
    const { from, to } = dayRange("2026-03-08", "2026-03-08", "America/New_York");
    expect(from).toBe("2026-03-08T00:00:00-05:00");
    expect(to).toBe("2026-03-09T00:00:00-04:00");
    expect((Date.parse(to) - Date.parse(from)) / 3_600_000).toBe(23);
  });

  it("gives a 25 hour day when clocks go back", () => {
    const { from, to } = dayRange("2026-10-25", "2026-10-25", "Europe/London");
    expect((Date.parse(to) - Date.parse(from)) / 3_600_000).toBe(25);
  });
});

describe("itemsOnDay", () => {
  const items = [
    { id: "a", startsAt: "2026-10-20T04:30:00Z", endsAt: "2026-10-20T06:30:00Z" },
    { id: "b", startsAt: "2026-10-20T20:00:00Z", endsAt: "2026-10-22T02:00:00Z" },
  ];
  it("puts an item on the day it starts in the viewer zone", () => {
    expect(itemsOnDay(items, "2026-10-20", "Asia/Kolkata").map((i) => i.id)).toEqual(["a"]);
  });
  it("repeats a multi-day item on each day it covers", () => {
    expect(itemsOnDay(items, "2026-10-21", "Asia/Kolkata").map((i) => i.id)).toEqual(["b"]);
    expect(itemsOnDay(items, "2026-10-22", "Asia/Kolkata").map((i) => i.id)).toEqual(["b"]);
    expect(itemsOnDay(items, "2026-10-23", "Asia/Kolkata")).toEqual([]);
  });
  it("does not spill onto the next day when it ends exactly at midnight", () => {
    const one = [{ id: "c", startsAt: "2026-10-20T10:00:00Z", endsAt: "2026-10-20T18:30:00Z" }]; // ends 00:00 IST on the 21st
    expect(itemsOnDay(one, "2026-10-21", "Asia/Kolkata")).toEqual([]);
  });
});
