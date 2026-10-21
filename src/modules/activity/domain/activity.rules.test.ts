import { describe, expect, it } from "vitest";
import { ACTIVITY_MAX_SPAN_DAYS, type ActivityRow } from "./activity.entity";
import { activityUrl, describeActivity, resolveActivityRange, statusLabel, toActivityItem } from "./activity.rules";

const base: ActivityRow = {
  id: "a:1",
  at: new Date("2026-10-21T10:00:00Z"),
  kind: "events",
  source: "audit",
  action: "auth.login",
  actorId: "11111111-1111-4111-8111-111111111111",
  actorName: "Sara",
  clientId: null,
  clientName: null,
  eventId: null,
  eventTitle: null,
  taskId: null,
  taskTitle: null,
  subjectName: null,
  targetUserId: null,
  targetUserName: null,
  assetTitle: null,
  todoTitle: null,
  templateName: null,
  stageName: null,
  fromStatus: null,
  toStatus: null,
};
const row = (over: Partial<ActivityRow>): ActivityRow => ({ ...base, ...over });
const code = (fn: () => unknown) => {
  try {
    fn();
    return "ok";
  } catch (e) {
    const err = e as { statusCode?: number; code?: string };
    return `${err.statusCode}:${err.code}`;
  }
};

describe("statusLabel", () => {
  it("never leaks a raw code", () => {
    expect(statusLabel("in_progress")).toBe("In progress");
    expect(statusLabel("todo")).toBe("To do");
    expect(statusLabel("solved")).toBe("Solved");
    expect(statusLabel("on_hold")).toBe("On hold");
    expect(statusLabel(null)).toBe("a new status");
  });
});

describe("describeActivity", () => {
  it("stage moves", () => {
    const r = row({ source: "stage", action: "stage_moved", actorName: "Rohan", eventTitle: "Brand shoot", stageName: "Approval" });
    expect(describeActivity(r)).toBe("Rohan moved Brand shoot to Approval");
  });

  it("task updates, with readable statuses", () => {
    const t = row({ source: "task", kind: "tasks", actorName: "Meera", taskTitle: "Edit the reel" });
    expect(describeActivity({ ...t, action: "status", toStatus: "in_progress" })).toBe("Meera marked Edit the reel as In progress");
    expect(describeActivity({ ...t, action: "comment" })).toBe("Meera commented on Edit the reel");
    expect(describeActivity({ ...t, action: "reassigned", subjectName: "Dev" })).toBe("Meera reassigned Edit the reel to Dev");
    expect(describeActivity({ ...t, action: "reopened" })).toBe("Meera reopened Edit the reel");
  });

  it("a client's comment has the client as the subject", () => {
    expect(describeActivity(row({ source: "comment", kind: "comments", action: "comment_posted", actorId: null, actorName: null, clientName: "Chai Point Cafe" }))).toBe(
      "Chai Point Cafe posted a comment",
    );
  });

  it("comment status changes", () => {
    const r = row({ source: "comment_status", kind: "comments", action: "comment_status", clientName: "Chai Point Cafe", toStatus: "solved" });
    expect(describeActivity(r)).toBe("Sara marked a comment from Chai Point Cafe as Solved");
  });

  it("audit actions", () => {
    expect(describeActivity(row({ action: "auth.login" }))).toBe("Sara signed in");
    expect(describeActivity(row({ action: "client.created", clientName: "Chai Point Cafe" }))).toBe("Sara added the client Chai Point Cafe");
    expect(describeActivity(row({ action: "client.reassigned", clientName: "Chai", subjectName: "Meera" }))).toBe("Sara moved the client Chai to Meera");
    expect(describeActivity(row({ action: "user.created", targetUserName: "Rohan" }))).toBe("Sara created the account for Rohan");
    expect(describeActivity(row({ action: "asset.created", assetTitle: "Raw clips" }))).toBe("Sara added the asset Raw clips");
    expect(describeActivity(row({ action: "portal_link.generated", clientName: "Chai" }))).toBe("Sara created a portal link for Chai");
    expect(describeActivity(row({ action: "calendar_feed.created" }))).toBe("Sara made a calendar subscribe link");
  });

  it("falls back gracefully when a name is gone or the actor is unknown", () => {
    expect(describeActivity(row({ action: "staff_task.deleted", actorName: null }))).toBe("Someone deleted a task");
    expect(describeActivity(row({ action: "event.updated" }))).toBe("Sara updated an event");
    expect(describeActivity(row({ action: "something.new" }))).toBe("Sara made a change (something new)");
  });

  it("never prints a raw snake_case code for any known status", () => {
    for (const s of ["todo", "in_progress", "blocked", "done", "received", "solved"]) {
      expect(describeActivity(row({ source: "task", action: "status", taskTitle: "T", toStatus: s }))).not.toMatch(/_/);
    }
  });
});

