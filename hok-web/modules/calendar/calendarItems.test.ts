import { describe, expect, it } from "vitest";
import { countByKind, countParts, countsAria, countsText, fromFeedItem, type FeedItem } from "./calendarItems";

const base = { id: "1", title: "T", startsAt: "2026-11-20T04:30:00Z", endsAt: "2026-11-20T05:30:00Z", timeZone: "UTC", clientId: null, clientName: null, ownerId: "o" };

describe("fromFeedItem", () => {
  it("maps a client event to an event page link", () => {
    const item = fromFeedItem({ ...base, kind: "event", eventType: "shoot", state: "active", currentStageName: "Planning" } as FeedItem);
    expect(item).toMatchObject({ kind: "event", href: "/app/events/1", type: "shoot", stageName: "Planning" });
  });
  it("maps a personal entry with no href, stage or state", () => {
    const item = fromFeedItem({ ...base, kind: "personal" } as FeedItem);
    expect(item).toMatchObject({ kind: "personal", href: "", type: "personal", state: "active", stageName: null });
  });
  it("maps a task to its page, with status, priority and assignee", () => {
    const item = fromFeedItem({ ...base, kind: "task", status: "in_progress", priority: "high", assigneeId: "a", assigneeName: "Meera", clientId: "c", clientName: "Chai Point" } as FeedItem);
    expect(item).toMatchObject({ kind: "task", href: "/app/tasks/1", type: "task", taskStatus: "in_progress", taskPriority: "high", assigneeName: "Meera", clientName: "Chai Point", stageName: null });
  });
  it("maps a to-do to the to-dos page, with urgency and done", () => {
    const item = fromFeedItem({ ...base, kind: "todo", urgency: "urgent", done: true } as FeedItem);
    expect(item).toMatchObject({ kind: "todo", href: "/app/todos", type: "todo", urgency: "urgent", done: true, taskStatus: null, clientName: null });
  });
});

describe("counts per kind (the month cell)", () => {
  const items = [{ kind: "event" }, { kind: "event" }, { kind: "task" }, { kind: "task" }, { kind: "task" }, { kind: "todo" }, { kind: "personal" }] as const;

  it("counts each kind in one pass", () => {
    expect(countByKind(items)).toEqual({ event: 2, task: 3, todo: 1, personal: 1 });
    expect(countByKind([])).toEqual({ event: 0, task: 0, todo: 0, personal: 0 });
  });

  it("lists only the non-zero kinds, in the fixed order events, tasks, to-dos, personal", () => {
    expect(countParts(countByKind(items)).map((p) => p.kind)).toEqual(["event", "task", "todo", "personal"]);
    expect(countParts(countByKind([{ kind: "personal" }, { kind: "event" }])).map((p) => p.kind)).toEqual(["event", "personal"]);
    expect(countParts(countByKind([]))).toEqual([]);
  });

  it("writes the visible line with singular and plural words", () => {
    expect(countsText(countByKind(items))).toBe("2 events · 3 tasks · 1 to-do · 1 personal");
    expect(countsText(countByKind([{ kind: "task" }]))).toBe("1 task");
    expect(countsText(countByKind([{ kind: "todo" }, { kind: "todo" }]))).toBe("2 to-dos");
    expect(countsText(countByKind([]))).toBe("");
  });

  it("writes the screen-reader line in words", () => {
    expect(countsAria(countByKind(items))).toBe("2 events, 3 tasks, 1 to-do, 1 personal entry");
    expect(countsAria(countByKind([{ kind: "personal" }, { kind: "personal" }]))).toBe("2 personal entries");
  });
});
