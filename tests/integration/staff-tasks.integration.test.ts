import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { createApp } from "../../src/app";
import { db } from "../../src/common/database/drizzle-client";
import { staffTaskUpdates } from "../../src/modules/staff-tasks/infrastructure/staff-tasks.schema";
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
 * Staff tasks end to end (REQUIREMENTS §5.9): Admin-only management, the
 * assignee's row scope (others' tasks are 404), the editor brief rules, the
 * status flow with its append-only timeline written in the same transaction,
 * reopen, comments, reassign, client/event links, list filters and the
 * optimistic lock. Needs migrations 20261013000004 and 20261014200001.
 */
const app = createApp();
let admin: FixtureUser;
let editor: FixtureUser;
let developer: FixtureUser;
let smm: FixtureUser;
const auth: Record<string, string> = {};
const templateIds: string[] = [];
let clientA: string;
let clientB: string;
let eventA: string;
const DRIVE = "https://drive.google.com/drive/folders/it-raw";
const stamp = Date.now();

interface Update {
  kind: string;
  fromStatus: string | null;
  toStatus: string | null;
  comment: string | null;
  authorName: string | null;
  fromAssigneeName: string | null;
  toAssigneeName: string | null;
}
interface Task {
  id: string;
  title: string;
  status: string;
  version: number;
  assigneeId: string;
  assigneeRole: string;
  rawFilesUrl: string | null;
  referenceUrl: string | null;
  script: string | null;
  clientId: string | null;
  clientName: string | null;
  eventId: string | null;
  eventTitle: string | null;
  completedAt: string | null;
  assignedByName: string | null;
  updates: Update[];
}
type Body = Record<string, unknown>;

const as = (role: string, req: request.Test) => req.set("Authorization", auth[role]!);
const codeOf = (res: request.Response) => (res.body as { code?: string }).code;

async function createTask(body: Body): Promise<Task> {
  const res = await as("admin", request(app).post("/api/v1/staff-tasks")).send({ title: `IT task ${stamp}`, ...body });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return (res.body as { task: Task }).task;
}

async function editorTask(extra: Body = {}): Promise<Task> {
  return createTask({ assigneeId: editor.id, rawFilesUrl: DRIVE, ...extra });
}

beforeAll(async () => {
  admin = await createFixtureUser("admin", "IT Tasks Admin");
  editor = await createFixtureUser("editor", "IT Tasks Editor");
  developer = await createFixtureUser("developer", "IT Tasks Developer");
  smm = await createFixtureUser("social_media_manager", "IT Tasks SMM");
  for (const u of [admin, editor, developer, smm]) auth[u.role] = await bearerFor(u);

  const a = await as("social_media_manager", request(app).post("/api/v1/clients")).send({ businessName: `IT Tasks Client A ${stamp}` });
  const b = await as("social_media_manager", request(app).post("/api/v1/clients")).send({ businessName: `IT Tasks Client B ${stamp}` });
  clientA = (a.body as { client: { id: string } }).client.id;
  clientB = (b.body as { client: { id: string } }).client.id;

  const t = await as("admin", request(app).post("/api/v1/stage-templates")).send({ name: `IT Tasks Tpl ${stamp}`, stages: ["Plan", "Shoot"] });
  const templateId = (t.body as { template: { id: string } }).template.id;
  templateIds.push(templateId);
  const e = await as("social_media_manager", request(app).post("/api/v1/events")).send({
    clientId: clientA,
    templateId,
    title: `IT Tasks Shoot ${stamp}`,
    type: "shoot",
    startsAt: "2026-11-02T10:00:00Z",
    endsAt: "2026-11-02T12:00:00Z",
  });
  expect(e.status, JSON.stringify(e.body)).toBe(201);
  eventA = (e.body as { event: { id: string } }).event.id;
});

afterAll(async () => {
  const people = [admin, editor, developer, smm].filter(Boolean).map((u) => u.id);
  await deleteStaffTasksFor(people);
  await deleteClientsOwnedBy(people);
  await deleteStageTemplates(templateIds);
  for (const id of people) await deleteFixtureUser(id);
  await closeDb();
});

