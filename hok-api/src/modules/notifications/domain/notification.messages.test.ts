import { describe, expect, it } from "vitest";
import { eventReminderPayload, taskDueReminderPayload, taskStatusChangedPayload, timeUntilWords } from "./notification.messages";

describe("taskStatusChangedPayload", () => {
  it("names the status in words, not the stored code", () => {
    const p = taskStatusChangedPayload({ taskId: "t1", title: "Edit the reel", to: "in_progress", actorName: "Meera" });
    expect(p.title).toBe("Edit the reel: In progress");
    expect(p.body).toBe("Meera moved this task to In progress.");
    expect(taskStatusChangedPayload({ taskId: "t1", title: "X", to: "done" }).body).toBe("This task moved to Done.");
  });
});

describe("reminder messages", () => {
  const now = new Date("2026-10-20T03:00:00Z");

  it("says how long is left in plain words", () => {
    expect(timeUntilWords(45 * 60_000)).toBe("45 min");
    expect(timeUntilWords(110 * 60_000)).toBe("1 h 50 min");
    expect(timeUntilWords(120 * 60_000)).toBe("2 h");
    expect(timeUntilWords(5_000)).toBe("1 min");
  });

  it("names the event, the client and the local start time", () => {
    const p = eventReminderPayload({
      eventId: "e1",
      title: "Brand shoot",
      clientName: "Chai Point Cafe",
      startsAt: new Date("2026-10-20T04:55:00Z"),
      timeZone: "Asia/Kolkata",
      now,
    });
    expect(p.title).toBe("Starts in 1 h 55 min: Brand shoot");
    expect(p.body).toBe("Chai Point Cafe · 10:25 am (Asia/Kolkata)");
    expect(p.url).toBe("/app/events/e1");
  });

  it("names the task and its due time in the assignee's zone", () => {
    const p = taskDueReminderPayload({ taskId: "t1", title: "Edit the reel", dueAt: new Date("2026-10-20T05:00:00Z"), timeZone: "Asia/Kolkata", now });
    expect(p.title).toBe("Due in 2 h: Edit the reel");
    expect(p.body).toBe("Due at 10:30 am.");
  });
});
