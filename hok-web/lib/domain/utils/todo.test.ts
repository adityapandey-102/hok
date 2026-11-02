import { describe, expect, it } from "vitest";
import { defaultDueForDay, todoDueLabel } from "./todo";

const ZONE = "Asia/Kolkata";
// 2026-11-04 10:00 in Kolkata (04:30 UTC).
const NOW = Date.parse("2026-11-04T04:30:00Z");
const at = (localIso: string) => new Date(Date.parse(`${localIso}+05:30`)).toISOString();

describe("todoDueLabel", () => {
  it("says there is no due date", () => {
    expect(todoDueLabel(null, false, ZONE, NOW)).toEqual({ text: "No due date", overdue: false, today: false });
  });

  it("labels later today and tomorrow with the time", () => {
    expect(todoDueLabel(at("2026-11-04T17:00:00"), false, ZONE, NOW)).toEqual({ text: "Today 5:00 pm", overdue: false, today: true });
    expect(todoDueLabel(at("2026-11-05T09:30:00"), false, ZONE, NOW)).toMatchObject({ text: "Tomorrow 9:30 am", overdue: false });
  });

  it("labels a later day with its weekday and date", () => {
    const label = todoDueLabel(at("2026-11-11T14:00:00"), false, ZONE, NOW);
    expect(label).toMatchObject({ overdue: false, today: false });
    expect(label.text).toMatch(/^Wed,? 11 Nov,? 2:00 pm$/);
  });

  it("counts overdue by calendar days, not by 24-hour blocks", () => {
    expect(todoDueLabel(at("2026-11-03T23:00:00"), false, ZONE, NOW)).toMatchObject({ text: "Overdue · 1 day", overdue: true });
    expect(todoDueLabel(at("2026-11-02T08:00:00"), false, ZONE, NOW)).toMatchObject({ text: "Overdue · 2 days", overdue: true });
  });

  it("marks an earlier time today as overdue with that time", () => {
    expect(todoDueLabel(at("2026-11-04T09:00:00"), false, ZONE, NOW)).toEqual({ text: "Overdue · today 9:00 am", overdue: true, today: false });
  });

  it("never calls a done to-do overdue", () => {
    const label = todoDueLabel(at("2026-11-02T08:00:00"), true, ZONE, NOW);
    expect(label.overdue).toBe(false);
    expect(label.text).toMatch(/^Mon,? 2 Nov,? 8:00 am$/);
  });

  it("uses the viewer's zone for the day boundary", () => {
    // 2026-11-04 23:00 UTC is already 5 Nov in Kolkata (4:30 am), but still 4 Nov in UTC.
    expect(todoDueLabel("2026-11-04T23:00:00Z", false, ZONE, NOW).text).toBe("Tomorrow 4:30 am");
    expect(todoDueLabel("2026-11-04T23:00:00Z", false, "UTC", NOW).text).toBe("Today 11:00 pm");
  });
});

describe("defaultDueForDay", () => {
  it("is 17:00 on that day, in the form input's format", () => {
    expect(defaultDueForDay("2026-11-20")).toBe("2026-11-20T17:00");
  });
});