describe("create (Admin only) and the editor brief", () => {
  it("creates an editor task with a 'created' timeline entry", async () => {
    const task = await editorTask({ referenceUrl: "https://youtu.be/ref", script: "Hook in 3 seconds.", priority: "high" });
    expect(task).toMatchObject({ status: "todo", version: 1, assigneeRole: "editor", rawFilesUrl: DRIVE, script: "Hook in 3 seconds.", assignedByName: "IT Tasks Admin" });
    expect(task.updates).toEqual([expect.objectContaining({ kind: "created", toStatus: "todo", authorName: "IT Tasks Admin", toAssigneeName: "IT Tasks Editor" })]);
  });

  it("an editor task needs the raw files link; a non-editor task can't carry the brief", async () => {
    const missing = await as("admin", request(app).post("/api/v1/staff-tasks")).send({ title: "x", assigneeId: editor.id });
    expect([missing.status, codeOf(missing)]).toEqual([400, "STAFF_TASK_EDITOR_FIELDS_REQUIRED"]);
    const wrong = await as("admin", request(app).post("/api/v1/staff-tasks")).send({ title: "x", assigneeId: developer.id, script: "no" });
    expect([wrong.status, codeOf(wrong)]).toEqual([400, "STAFF_TASK_EDITOR_FIELDS_INVALID"]);
  });

  it("nobody but the Admin creates, edits, reopens or deletes (403)", async () => {
    const task = await createTask({ assigneeId: developer.id });
    for (const role of ["social_media_manager", "developer", "editor"]) {
      expect((await as(role, request(app).post("/api/v1/staff-tasks")).send({ title: "x", assigneeId: developer.id })).status).toBe(403);
      expect((await as(role, request(app).patch(`/api/v1/staff-tasks/${task.id}`)).send({ title: "x", version: 1 })).status).toBe(403);
      expect((await as(role, request(app).post(`/api/v1/staff-tasks/${task.id}/reopen`)).send({ version: 1 })).status).toBe(403);
      expect((await as(role, request(app).delete(`/api/v1/staff-tasks/${task.id}`))).status).toBe(403);
    }
  });
});

describe("row scope", () => {
  it("the assignee sees their task; anyone else gets 404 and never lists it", async () => {
    const task = await editorTask();
    expect((await as("editor", request(app).get(`/api/v1/staff-tasks/${task.id}`))).status).toBe(200);
    const other = await as("developer", request(app).get(`/api/v1/staff-tasks/${task.id}`));
    expect([other.status, codeOf(other)]).toEqual([404, "STAFF_TASK_NOT_FOUND"]);
    expect((await as("social_media_manager", request(app).get(`/api/v1/staff-tasks/${task.id}`))).status).toBe(404);

    // The developer's assigneeId filter is ignored: their list is their own tasks only.
    const list = await as("developer", request(app).get(`/api/v1/staff-tasks?assigneeId=${editor.id}&limit=100`));
    const tasks = (list.body as { tasks: { assigneeId: string }[] }).tasks;
    expect(tasks.every((t) => t.assigneeId === developer.id)).toBe(true);
  });

  it("a non-UUID id is a 404; a bad query is a 400", async () => {
    expect((await as("admin", request(app).get("/api/v1/staff-tasks/abc"))).status).toBe(404);
    expect((await as("admin", request(app).get("/api/v1/staff-tasks?status=doing"))).status).toBe(400);
  });
});

