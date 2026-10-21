import { describe, expect, it } from "vitest";
import { currentMonthKey, formatDays, formatHours, initialsOf, lastSixMonths, monthLabel, parseReportView, percent, weekLabel, windowPhrase } from "./reportFormat";

describe("months", () => {
  it("lists the last 6 months, newest first, across a year boundary", () => {
    const months = lastSixMonths(new Date("2026-02-10T12:00:00Z"), "UTC").map((m) => m.value);
    expect(months).toEqual(["2026-02", "2026-01", "2025-12", "2025-11", "2025-10", "2025-09"]);
  });

  it("uses the viewer's zone for the current month", () => {
    const edge = new Date("2026-10-31T20:00:00Z"); // already 1 Nov in Kolkata
    expect(currentMonthKey(edge, "Asia/Kolkata")).toBe("2026-11");
    expect(currentMonthKey(edge, "UTC")).toBe("2026-10");
  });

  it("labels a month", () => {
    expect(monthLabel("2026-10")).toBe("October 2026");
  });
});

describe("weekLabel", () => {
  it("shows a day range, or one day", () => {
    expect(weekLabel("2026-10-05", "2026-10-11")).toBe("5–11 Oct");
    expect(weekLabel("2026-06-30", "2026-06-30")).toBe("30 Jun");
  });
});

describe("small figures", () => {
  it("initials", () => {
    expect(initialsOf("Meera Nair")).toBe("MN");
    expect(initialsOf("  cher ")).toBe("C");
    expect(initialsOf("")).toBe("?");
  });
  it("percent", () => {
    expect(percent(1, 3)).toBe(33);
    expect(percent(0, 0)).toBe(0);
  });
  it("days and hours", () => {
    expect(formatDays(null)).toBe("–");
    expect(formatDays(1)).toBe("1 day");
    expect(formatDays(4.5)).toBe("4.5 days");
    expect(formatHours(null)).toBe("–");
    expect(formatHours(0.5)).toBe("30 min");
    expect(formatHours(3)).toBe("3 h");
  });
  it("window phrase", () => {
    expect(windowPhrase(24)).toBe("last 24 hours");
    expect(windowPhrase(1)).toBe("last hour");
  });
  it("view parsing falls back to team", () => {
    expect(parseReportView("staff")).toBe("staff");
    expect(parseReportView("nope")).toBe("team");
    expect(parseReportView(null)).toBe("team");
  });
});
