import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { and, eq } from "drizzle-orm";
import { createApp } from "../../src/app";
import { db } from "../../src/common/database/drizzle-client";
import { notifications, pushSubscriptions } from "../../src/modules/notifications/infrastructure/notifications.schema";
import { DrizzleNotificationsRepository } from "../../src/modules/notifications/infrastructure/drizzle-notifications.repository";
import { NotificationDispatcher } from "../../src/modules/notifications/application/notification-dispatcher";
import { inArray, or } from "drizzle-orm";
import { staffTasks } from "../../src/modules/staff-tasks/infrastructure/staff-tasks.schema";
import type { PushOutcome, PushSender } from "../../src/modules/notifications/application/ports/push-sender.port";
import { bearerFor, closeDb, createFixtureUser, deleteClientsOwnedBy, deleteFixtureUser, type FixtureUser } from "./helpers";

/**
 * The Notifications module end to end (REQUIREMENTS §5.10): real app, real
 * auth, real Postgres. The live trigger (an Admin reassigns a client -> the
 * new owner's bell, written in the reassignment's transaction), the bell
 * (list, unread count, read, read-all, row scope), preferences, push devices,
 * and the dispatcher's push bookkeeping against the database with web push
 * faked behind the PushSender port (no network).
 *
 * No push device is registered for anyone who gets a real notification here,
 * so the app's real sender never tries to reach a push service.
 *
 * Needs migration 20261014500001_notifications.sql applied.
 */
const app = createApp();
let admin: FixtureUser;
let smm: FixtureUser;
let mm: FixtureUser;
let editor: FixtureUser;
const auth: Record<string, string> = {};
let clientId = "";

interface Prefs {
  preferences: { type: string; push: boolean; inApp: boolean }[];
}

interface Bell {
  id: string;
  type: string;
  title: string;
  url: string | null;
  data: Record<string, string>;
  actorName: string | null;
  readAt: string | null;
}

beforeAll(async () => {
  admin = await createFixtureUser("admin", "IT Notify Admin");
  smm = await createFixtureUser("social_media_manager", "IT Notify SMM");
  mm = await createFixtureUser("marketing_manager", "IT Notify MM");
  editor = await createFixtureUser("editor", "IT Notify Editor");
  for (const u of [admin, smm, mm, editor]) auth[u.role] = await bearerFor(u);
  const res = await request(app).post("/api/v1/clients").set("Authorization", auth.social_media_manager!).send({ businessName: "IT Notify Cafe" });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  clientId = (res.body as { client: { id: string } }).client.id;
});

afterAll(async () => {
  const people = [admin, smm, mm, editor].filter(Boolean).map((u) => u.id);
  await deleteClientsOwnedBy(people);
  await db.delete(staffTasks).where(or(inArray(staffTasks.assigneeId, people), inArray(staffTasks.assignedBy, people)));
  // Notifications, devices and preferences cascade with the profiles.
  for (const id of people) await deleteFixtureUser(id);
  await closeDb();
});

async function bell(role: string, query = ""): Promise<{ notifications: Bell[]; total: number }> {
  const res = await request(app).get(`/api/v1/notifications${query}`).set("Authorization", auth[role]!);
  expect(res.status).toBe(200);
  return res.body as { notifications: Bell[]; total: number };
}

async function unread(role: string): Promise<number> {
  const res = await request(app).get("/api/v1/notifications/unread-count").set("Authorization", auth[role]!);
  expect(res.status).toBe(200);
  return (res.body as { count: number }).count;
}

/** Make `ownerId` the client's only team member and lead (the old single-owner reassign). */
async function reassign(ownerId: string, version?: number) {
  return request(app)
    .put(`/api/v1/clients/${clientId}/team`)
    .set("Authorization", auth.admin!)
    .send({ leadId: ownerId, memberIds: [], ...(version ? { version } : {}) });
}

describe("client reassigned -> the new owner's bell", () => {
  it("notifies the new owner only, pointing at the client", async () => {
    expect((await reassign(mm.id, 1)).status).toBe(200);
    const { notifications: rows, total } = await bell("marketing_manager");
    expect(total).toBe(1);
    expect(rows[0]).toMatchObject({
      type: "client_reassigned",
      title: "IT Notify Cafe is now your client",
      url: `/app/clients/${clientId}`,
      data: { clientId },
      actorName: "IT Notify Admin",
      readAt: null,
    });
    expect(await unread("marketing_manager")).toBe(1);
    expect((await bell("social_media_manager")).total).toBe(0);
    expect((await bell("admin")).total).toBe(0); // the actor is never notified
  });

  it("writes nothing when the reassignment fails (same transaction)", async () => {
    expect((await reassign(smm.id, 99)).status).toBe(409);
    expect((await bell("social_media_manager")).total).toBe(0);
  });

  it("writes nothing when the Admin takes the client themselves", async () => {
    expect((await reassign(admin.id)).status).toBe(200);
    expect((await bell("admin")).total).toBe(0);
  });
});