describe("status flow and timeline", () => {
  it("the assignee moves it to done with comments; each move is logged in the same transaction", async () => {
    const task = await editorTask();
    const step = (status: string, version: number, comment?: string) =>
      as("editor", request(app).post(`/api/v1/staff-tasks/${task.id}/status`)).send({ status, version, comment });

    expect((await step("in_progress", 1, "Starting the cut")).status).toBe(200);
    expect((await step("blocked", 2, "Need the music")).status).toBe(200);
    const done = await step("done", 3);
    expect(done.status).toBe(200);
    const t = (done.body as { task: Task }).task;
    expect(t).toMatchObject({ status: "done", version: 4 });
    expect(t.completedAt).not.toBeNull();
    expect(t.updates.map((u) => [u.kind, u.fromStatus, u.toStatus, u.comment])).toEqual([
      ["status", "blocked", "done", null],
      ["status", "in_progress", "blocked", "Need the music"],
      ["status", "todo", "in_progress", "Starting the cut"],
      ["created", null, "todo", null],
    ]);

    const stale = await step("todo", 1);
    expect([stale.status, codeOf(stale)]).toEqual([409, "STAFF_TASK_MODIFIED"]);
    const closed = await step("todo", 4);
    expect([closed.status, codeOf(closed)]).toEqual([409, "STAFF_TASK_DONE"]);
    const notMine = await as("developer", request(app).post(`/api/v1/staff-tasks/${task.id}/status`)).send({ status: "todo", version: 4 });
    expect(notMine.status).toBe(404);

    const reopened = await as("admin", request(app).post(`/api/v1/staff-tasks/${task.id}/reopen`)).send({ status: "in_progress", comment: "One more pass", version: 4 });
    expect(reopened.status).toBe(200);
    expect((reopened.body as { task: Task }).task).toMatchObject({ status: "in_progress", completedAt: null, version: 5 });
    expect((reopened.body as { task: Task }).task.updates[0]).toMatchObject({ kind: "reopened", fromStatus: "done", toStatus: "in_progress", comment: "One more pass" });
    const again = await as("admin", request(app).post(`/api/v1/staff-tasks/${task.id}/reopen`)).send({ version: 5 });
    expect([again.status, codeOf(again)]).toEqual([409, "STAFF_TASK_NOT_DONE"]);
  });

  it("the same status is 409 STAFF_TASK_STATUS_UNCHANGED", async () => {
    const task = await editorTask();
    const res = await as("editor", request(app).post(`/api/v1/staff-tasks/${task.id}/status`)).send({ status: "todo", version: 1 });
    expect([res.status, codeOf(res)]).toEqual([409, "STAFF_TASK_STATUS_UNCHANGED"]);
  });

  it("the Admin and the assignee comment at any time; comments don't bump the version", async () => {
    const task = await editorTask();
    expect((await as("editor", request(app).post(`/api/v1/staff-tasks/${task.id}/comments`)).send({ body: "First cut is up" })).status).toBe(201);
    const res = await as("admin", request(app).post(`/api/v1/staff-tasks/${task.id}/comments`)).send({ body: "Looks great" });
    expect(res.status).toBe(201);
    const t = (res.body as { task: Task }).task;
    expect(t.version).toBe(1);
    expect(t.updates.slice(0, 2).map((u) => [u.kind, u.comment, u.authorName])).toEqual([
      ["comment", "Looks great", "IT Tasks Admin"],
      ["comment", "First cut is up", "IT Tasks Editor"],
    ]);
    expect((await as("developer", request(app).post(`/api/v1/staff-tasks/${task.id}/comments`)).send({ body: "hi" })).status).toBe(404);
    expect((await as("editor", request(app).post(`/api/v1/staff-tasks/${task.id}/comments`)).send({ body: " " })).status).toBe(400);
  });
});

