import { describe, expect, it } from "vitest";
import type { DashboardEvent } from "./api/dashboardApi";
import { barPercents, dayDiff, dueText, stagePercent, stageProgress, totalTasks, weekStrip } from "./format";

const NOW = Date.parse("2026-10-16T09:00:00Z");
const ev = (startsAt: string, endsAt: string): DashboardEvent => ({
  id: "e", title: "Shoot", type: "shoot", state: "active", startsAt, endsAt, timeZone: "UTC",
  clientId: "c", clientName: "C", currentStageName: "Editing", currentStagePosition: 2, stageCount: 4,
});

describe("dashboard format", () => {
  it("dayDiff counts calendar days", () => {
    expect(dayDiff("2026-10-16", "2026-10-18")).toBe(2);
    expect(dayDiff("2026-10-16", "2026-10-14")).toBe(-2);
  });

  it("dueText by day in the viewer's zone", () => {
    expect(dueText("2026-10-14T09:00:00Z", "todo", "UTC", NOW)).toBe("Overdue 2d");
    expect(dueText("2026-10-16T18:00:00Z", "todo", "UTC", NOW)).toBe("Due today");
    expect(dueText("2026-10-16T08:00:00Z", "todo", "UTC", NOW)).toBe("Overdue today");
    expect(dueText("2026-10-17T10:00:00Z", "todo", "UTC", NOW)).toBe("Due tomorrow");
    expect(dueText("2026-10-20T10:00:00Z", "blocked", "UTC", NOW)).toBe("Due in 4d");
    expect(dueText(null, "todo", "UTC", NOW)).toBe("No due date");
    expect(dueText("2026-10-01T10:00:00Z", "done", "UTC", NOW)).toBe("Done");
  });

  it("dueText respects the zone (Kolkata is already on the 17th)", () => {
    expect(dueText("2026-10-16T20:00:00Z", "todo", "Asia/Kolkata", NOW)).toBe("Due tomorrow");
  });

  it("stage progress", () => {
    expect(stageProgress(ev("2026-10-16T09:00:00Z", "2026-10-16T10:00:00Z"))).toBe("Editing (2/4)");
    expect(stagePercent({ currentStagePosition: 2, stageCount: 4 })).toBe(50);
    expect(stagePercent({ currentStagePosition: 1, stageCount: 0 })).toBe(0);
  });

  it("weekStrip counts events per day, multi-day events on each day", () => {
    const strip = weekStrip("2026-10-16", [ev("2026-10-16T09:00:00Z", "2026-10-16T10:00:00Z"), ev("2026-10-17T09:00:00Z", "2026-10-18T10:00:00Z")], "UTC");
    expect(strip.map((s) => s.count)).toEqual([1, 1, 1, 0, 0, 0, 0]);
    expect(strip).toHaveLength(7);
  });

  it("barPercents scales to the biggest", () => {
    expect(barPercents([4, 2, 0])).toEqual([100, 50, 0]);
    expect(barPercents([0, 0])).toEqual([0, 0]);
    expect(barPercents([])).toEqual([]);
  });

  it("totalTasks sums statuses", () => {
    expect(totalTasks({ todo: 1, in_progress: 2, blocked: 3, done: 4 })).toBe(10);
  });
});