describe("activityUrl / toActivityItem", () => {
  it("links to the subject's page when it has one", () => {
    expect(activityUrl(row({ source: "stage", action: "stage_moved", eventId: "e1", eventTitle: "X" }))).toBe("/app/events/e1");
    expect(activityUrl(row({ source: "task", kind: "tasks", action: "status", taskId: "t1", taskTitle: "T" }))).toBe("/app/tasks/t1");
    expect(activityUrl(row({ kind: "clients", action: "client.created", clientId: "c1", clientName: "C" }))).toBe("/app/clients/c1");
    expect(activityUrl(row({ kind: "comments", source: "comment", action: "comment_posted" }))).toBe("/app/comments");
    expect(activityUrl(row({ kind: "accounts", action: "user.updated", targetUserId: "u1", targetUserName: "U" }))).toBe("/app/admin/users/u1");
  });

  it("has no link when the record is gone or there is no page", () => {
    expect(activityUrl(row({ kind: "accounts", action: "auth.login" }))).toBeNull();
    expect(activityUrl(row({ source: "task", kind: "tasks", action: "status", taskId: "t1", taskTitle: null }))).toBeNull();
    expect(activityUrl(row({ kind: "clients", action: "client.created", clientId: null }))).toBeNull();
  });

  it("shapes the wire item (null actor for a client)", () => {
    const item = toActivityItem(row({ source: "comment", kind: "comments", action: "comment_posted", actorId: null, actorName: null, clientName: "Chai" }));
    expect(item).toEqual({ id: "a:1", at: "2026-10-21T10:00:00.000Z", kind: "comments", actor: null, summary: "Chai posted a comment", url: "/app/comments" });
    expect(toActivityItem(base).actor).toEqual({ id: base.actorId, name: "Sara" });
  });
});

describe("resolveActivityRange", () => {
  const now = new Date("2026-10-21T12:00:00Z");
  it("defaults to the last 7 days", () => {
    const r = resolveActivityRange({}, now);
    expect(r.to).toEqual(now);
    expect(r.to.getTime() - r.from.getTime()).toBe(7 * 24 * 3600_000);
  });
  it("accepts a span of exactly 31 days", () => {
    const from = new Date(now.getTime() - ACTIVITY_MAX_SPAN_DAYS * 24 * 3600_000);
    expect(code(() => resolveActivityRange({ from, to: now }, now))).toBe("ok");
  });
  it("rejects a longer span and an inverted range with ACTIVITY_RANGE_INVALID", () => {
    const from = new Date(now.getTime() - (ACTIVITY_MAX_SPAN_DAYS * 24 * 3600_000 + 1));
    expect(code(() => resolveActivityRange({ from, to: now }, now))).toBe("400:ACTIVITY_RANGE_INVALID");
    expect(code(() => resolveActivityRange({ from: now, to: new Date(now.getTime() - 1000) }, now))).toBe("400:ACTIVITY_RANGE_INVALID");
  });
});