describe("edit and reassign (Admin)", () => {
  it("reassigning from the editor to a developer clears the brief and moves visibility", async () => {
    const task = await editorTask({ script: "x" });
    const res = await as("admin", request(app).patch(`/api/v1/staff-tasks/${task.id}`)).send({ assigneeId: developer.id, version: 1 });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const t = (res.body as { task: Task }).task;
    expect(t).toMatchObject({ assigneeId: developer.id, rawFilesUrl: null, script: null, version: 2 });
    expect(t.updates[0]).toMatchObject({ kind: "reassigned", fromAssigneeName: "IT Tasks Editor", toAssigneeName: "IT Tasks Developer" });
    expect((await as("editor", request(app).get(`/api/v1/staff-tasks/${task.id}`))).status).toBe(404);
    expect((await as("developer", request(app).get(`/api/v1/staff-tasks/${task.id}`))).status).toBe(200);

    const stale = await as("admin", request(app).patch(`/api/v1/staff-tasks/${task.id}`)).send({ title: "y", version: 1 });
    expect([stale.status, codeOf(stale)]).toEqual([409, "STAFF_TASK_MODIFIED"]);
    const back = await as("admin", request(app).patch(`/api/v1/staff-tasks/${task.id}`)).send({ assigneeId: editor.id, version: 2 });
    expect(codeOf(back)).toBe("STAFF_TASK_EDITOR_FIELDS_REQUIRED");
  });

  it("links a client and an event; a mismatch or unknown event is 400; a new client unlinks the event", async () => {
    const task = await createTask({ assigneeId: developer.id, clientId: clientA, eventId: eventA });
    expect(task).toMatchObject({ clientId: clientA, eventId: eventA, eventTitle: `IT Tasks Shoot ${stamp}` });
    expect(task.clientName).toBe(`IT Tasks Client A ${stamp}`);

    const mismatch = await as("admin", request(app).post("/api/v1/staff-tasks")).send({ title: "x", assigneeId: developer.id, clientId: clientB, eventId: eventA });
    expect(codeOf(mismatch)).toBe("STAFF_TASK_EVENT_INVALID");
    const unknown = await as("admin", request(app).post("/api/v1/staff-tasks")).send({ title: "x", assigneeId: developer.id, eventId: "00000000-0000-4000-8000-000000000000" });
    expect(codeOf(unknown)).toBe("STAFF_TASK_EVENT_INVALID");

    const moved = await as("admin", request(app).patch(`/api/v1/staff-tasks/${task.id}`)).send({ clientId: clientB, version: 1 });
    expect((moved.body as { task: Task }).task).toMatchObject({ clientId: clientB, eventId: null });
  });

  it("the Admin deletes a task; its timeline goes with it", async () => {
    const task = await createTask({ assigneeId: developer.id });
    expect((await as("admin", request(app).delete(`/api/v1/staff-tasks/${task.id}`))).status).toBe(204);
    expect((await as("admin", request(app).get(`/api/v1/staff-tasks/${task.id}`))).status).toBe(404);
    expect(await db.select().from(staffTaskUpdates).where(eq(staffTaskUpdates.taskId, task.id))).toEqual([]);
  });
});

describe("list filters", () => {
  it("overdue, role, priority, done order, and open-only", async () => {
    const overdue = await createTask({ assigneeId: developer.id, title: `IT overdue ${stamp}`, dueAt: "2020-01-01T00:00:00Z", priority: "urgent" });
    const future = await createTask({ assigneeId: developer.id, title: `IT future ${stamp}`, dueAt: "2099-01-01T00:00:00Z" });
    const list = async (q: string) =>
      ((await as("admin", request(app).get(`/api/v1/staff-tasks?search=${stamp}&limit=100&${q}`))).body as { tasks: { id: string; status: string; assigneeRole: string }[]; total: number });

    const od = await list("overdue=true");
    expect(od.tasks.map((t) => t.id)).toContain(overdue.id);
    expect(od.tasks.map((t) => t.id)).not.toContain(future.id);
    expect((await list("role=developer")).tasks.every((t) => t.assigneeRole === "developer")).toBe(true);
    expect((await list("priority=urgent")).tasks.map((t) => t.id)).toEqual([overdue.id]);

    await as("developer", request(app).post(`/api/v1/staff-tasks/${future.id}/status`)).send({ status: "done", version: 1 });
    expect((await list("open=true")).tasks.map((t) => t.id)).not.toContain(future.id);
    const doneList = await list("status=done");
    expect(doneList.tasks.every((t) => t.status === "done")).toBe(true);
    expect(doneList.total).toBe(doneList.tasks.length);
  });
});
