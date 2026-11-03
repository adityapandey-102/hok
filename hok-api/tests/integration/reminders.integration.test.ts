import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { eq, sql } from "drizzle-orm";
import { createApp } from "../../src/app";
import { db } from "../../src/common/database/drizzle-client";
import { events } from "../../src/modules/events/infrastructure/events.schema";
import { staffTasks } from "../../src/modules/staff-tasks/infrastructure/staff-tasks.schema";
import { todos } from "../../src/modules/todos/infrastructure/todos.schema";
import { profiles } from "../../src/modules/users/infrastructure/profile.schema";
import { createReminderRunner } from "../../src/modules/reminders/reminders.module";
import {
  bearerFor,
  closeDb,
  createFixtureUser,
  deleteClientsOwnedBy,
  deleteFixtureUser,
  deleteStaffTasksFor,
  deleteStageTemplates,
  createTaskTemplateFixture,
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

async function bellCount(userId: string, type: string, subjectKey: "eventId" | "taskId" | "todoId", subjectId: string): Promise<number> {
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

let taskTemplate: Awaited<ReturnType<typeof createTaskTemplateFixture>>;

beforeAll(async () => {
  taskTemplate = await createTaskTemplateFixture(["Brief received", "Cut", "Review"]);
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
    .send({ title: "Remind task", assigneeId: editor.id, templateId: taskTemplate.id, dueAt: iso(now + 90 * 60_000) });
  expect(task.status).toBe(201);
  ids.task = ((task.body as Json).task as Json).id as string;
});

afterAll(async () => {
  await deleteStaffTasksFor([editor.id]);
  await deleteClientsOwnedBy([owner.id]);
  await deleteStageTemplates([templateId, taskTemplate.id]);
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

/**
 * My to-dos (round 1): a to-do carries its own next moment. Due moments are
 * sent (to the owner only) and the to-do moves on to its next one; done
 * to-dos are never claimed; a moment missed by more than 30 minutes is
 * skipped silently but still advanced; a deactivated owner is never told.
 */
describe("to-do reminders", () => {
  const MIN = 60_000;
  let gone: FixtureUser;

  async function makeTodo(owner: FixtureUser, body: Json): Promise<string> {
    const res = await request(app).post("/api/v1/todos").set("Authorization", await bearerFor(owner)).send(body);
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    return ((res.body as Json).todo as Json).id as string;
  }
  async function nextRemind(id: string): Promise<Date | null> {
    const [row] = await db.select({ at: todos.nextRemindAt }).from(todos).where(eq(todos.id, id));
    return row!.at;
  }

  beforeAll(async () => {
    gone = await createFixtureUser("developer", "Remind Gone");
  });
  afterAll(async () => {
    await deleteFixtureUser(gone.id); // its to-dos cascade
  });

  it("an urgent to-do due in 50 minutes: the 1-hour reminder goes out and the next moment is the due time", async () => {
    const dueMs = Date.now() + 50 * MIN;
    const id = await makeTodo(editor, { title: "Remind urgent", dueAt: iso(dueMs), urgency: "urgent" });
    // Created 50 minutes before it is due, the first moment left is the due time itself.
    expect((await nextRemind(id))!.getTime()).toBe(dueMs);
    // The 1-hour moment passed 10 minutes ago (the runner was between checks).
    await db.update(todos).set({ nextRemindAt: new Date(dueMs - 60 * MIN) }).where(eq(todos.id, id));
    await runner.runOnce();
    expect(await bellCount(editor.id, "todo_reminder", "todoId", id)).toBe(1);
    expect((await nextRemind(id))!.getTime()).toBe(dueMs);
    const msg = await db.execute(sql`select payload ->> 'title' as title, payload ->> 'url' as url from notifications where user_id = ${editor.id} and type = 'todo_reminder' and payload -> 'data' ->> 'todoId' = ${id}`);
    expect(msg.rows[0]).toMatchObject({ url: "/app/todos" });
    expect((msg.rows[0] as { title: string }).title).toMatch(/^Due in \d+ min: Remind urgent$/);
    // Nobody else was told, and a second check sends nothing more.
    expect(await bellCount(owner.id, "todo_reminder", "todoId", id)).toBe(0);
    await runner.runOnce();
    expect(await bellCount(editor.id, "todo_reminder", "todoId", id)).toBe(1);
  });

  it("done to-dos are never claimed", async () => {
    const id = await makeTodo(editor, { title: "Remind done", dueAt: iso(Date.now() + 50 * MIN), urgency: "high" });
    const past = new Date(Date.now() - 5 * MIN);
    await db.update(todos).set({ doneAt: new Date(), nextRemindAt: past }).where(eq(todos.id, id));
    await runner.runOnce();
    expect(await bellCount(editor.id, "todo_reminder", "todoId", id)).toBe(0);
    expect((await nextRemind(id))!.getTime()).toBe(past.getTime());
  });

  it("a stale reminder (40 minutes old) is skipped silently and the to-do moves on", async () => {
    const dueMs = Date.now() + 20 * MIN;
    const id = await makeTodo(editor, { title: "Remind stale", dueAt: iso(dueMs), urgency: "high" });
    await db.update(todos).set({ nextRemindAt: new Date(Date.now() - 40 * MIN) }).where(eq(todos.id, id));
    await runner.runOnce();
    expect(await bellCount(editor.id, "todo_reminder", "todoId", id)).toBe(0);
    expect((await nextRemind(id))!.getTime()).toBe(dueMs);
  });

  it("a deactivated owner is never told, but the to-do still moves on", async () => {
    const dueMs = Date.now() + 20 * MIN;
    const id = await makeTodo(gone, { title: "Remind gone", dueAt: iso(dueMs), urgency: "high" });
    await db.update(profiles).set({ active: false }).where(eq(profiles.id, gone.id));
    await db.update(todos).set({ nextRemindAt: new Date(Date.now() - 5 * MIN) }).where(eq(todos.id, id));
    await runner.runOnce();
    expect(await bellCount(gone.id, "todo_reminder", "todoId", id)).toBe(0);
    expect((await nextRemind(id))!.getTime()).toBe(dueMs);
  });

  it("a medium to-do reminds once, at its due time, and then has no moment left", async () => {
    const dueMs = Date.now() + 5 * MIN;
    const id = await makeTodo(editor, { title: "Remind medium", dueAt: iso(dueMs), urgency: "medium" });
    expect((await nextRemind(id))!.getTime()).toBe(dueMs);
    // Time passes: the due time is now a minute ago.
    await db.update(todos).set({ dueAt: new Date(Date.now() - MIN), nextRemindAt: new Date(Date.now() - MIN) }).where(eq(todos.id, id));
    await runner.runOnce();
    expect(await bellCount(editor.id, "todo_reminder", "todoId", id)).toBe(1);
    expect(await nextRemind(id)).toBeNull();
  });
});
