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

describe("dashboardSections", () => {
  it("gives clients to client managers and the firm to Admin only", () => {
    const got = Object.fromEntries(ROLES.map((r) => [r, dashboardSections(r)]));
    expect(got).toEqual({
      admin: { clients: true, firm: true },
      social_media_manager: { clients: true, firm: false },
      marketing_manager: { clients: true, firm: false },
      marketing_agent: { clients: false, firm: false },
      developer: { clients: false, firm: false },
      editor: { clients: false, firm: false },
    });
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
