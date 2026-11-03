import { describe, expect, it } from "vitest";
import {
  approvalDecidedPayload,
  approvalRequestedPayload,
  eventReminderPayload,
  taskDueReminderPayload,
  taskStatusChangedPayload,
  timeUntilWords,
  todoReminderPayload,
} from "./notification.messages";

describe("taskStatusChangedPayload", () => {
  it("says what happened to the task, in words", () => {
    const moved = taskStatusChangedPayload({ taskId: "t1", title: "Edit the reel", action: "stage", stageName: "Rough cut", actorName: "Meera" });
    expect(moved.title).toBe("Moved Edit the reel to Rough cut");
    expect(moved.body).toBe("Moved to Rough cut by Meera.");
    expect(moved.data).toEqual({ taskId: "t1", action: "stage", stageName: "Rough cut" });
    expect(taskStatusChangedPayload({ taskId: "t1", title: "X", action: "completed" }).title).toBe("Completed X");
    expect(taskStatusChangedPayload({ taskId: "t1", title: "X", action: "unblocked" }).title).toBe("Unblocked X");
    expect(taskStatusChangedPayload({ taskId: "t1", title: "X", action: "reopened", stageName: "Review" }).body).toBe("Back at Review.");
  });

  it("carries the block reason in the title, body and data", () => {
    const p = taskStatusChangedPayload({ taskId: "t1", title: "X", action: "blocked", reason: "Waiting for footage" });
    expect(p.title).toBe("Blocked X: Waiting for footage");
    expect(p.body).toBe("Waiting for footage");
    expect(p.data?.reason).toBe("Waiting for footage");
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

  describe("todoReminderPayload", () => {
    const base = { todoId: "d1", title: "Call the printer", timeZone: "Asia/Kolkata" };
    const dueAt = new Date("2026-10-20T05:00:00Z");

    it("a day ahead says so in days", () => {
      const p = todoReminderPayload({ ...base, dueAt, now: new Date("2026-10-19T05:03:00Z") });
      expect(p.title).toBe("Due in 1 day: Call the printer");
      expect(p.body).toBe("Due at 10:30 am.");
      expect(p.url).toBe("/app/todos");
      expect(p.data).toEqual({ todoId: "d1" });
    });

    it("an hour ahead says the minutes left", () => {
      expect(todoReminderPayload({ ...base, dueAt, now: new Date("2026-10-20T04:05:00Z") }).title).toBe("Due in 55 min: Call the printer");
      expect(todoReminderPayload({ ...base, dueAt, now: new Date("2026-10-20T04:00:00Z") }).title).toBe("Due in 1 h: Call the printer");
    });

    it("at the due time (a few minutes either side) says now", () => {
      expect(todoReminderPayload({ ...base, dueAt, now: new Date("2026-10-20T05:04:00Z") }).title).toBe("Due now: Call the printer");
      expect(todoReminderPayload({ ...base, dueAt, now: new Date("2026-10-20T04:50:00Z") }).title).toBe("Due now: Call the printer");
    });
  });
});

describe("approval notifications (round 3)", () => {
  it("a request names the stage and links to the item's page; the data carries ids only", () => {
    const p = approvalRequestedPayload({ subject: "task", itemId: "t1", itemTitle: "Reel edit", stageName: "Review", approvalId: "a1" });
    expect(p).toMatchObject({ title: "Approval needed: Review", url: "/app/tasks/t1", data: { approvalId: "a1", taskId: "t1" } });
    expect(approvalRequestedPayload({ subject: "event", itemId: "e1", itemTitle: "Shoot", stageName: "Client Review", approvalId: "a2" }).url).toBe("/app/events/e1");
  });

  it("a decision says approved or changes requested, and whether the client or an approver did it", () => {
    const base = { subject: "event" as const, itemId: "e1", itemTitle: "Shoot", stageName: "Client Review", approvalId: "a2" };
    expect(approvalDecidedPayload({ ...base, decision: "approve", via: "portal" })).toMatchObject({ title: "Approved: Client Review", body: "The client approved Shoot." });
    expect(approvalDecidedPayload({ ...base, decision: "changes", via: "staff" })).toMatchObject({ title: "Changes requested: Client Review", body: "An approver asked for changes on Shoot." });
  });
});
