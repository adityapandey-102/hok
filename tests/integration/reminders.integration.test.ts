import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { eq, sql } from "drizzle-orm";
import { createApp } from "../../src/app";
import { db } from "../../src/common/database/drizzle-client";
import { events } from "../../src/modules/events/infrastructure/events.schema";
import { staffTasks } from "../../src/modules/staff-tasks/infrastructure/staff-tasks.schema";
import { createReminderRunner } from "../../src/modules/reminders/reminders.module";
import {
  bearerFor,
  closeDb,
  createFixtureUser,
  deleteClientsOwnedBy,
  deleteFixtureUser,
  deleteStaffTasksFor,
  deleteStageTemplates,
  type FixtureUser,
} from "./helpers";

/**
 * Phase 2 reminders against the real database: what is due in the next two
 * hours gets exactly one bell message (to the client's owner / the assignee);
 * what is later, already started, cancelled or done gets none; a new time
 * gives a new reminder. The dev API's own background check may claim these
 * rows first -- the assertions are on the outcome (one message each, never
 * two), which is exactly the multi-instance guarantee.
 */
const app = createApp();
const runner = createReminderRunner();
let admin: FixtureUser;
let owner: FixtureUser;
let editor: FixtureUser;
let adminAuth: string;
let ownerAuth: string;
let clientId: string;
let templateId: string;
const ids = {} as { soon: string; later: string; started: string; cancelled: string; task: string };
const HOUR = 3_600_000;
const iso = (ms: number) => new Date(ms).toISOString();
type Json = Record<string, unknown>;

async function bellCount(userId: string, type: string, subjectKey: "eventId" | "taskId", subjectId: string): Promise<number> {
  const res = await db.execute(
    sql`select count(*)::int as n from notifications where user_id = ${userId} and type = ${type} and payload -> 'data' ->> ${subjectKey} = ${subjectId}`,
  );
  return (res.rows[0] as { n: number }).n;
}

async function createEvent(title: string, startMs: number): Promise<string> {
  const res = await request(app)
    .post("/api/v1/events")
    .set("Authorization", ownerAuth)
    .send({ clientId, templateId, title, type: "shoot", startsAt: iso(startMs), endsAt: iso(startMs + HOUR) });
  expect(res.status).toBe(201);
  return ((res.body as Json).event as Json).id as string;
}

beforeAll(async () => {
  [admin, owner, editor] = await Promise.all([
    createFixtureUser("admin", "Remind Admin"),
    createFixtureUser("social_media_manager", "Remind Owner"),
    createFixtureUser("editor", "Remind Editor"),
  ]);
  [adminAuth, ownerAuth] = await Promise.all([bearerFor(admin), bearerFor(owner)]);
  const c = await request(app).post("/api/v1/clients").set("Authorization", ownerAuth).send({ businessName: "Remind Test Studio" });
  clientId = ((c.body as Json).client as Json).id as string;
  const t = await request(app).post("/api/v1/stage-templates").set("Authorization", adminAuth).send({ name: `IT Remind Tpl ${Date.now()}`, stages: ["Plan", "Shoot"] });
  templateId = ((t.body as Json).template as Json).id as string;

  const now = Date.now();
  ids.soon = await createEvent("Remind soon", now + HOUR);
  ids.later = await createEvent("Remind later", now + 3 * HOUR);
  ids.started = await createEvent("Remind started", now - 10 * 60_000);
  ids.cancelled = await createEvent("Remind cancelled", now + HOUR);
  await db.update(events).set({ state: "cancelled" }).where(eq(events.id, ids.cancelled));

  const task = await request(app)
    .post("/api/v1/staff-tasks")
    .set("Authorization", adminAuth)
    .send({ title: "Remind task", assigneeId: editor.id, dueAt: iso(now + 90 * 60_000), rawFilesUrl: "https://drive.example.com/raw" });
  expect(task.status).toBe(201);
  ids.task = ((task.body as Json).task as Json).id as string;
});

afterAll(async () => {
  await deleteStaffTasksFor([editor.id]);
  await deleteClientsOwnedBy([owner.id]);
  await deleteStageTemplates([templateId]);
  for (const u of [admin, owner, editor]) await deleteFixtureUser(u.id);
  await closeDb();
});

describe("reminders", () => {
  it("sends exactly one reminder for what is due within two hours, to the right person", async () => {
    await runner.runOnce();
    expect(await bellCount(owner.id, "event_reminder", "eventId", ids.soon)).toBe(1);
    expect(await bellCount(editor.id, "task_due_reminder", "taskId", ids.task)).toBe(1);
    const [soon] = await db.select({ at: events.remindedAt }).from(events).where(eq(events.id, ids.soon));
    expect(soon!.at).not.toBeNull();
    const msg = await db.execute(sql`select payload ->> 'title' as title from notifications where user_id = ${owner.id} and type = 'event_reminder'`);
    expect((msg.rows[0] as { title: string }).title).toMatch(/^Starts in (\d+ h )?\d+ min: Remind soon$|^Starts in 1 h: Remind soon$/);
  });

  it("counts unread reminders for the bell's alert animation", async () => {
    const res = await request(app).get("/api/v1/notifications/unread-count").set("Authorization", ownerAuth);
    expect(res.status).toBe(200);
    expect((res.body as { reminders: number }).reminders).toBeGreaterThanOrEqual(1);
  });

  it("never sends for later, already-started or cancelled events, and never twice", async () => {
    await runner.runOnce();
    expect(await bellCount(owner.id, "event_reminder", "eventId", ids.soon)).toBe(1);
    expect(await bellCount(editor.id, "task_due_reminder", "taskId", ids.task)).toBe(1);
    for (const key of ["later", "started", "cancelled"] as const) {
      expect(await bellCount(owner.id, "event_reminder", "eventId", ids[key]), key).toBe(0);
    }
  });

  it("reminds again when the start time moves", async () => {
    const detail = await request(app).get(`/api/v1/events/${ids.soon}`).set("Authorization", ownerAuth);
    const version = ((detail.body as Json).event as Json).version as number;
    const start = Date.now() + 100 * 60_000;
    const moved = await request(app)
      .patch(`/api/v1/events/${ids.soon}`)
      .set("Authorization", ownerAuth)
      .send({ startsAt: iso(start), endsAt: iso(start + HOUR), version });
    expect(moved.status).toBe(200);
    const [row] = await db.select({ at: events.remindedAt }).from(events).where(eq(events.id, ids.soon));
    expect(row!.at).toBeNull();
    await runner.runOnce();
    expect(await bellCount(owner.id, "event_reminder", "eventId", ids.soon)).toBe(2);
  });

  it("does not remind about a task once it is done", async () => {
    await db.update(staffTasks).set({ dueRemindedAt: null }).where(eq(staffTasks.id, ids.task));
    await db.update(staffTasks).set({ status: "done", completedAt: new Date() }).where(eq(staffTasks.id, ids.task));
    await runner.runOnce();
    expect(await bellCount(editor.id, "task_due_reminder", "taskId", ids.task)).toBe(1);
  });
});
