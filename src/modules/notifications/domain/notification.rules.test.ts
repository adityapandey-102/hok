import { describe, expect, it } from "vitest";
import { FALLBACK_URL, isAppPath, normalizePayload, planDelivery, sanitizeMutes, toPushMessage } from "./notification.rules";
import { clientReassignedPayload, taskAssignedPayload } from "./notification.messages";
import type { NotificationPreferences } from "./notification.entity";

describe("isAppPath", () => {
  it("accepts app paths", () => {
    expect(isAppPath("/app")).toBe(true);
    expect(isAppPath("/app/clients/0b6f?tab=events")).toBe(true);
  });

  it("refuses anything that could open another site", () => {
    for (const url of ["https://evil.test", "//evil.test", "/\\evil.test", "javascript:alert(1)", "app/clients", "/app/a b", ""]) {
      expect(isAppPath(url), url).toBe(false);
    }
  });
});

describe("normalizePayload", () => {
  it("trims and caps the title and body, collapsing whitespace", () => {
    const p = normalizePayload({ title: `  ${"x".repeat(200)}  `, body: " a \n b " });
    expect(p.title.length).toBe(120);
    expect(p.title.endsWith("…")).toBe(true);
    expect(p.body).toBe("a b");
  });

  it("replaces an unsafe url with the app home", () => {
    expect(normalizePayload({ title: "t", url: "https://evil.test" }).url).toBe(FALLBACK_URL);
    expect(normalizePayload({ title: "t" }).url).toBe(FALLBACK_URL);
  });

  it("keeps only short, well-named string data", () => {
    const p = normalizePayload({ title: "t", data: { clientId: "c1", "bad key": "x", nested: { a: 1 } as unknown as string } });
    expect(p.data).toEqual({ clientId: "c1" });
  });

  it("never stores an empty title", () => {
    expect(normalizePayload({ title: "   " }).title).toBe("HOK");
  });
});

describe("planDelivery", () => {
  const mutes: Record<string, NotificationPreferences> = {
    quiet: { mutedPush: ["client_reassigned"], mutedInApp: [] },
    silent: { mutedPush: [], mutedInApp: ["client_reassigned"] },
  };
  const prefs = (id: string) => mutes[id] ?? { mutedPush: [], mutedInApp: [] };

  it("notifies each recipient once and never the actor", () => {
    const plan = planDelivery({ type: "client_reassigned", recipientIds: ["a", "b", "a", "admin"], actorId: "admin" });
    expect(plan).toEqual({ inApp: ["a", "b"], push: ["a", "b"] });
  });

  it("applies push mutes to the push only", () => {
    expect(planDelivery({ type: "client_reassigned", recipientIds: ["quiet"], actorId: null }, prefs)).toEqual({ inApp: ["quiet"], push: [] });
  });

  it("muting the bell also mutes the push", () => {
    expect(planDelivery({ type: "client_reassigned", recipientIds: ["silent"], actorId: null }, prefs)).toEqual({ inApp: [], push: [] });
  });

  it("only mutes the trigger that was muted", () => {
    expect(planDelivery({ type: "task_assigned", recipientIds: ["quiet", "silent"], actorId: null }, prefs)).toEqual({
      inApp: ["quiet", "silent"],
      push: ["quiet", "silent"],
    });
  });
});

describe("toPushMessage", () => {
  it("gives the service worker title, body, url and a replace-tag", () => {
    const m = toPushMessage("client_reassigned", clientReassignedPayload({ clientId: "c1", clientName: "Chai Point", actorName: "Priya" }));
    expect(m).toEqual({
      title: "Chai Point is now your client",
      body: "Priya assigned this client to you.",
      url: "/app/clients/c1",
      tag: "client_reassigned:/app/clients/c1",
    });
  });
});

describe("message builders", () => {
  it("point at the right staff app pages", () => {
    expect(taskAssignedPayload({ taskId: "t1", title: "Edit reel" }).url).toBe("/app/tasks/t1");
    expect(clientReassignedPayload({ clientId: "c9", clientName: "X" }).body).toBe("This client was assigned to you.");
  });
});

describe("sanitizeMutes", () => {
  it("keeps known triggers only, once each, sorted", () => {
    expect(sanitizeMutes(["task_assigned", "nope", "client_reassigned", "task_assigned"], ["client_reassigned", "task_assigned"])).toEqual([
      "client_reassigned",
      "task_assigned",
    ]);
  });
});
