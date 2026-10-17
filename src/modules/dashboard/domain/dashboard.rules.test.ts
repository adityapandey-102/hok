import { describe, expect, it } from "vitest";
import { ROLES } from "../../../domain";
import type { DashboardEvent } from "./dashboard.entity";
import { dashboardSections, dashboardWindow, splitWeek } from "./dashboard.rules";

describe("dashboardWindow", () => {
  it("uses the viewer's local day, not UTC's", () => {
    // 20:00 UTC on 15 Oct = 01:30 on 16 Oct in Kolkata.
    const w = dashboardWindow(new Date("2026-10-15T20:00:00Z"), "Asia/Kolkata");
    expect(w).toEqual({
      timeZone: "Asia/Kolkata",
      today: "2026-10-16",
      todayStart: "2026-10-15T18:30:00.000Z",
      tomorrowStart: "2026-10-16T18:30:00.000Z",
      weekEnd: "2026-10-22T18:30:00.000Z",
    });
  });
});

describe("dashboardSections (overview, mine)", () => {
  it("gives the Admin the firm alone on the overview and their own work on mine", () => {
    expect(dashboardSections("admin", "overview")).toEqual({ tasks: false, clients: false, firm: true });
    expect(dashboardSections("admin", "mine")).toEqual({ tasks: true, clients: true, firm: false });
  });

  it("gives everyone else the same own-work dashboard for either view", () => {
    for (const role of ROLES.filter((r) => r !== "admin")) {
      const manager = role === "social_media_manager" || role === "marketing_manager";
      for (const view of ["overview", "mine"] as const) expect(dashboardSections(role, view)).toEqual({ tasks: true, clients: manager, firm: false });
    }
  });
});

describe("splitWeek", () => {
  const w = dashboardWindow(new Date("2026-10-16T06:00:00Z"), "UTC");
  const ev = (id: string, startsAt: string) => ({ id, startsAt }) as DashboardEvent;

  it("puts events that started before tomorrow under today (including ongoing ones)", () => {
    const events = [ev("ongoing", "2026-10-15T09:00:00Z"), ev("today", "2026-10-16T23:59:00Z"), ev("later", "2026-10-17T00:00:00Z")];
    const { today, upcoming } = splitWeek(events, w);
    expect(today.map((e) => e.id)).toEqual(["ongoing", "today"]);
    expect(upcoming.map((e) => e.id)).toEqual(["later"]);
  });

  it("caps each list", () => {
    const events = Array.from({ length: 5 }, (_, i) => ev(`e${i}`, "2026-10-18T10:00:00Z"));
    expect(splitWeek(events, w, 3).upcoming).toHaveLength(3);
  });
});
