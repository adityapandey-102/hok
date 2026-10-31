import { describe, expect, it } from "vitest";
import { eventTypeLabel, formatEventWhen, stageSummary } from "./portalFormat";

describe("portal formatting", () => {
  it("shows times in the client's zone, on one day or across days", () => {
    const sameDay = formatEventWhen({ startsAt: "2026-11-20T04:30:00Z", endsAt: "2026-11-20T06:30:00Z" }, "Asia/Kolkata");
    expect(sameDay).toContain("10:00");
    expect(sameDay).toContain("12:00");
    expect(sameDay.match(/Nov/g)).toHaveLength(1);
    const twoDays = formatEventWhen({ startsAt: "2026-11-20T18:00:00Z", endsAt: "2026-11-21T10:00:00Z" }, "Europe/London");
    expect(twoDays.match(/Nov/g)).toHaveLength(2);
  });

  it("summarises progress and falls back for unknown types", () => {
    const e = { stages: [{ position: 1, name: "Plan" }, { position: 2, name: "Shoot" }], currentStagePosition: 2, stageCount: 2 };
    expect(stageSummary(e)).toBe("Stage 2 of 2 · Shoot");
    expect(eventTypeLabel("shoot")).toBe("Shoot");
    expect(eventTypeLabel("mystery")).toBe("Event");
  });
});