describe("staff tasks -> the other side's bell (M7 + M9)", () => {
  it("assigning notifies the assignee; the assignee's status change notifies the assigning Admin", async () => {
    const created = await request(app).post("/api/v1/staff-tasks").set("Authorization", auth.admin!).send({ title: "Bell task", assigneeId: editor.id, rawFilesUrl: "https://drive.google.com/drive/folders/bell" });
    expect(created.status).toBe(201);
    const task = (created.body as { task: { id: string; version: number } }).task;
    expect((await bell("editor")).notifications.some((n) => n.type === "task_assigned")).toBe(true);

    const moved = await request(app).post(`/api/v1/staff-tasks/${task.id}/status`).set("Authorization", auth.editor!).send({ status: "in_progress", version: task.version });
    expect(moved.status).toBe(200);
    expect((await bell("admin")).notifications.some((n) => n.type === "task_status_changed")).toBe(true);
    // Nobody is told about their own action.
    expect((await bell("editor")).notifications.some((n) => n.type === "task_status_changed")).toBe(false);
    // Leave both bells read for the tests below.
    for (const role of ["admin", "editor"]) await request(app).post("/api/v1/notifications/read-all").set("Authorization", auth[role]!);
  });
});

describe("the bell", () => {
  it("marks one read (idempotent); someone else's or a bad id is a 404", async () => {
    const [first] = (await bell("marketing_manager")).notifications;
    expect((await request(app).post(`/api/v1/notifications/${first!.id}/read`).set("Authorization", auth.social_media_manager!)).status).toBe(404);
    expect((await request(app).post("/api/v1/notifications/not-a-uuid/read").set("Authorization", auth.marketing_manager!)).status).toBe(404);
    expect((await request(app).post(`/api/v1/notifications/${first!.id}/read`).set("Authorization", auth.marketing_manager!)).status).toBe(204);
    expect((await request(app).post(`/api/v1/notifications/${first!.id}/read`).set("Authorization", auth.marketing_manager!)).status).toBe(204);
    expect(await unread("marketing_manager")).toBe(0);
    expect((await bell("marketing_manager", "?unread=true")).total).toBe(0);
  });

  it("marks all read", async () => {
    expect((await reassign(mm.id)).status).toBe(200);
    expect(await unread("marketing_manager")).toBe(1);
    const res = await request(app).post("/api/v1/notifications/read-all").set("Authorization", auth.marketing_manager!);
    expect(res.body).toEqual({ updated: 1 });
    expect(await unread("marketing_manager")).toBe(0);
  });

  it("caps the page size", async () => {
    const res = await request(app).get("/api/v1/notifications?limit=100000").set("Authorization", auth.marketing_manager!);
    expect((res.body as { limit: number }).limit).toBe(50);
  });
});

describe("preferences", () => {
  it("lists the live triggers, all on by default", async () => {
    const res = await request(app).get("/api/v1/notifications/preferences").set("Authorization", auth.social_media_manager!);
    expect((res.body as Prefs).preferences.map(({ type, push, inApp }) => ({ type, push, inApp }))).toEqual([
      { type: "client_reassigned", push: true, inApp: true },
      { type: "task_assigned", push: true, inApp: true },
      { type: "task_status_changed", push: true, inApp: true },
      { type: "task_commented", push: true, inApp: true },
      { type: "client_comment", push: true, inApp: true },
      { type: "event_reminder", push: true, inApp: true },
      { type: "task_due_reminder", push: true, inApp: true },
    ]);
  });

  it("a muted bell means no notification at all", async () => {
    const put = await request(app)
      .put("/api/v1/notifications/preferences")
      .set("Authorization", auth.social_media_manager!)
      .send({ preferences: [{ type: "client_reassigned", push: true, inApp: false }] });
    expect(put.status).toBe(200);
    expect((put.body as Prefs).preferences[0]).toMatchObject({ push: false, inApp: false });
    expect((await reassign(smm.id)).status).toBe(200);
    expect((await bell("social_media_manager")).total).toBe(0);
  });

  it("refuses an unknown trigger", async () => {
    const res = await request(app)
      .put("/api/v1/notifications/preferences")
      .set("Authorization", auth.social_media_manager!)
      .send({ preferences: [{ type: "email_digest", push: false, inApp: false }] });
    expect(res.status).toBe(400);
  });
});

describe("push devices", () => {
  const endpoint = `https://push.example.test/it-${Date.now()}`;
  const sub = { endpoint, keys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" } };

  it("reports the push config", async () => {
    const res = await request(app).get("/api/v1/notifications/push/config").set("Authorization", auth.editor!);
    expect(res.status).toBe(200);
    const cfg = res.body as { enabled: boolean; publicKey: string | null };
    expect(typeof cfg.enabled).toBe("boolean");
    expect(cfg.enabled ? typeof cfg.publicKey : cfg.publicKey).toBe(cfg.enabled ? "string" : null);
  });

  it("subscribes (upsert by endpoint) and lists devices without endpoints or keys", async () => {
    expect((await request(app).post("/api/v1/notifications/push/subscriptions").set("Authorization", auth.editor!).send({ ...sub, userAgent: "IT browser" })).status).toBe(201);
    expect((await request(app).post("/api/v1/notifications/push/subscriptions").set("Authorization", auth.editor!).send(sub)).status).toBe(201);
    const list = await request(app).get("/api/v1/notifications/push/subscriptions").set("Authorization", auth.editor!);
    const { devices } = list.body as { devices: Record<string, unknown>[] };
    expect(devices).toHaveLength(1);
    expect(Object.keys(devices[0]!)).toEqual(["id", "userAgent", "createdAt", "lastUsedAt"]);
  });

  it("refuses a non-https endpoint", async () => {
    const res = await request(app).post("/api/v1/notifications/push/subscriptions").set("Authorization", auth.editor!).send({ ...sub, endpoint: "http://push.example.test/x" });
    expect(res.status).toBe(400);
  });

  it("someone else's device is a 404; the owner can remove it", async () => {
    const [d] = (await db.select({ id: pushSubscriptions.id }).from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint)));
    expect((await request(app).delete(`/api/v1/notifications/push/subscriptions/${d!.id}`).set("Authorization", auth.marketing_manager!)).status).toBe(404);
    expect((await request(app).post("/api/v1/notifications/push/subscriptions/unsubscribe").set("Authorization", auth.marketing_manager!).send({ endpoint })).status).toBe(204);
    expect((await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint))).length).toBe(1); // still the editor's
    expect((await request(app).delete(`/api/v1/notifications/push/subscriptions/${d!.id}`).set("Authorization", auth.editor!)).status).toBe(204);
    expect((await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint))).length).toBe(0);
  });
});

describe("dispatcher bookkeeping with a fake push service", () => {
  it("writes the bell, pushes to live devices, deletes gone ones, stamps last_used_at", async () => {
    const live = `https://push.example.test/live-${Date.now()}`;
    const gone = `https://push.example.test/gone-${Date.now()}`;
    const keys = { p256dh: "BNcR", auth: "tBHI" };
    await db.insert(pushSubscriptions).values([
      { userId: editor.id, endpoint: live, ...keys, lastUsedAt: new Date("2026-01-01T00:00:00Z") },
      { userId: editor.id, endpoint: gone, ...keys },
    ]);
    const sent: string[] = [];
    const fake: PushSender = {
      enabled: true,
      publicKey: "test",
      send: (s) => {
        sent.push(s.endpoint);
        return Promise.resolve<PushOutcome>(s.endpoint.includes("/gone-") ? "gone" : "sent");
      },
    };
    const dispatcher = new NotificationDispatcher(new DrizzleNotificationsRepository(), fake);
    await dispatcher.notify({ type: "client_reassigned", recipientIds: [editor.id], actorId: admin.id, payload: { title: "IT push", url: "/app" } });
    await dispatcher.flush();

    expect(sent.sort()).toEqual([gone, live].sort());
    const rows = await db.select().from(notifications).where(and(eq(notifications.userId, editor.id), eq(notifications.type, "client_reassigned")));
    expect(rows.map((r) => r.payload.title)).toEqual(["IT push"]);
    const devices = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, editor.id));
    expect(devices.map((d) => d.endpoint)).toEqual([live]);
    expect(devices[0]!.lastUsedAt.getTime()).toBeGreaterThan(new Date("2026-01-02T00:00:00Z").getTime());
  });
});
