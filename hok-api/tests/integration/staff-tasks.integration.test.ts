import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { and, eq, sql } from "drizzle-orm";
import { createApp } from "../../src/app";
import { db } from "../../src/common/database/drizzle-client";
import { staffTaskLinks, staffTaskUpdates } from "../../src/modules/staff-tasks/infrastructure/staff-tasks.schema";
import { assets } from "../../src/modules/assets/infrastructure/assets.schema";
import {
  bearerFor,
  closeDb,
  createFixtureUser,
  createTaskTemplateFixture,
  deleteClientsOwnedBy,
  deleteFixtureUser,
  deleteStaffTasksFor,
  deleteStageTemplates,
  finishTask,
  type FixtureUser,
} from "./helpers";

/**
 * Staff tasks end to end (REQUIREMENTS §5.9): management by the Admin and,
 * down the role ladder, client managers (round 1), the row scope (assignee,
 * creator, a client manager's teams; others' tasks are 404). Round 2: task
 * templates (kind + roles), tasks that move through stages snapshotted from
 * a template, the status derived from the stage, blocking, the append-only
 * timeline written in the same transaction, reopen to a stage, links on every
 * task and "share with client" turning a delivered link into a client-visible
 * asset in one transaction. Needs migrations 20261013000004, 20261014200001 and
 * 20261103000001.
 */
const app = createApp();
let admin: FixtureUser;
let editor: FixtureUser;
let developer: FixtureUser;
let smm: FixtureUser;
let smm2: FixtureUser;
const auth: Record<string, string> = {};
const templateIds: string[] = [];
let clientA: string;
let clientB: string;
let clientC: string;
let eventA: string;
let eventAStageIds: string[];
let eventTemplateId: string;
/** Task templates: any role (3 stages), editors only (4 stages), and one that is switched off. */
let anyTpl: Awaited<ReturnType<typeof createTaskTemplateFixture>>;
let reelTpl: Awaited<ReturnType<typeof createTaskTemplateFixture>>;
let oldTpl: Awaited<ReturnType<typeof createTaskTemplateFixture>>;
const DRIVE = "https://drive.google.com/drive/folders/it-raw";
const stamp = Date.now();
const REEL_STAGES = ["Brief received", "Rough cut", "Review", "Final cut"];

interface Update {
  kind: string;
  fromStatus: string | null;
  toStatus: string | null;
  comment: string | null;
  authorName: string | null;
  fromAssigneeName: string | null;
  toAssigneeName: string | null;
  fromStageName: string | null;
  toStageName: string | null;
}
interface Stage {
  id: string;
  name: string;
  position: number;
}
interface Link {
  id: string;
  kind: string;
  url: string;
  label: string | null;
  stageId: string | null;
  stageName: string | null;
  addedById: string | null;
  addedByName: string | null;
  sharedAssetId: string | null;
}
interface Task {
  id: string;
  title: string;
  status: string;
  version: number;
  assigneeId: string;
  assigneeRole: string;
  brief: string | null;
  templateName: string;
  stageCount: number;
  currentStage: Stage;
  stages: Stage[];
  blockedReason: string | null;
  links: Link[];
  clientId: string | null;
  clientName: string | null;
  eventId: string | null;
  eventTitle: string | null;
  completedAt: string | null;
  assignedById: string | null;
  assignedByName: string | null;
  canManage: boolean;
  canShare: boolean;
  updates: Update[];
}
type Body = Record<string, unknown>;

const as = (role: string, req: request.Test) => req.set("Authorization", auth[role]!);
const codeOf = (res: request.Response) => (res.body as { code?: string }).code;
const taskOf = (res: request.Response) => (res.body as { task: Task }).task;
const outcome = (res: request.Response) => [res.status, codeOf(res)];

async function createTask(body: Body): Promise<Task> {
  const res = await as("admin", request(app).post("/api/v1/staff-tasks")).send({ title: `IT task ${stamp}`, templateId: anyTpl.id, ...body });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return taskOf(res);
}

/** An editor task on the editors-only template, with a brief and two brief links. */
async function editorTask(extra: Body = {}): Promise<Task> {
  return createTask({ assigneeId: editor.id, templateId: reelTpl.id, brief: "Hook in 3 seconds.", links: [{ url: DRIVE, label: "Raw files" }, { url: "https://youtu.be/ref" }], ...extra });
}

const getTask = async (role: string, id: string) => taskOf(await as(role, request(app).get(`/api/v1/staff-tasks/${id}`)));
const stagePost = (role: string, id: string, body: Body) => as(role, request(app).post(`/api/v1/staff-tasks/${id}/stage`)).send(body);

beforeAll(async () => {
  admin = await createFixtureUser("admin", "IT Tasks Admin");
  editor = await createFixtureUser("editor", "IT Tasks Editor");
  developer = await createFixtureUser("developer", "IT Tasks Developer");
  smm = await createFixtureUser("social_media_manager", "IT Tasks SMM");
  smm2 = await createFixtureUser("marketing_manager", "IT Tasks MM");
  for (const u of [admin, editor, developer, smm, smm2]) auth[u.role] = await bearerFor(u);

  anyTpl = await createTaskTemplateFixture(["To do", "In progress", "Done"]);
  reelTpl = await createTaskTemplateFixture(REEL_STAGES, ["editor"]);
  oldTpl = await createTaskTemplateFixture(["A", "B"]);
  templateIds.push(anyTpl.id, reelTpl.id, oldTpl.id);
  await db.execute(sql`update stage_templates set active = false where id = ${oldTpl.id}`);

  const a = await as("social_media_manager", request(app).post("/api/v1/clients")).send({ businessName: `IT Tasks Client A ${stamp}` });
  const b = await as("social_media_manager", request(app).post("/api/v1/clients")).send({ businessName: `IT Tasks Client B ${stamp}` });
  clientA = (a.body as { client: { id: string } }).client.id;
  clientB = (b.body as { client: { id: string } }).client.id;
  const c = await as("marketing_manager", request(app).post("/api/v1/clients")).send({ businessName: `IT Tasks Client C ${stamp}` });
  clientC = (c.body as { client: { id: string } }).client.id;

  const t = await as("admin", request(app).post("/api/v1/stage-templates")).send({ name: `IT Tasks Tpl ${stamp}`, stages: ["Plan", "Shoot"] });
  eventTemplateId = (t.body as { template: { id: string } }).template.id;
  templateIds.push(eventTemplateId);
  const e = await as("social_media_manager", request(app).post("/api/v1/events")).send({
    clientId: clientA,
    templateId: eventTemplateId,
    title: `IT Tasks Shoot ${stamp}`,
    type: "shoot",
    startsAt: "2026-11-02T10:00:00Z",
    endsAt: "2026-11-02T12:00:00Z",
  });
  expect(e.status, JSON.stringify(e.body)).toBe(201);
  const event = (e.body as { event: { id: string; stages: { id: string }[] } }).event;
  eventA = event.id;
  eventAStageIds = event.stages.map((s) => s.id);
});

afterAll(async () => {
  const people = [admin, editor, developer, smm, smm2].filter(Boolean).map((u) => u.id);
  await deleteStaffTasksFor(people);
  await deleteClientsOwnedBy(people);
  await deleteStageTemplates(templateIds);
  for (const id of people) await deleteFixtureUser(id);
  await closeDb();
});

describe("create (Admin and client managers), templates and the brief", () => {
  it("snapshots the template's stages; starts at stage 1 as todo; brief and brief links come along; a 'created' timeline entry", async () => {
    const task = await editorTask({ priority: "high" });
    expect(task).toMatchObject({
      status: "todo",
      version: 1,
      assigneeRole: "editor",
      brief: "Hook in 3 seconds.",
      templateName: reelTpl.name,
      stageCount: 4,
      currentStage: { name: "Brief received", position: 1 },
      blockedReason: null,
      assignedByName: "IT Tasks Admin",
    });
    expect(task.stages.map((s) => s.name)).toEqual(REEL_STAGES);
    expect(task.links.map((l) => [l.kind, l.label, l.url, l.addedByName])).toEqual([
      ["brief", "Raw files", DRIVE, "IT Tasks Admin"],
      ["brief", null, "https://youtu.be/ref", "IT Tasks Admin"],
    ]);
    expect(task.updates).toEqual([expect.objectContaining({ kind: "created", toStatus: "todo", authorName: "IT Tasks Admin", toAssigneeName: "IT Tasks Editor", toStageName: "Brief received" })]);
    // The old editor-only fields are gone from the response.
    for (const gone of ["rawFilesUrl", "referenceUrl", "referenceLinks", "script"]) expect(task).not.toHaveProperty(gone);
  });

  it("a template is required, and must be an active task template offered for the assignee's role (400)", async () => {
    const post = (body: Body) => as("admin", request(app).post("/api/v1/staff-tasks")).send({ title: "x", ...body });
    expect(outcome(await post({ assigneeId: editor.id }))).toEqual([400, "VALIDATION_ERROR"]);
    // Editors only: a developer can't get the reel template.
    expect(outcome(await post({ assigneeId: developer.id, templateId: reelTpl.id }))).toEqual([400, "STAFF_TASK_TEMPLATE_INVALID"]);
    expect(outcome(await post({ assigneeId: editor.id, templateId: oldTpl.id }))).toEqual([400, "STAFF_TASK_TEMPLATE_INVALID"]);
    expect(outcome(await post({ assigneeId: editor.id, templateId: eventTemplateId }))).toEqual([400, "STAFF_TASK_TEMPLATE_INVALID"]);
    expect(outcome(await post({ assigneeId: editor.id, templateId: "00000000-0000-4000-8000-000000000000" }))).toEqual([400, "STAFF_TASK_TEMPLATE_INVALID"]);
    // A template with no roles suits anyone.
    expect((await post({ assigneeId: developer.id, templateId: anyTpl.id })).status).toBe(201);
  });

  it("brief links are checked: http(s) only, at most 20", async () => {
    const post = (links: unknown) => as("admin", request(app).post("/api/v1/staff-tasks")).send({ title: "x", assigneeId: developer.id, templateId: anyTpl.id, links });
    expect((await post([{ url: "javascript:alert(1)" }])).status).toBe(400);
    expect((await post(Array.from({ length: 21 }, (_, i) => ({ url: `https://e.test/${i}` })))).status).toBe(400);
    expect((await post(Array.from({ length: 20 }, (_, i) => ({ url: `https://e.test/${i}` })))).status).toBe(201);
  });

  it("later template edits never reach a task made from it", async () => {
    const task = await editorTask();
    await db.execute(sql`update stage_template_stages set name = 'Renamed later' where template_id = ${reelTpl.id} and position = 1`);
    expect((await getTask("admin", task.id)).stages.map((s) => s.name)).toEqual(REEL_STAGES);
    await db.execute(sql`update stage_template_stages set name = ${REEL_STAGES[0]!} where template_id = ${reelTpl.id} and position = 1`);
  });

  it("task-only staff never create, edit, reopen or delete (403)", async () => {
    const task = await createTask({ assigneeId: developer.id });
    for (const role of ["developer", "editor"]) {
      expect((await as(role, request(app).post("/api/v1/staff-tasks")).send({ title: "x", assigneeId: developer.id, templateId: anyTpl.id })).status).toBe(403);
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

  it("list rows carry the template name, stage count, current stage and blocked reason", async () => {
    const task = await editorTask({ title: `IT row ${stamp}` });
    const rows = ((await as("admin", request(app).get(`/api/v1/staff-tasks?search=IT%20row%20${stamp}&limit=100`))).body as { tasks: Record<string, unknown>[] }).tasks;
    expect(rows.find((r) => r.id === task.id)).toMatchObject({
      templateName: reelTpl.name,
      stageCount: 4,
      currentStage: { name: "Brief received", position: 1 },
      blockedReason: null,
      status: "todo",
    });
  });
});

describe("stages: the status follows the stage, completion, blocking and reopen", () => {
  it("moves through the stages with comments; each move is logged in the same transaction", async () => {
    const task = await editorTask();
    const [s1, s2, , s4] = task.stages as [Stage, Stage, Stage, Stage];

    const first = await stagePost("editor", task.id, { stageId: s2.id, version: 1, comment: "Starting the cut" });
    expect(first.status, JSON.stringify(first.body)).toBe(200);
    expect(taskOf(first)).toMatchObject({ status: "in_progress", currentStage: { id: s2.id }, version: 2 });

    const blocked = await as("editor", request(app).post(`/api/v1/staff-tasks/${task.id}/block`)).send({ reason: "Need the music", version: 2 });
    expect(taskOf(blocked)).toMatchObject({ status: "blocked", blockedReason: "Need the music", currentStage: { id: s2.id }, version: 3 });
    const again = await as("editor", request(app).post(`/api/v1/staff-tasks/${task.id}/block`)).send({ reason: "still", version: 3 });
    expect(outcome(again)).toEqual([409, "STAFF_TASK_ALREADY_BLOCKED"]);

    const unblocked = await as("editor", request(app).post(`/api/v1/staff-tasks/${task.id}/unblock`)).send({ comment: "Music arrived", version: 3 });
    expect(taskOf(unblocked)).toMatchObject({ status: "in_progress", blockedReason: null, currentStage: { id: s2.id }, version: 4 });
    const notBlocked = await as("editor", request(app).post(`/api/v1/staff-tasks/${task.id}/unblock`)).send({ version: 4 });
    expect(outcome(notBlocked)).toEqual([409, "STAFF_TASK_NOT_BLOCKED"]);

    // Back to stage 1 is todo again; completing is only offered from the last stage.
    expect(taskOf(await stagePost("editor", task.id, { stageId: s1.id, version: 4 }))).toMatchObject({ status: "todo", version: 5 });
    expect(outcome(await stagePost("editor", task.id, { complete: true, version: 5 }))).toEqual([409, "STAFF_TASK_NOT_AT_LAST_STAGE"]);
    expect(outcome(await stagePost("editor", task.id, { stageId: s1.id, version: 5 }))).toEqual([409, "STAFF_TASK_STAGE_UNCHANGED"]);
    await stagePost("editor", task.id, { stageId: s4.id, version: 5 });
    const done = await stagePost("editor", task.id, { complete: true, comment: "Shipped", version: 6 });
    expect(done.status, JSON.stringify(done.body)).toBe(200);
    const t = taskOf(done);
    expect(t).toMatchObject({ status: "done", version: 7, currentStage: { id: s4.id } });
    expect(t.completedAt).not.toBeNull();
    expect(t.updates.map((u) => [u.kind, u.fromStageName, u.toStageName, u.comment])).toEqual([
      ["completed", "Final cut", null, "Shipped"],
      ["stage", "Brief received", "Final cut", null],
      ["stage", "Rough cut", "Brief received", null],
      ["unblocked", "Rough cut", null, "Music arrived"],
      ["blocked", "Rough cut", null, "Need the music"],
      ["stage", "Brief received", "Rough cut", "Starting the cut"],
      ["created", null, "Brief received", null],
    ]);

    // A done task is closed; a stale version is 409; someone else's task is 404.
    expect(outcome(await stagePost("editor", task.id, { stageId: s1.id, version: 7 }))).toEqual([409, "STAFF_TASK_DONE"]);
    expect(outcome(await stagePost("editor", task.id, { stageId: s1.id, version: 1 }))).toEqual([409, "STAFF_TASK_MODIFIED"]);
    expect((await stagePost("developer", task.id, { stageId: s1.id, version: 7 })).status).toBe(404);
  });

  it("the stage body is exactly one of stageId / complete; a stage of another task is 400", async () => {
    const task = await editorTask();
    const other = await editorTask();
    expect((await stagePost("editor", task.id, { version: 1 })).status).toBe(400);
    expect((await stagePost("editor", task.id, { stageId: task.stages[1]!.id, complete: true, version: 1 })).status).toBe(400);
    expect(outcome(await stagePost("editor", task.id, { stageId: other.stages[1]!.id, version: 1 }))).toEqual([400, "STAFF_TASK_STAGE_INVALID"]);
  });

  it("moving a blocked task clears the block; the reason is required (400)", async () => {
    const task = await editorTask();
    expect((await as("editor", request(app).post(`/api/v1/staff-tasks/${task.id}/block`)).send({ reason: "  ", version: 1 })).status).toBe(400);
    await as("editor", request(app).post(`/api/v1/staff-tasks/${task.id}/block`)).send({ reason: "Waiting", version: 1 });
    const moved = await stagePost("admin", task.id, { stageId: task.stages[2]!.id, version: 2 });
    expect(taskOf(moved)).toMatchObject({ status: "in_progress", blockedReason: null });
  });

  it("only the assignee or Admin blocks (the creator may unblock); a done task can't be blocked", async () => {
    const task = await createTask({ assigneeId: developer.id, clientId: clientA, title: `IT creator ${stamp}` });
    const byManager = await createTask({ assigneeId: developer.id }); // created by the Admin
    expect((await as("developer", request(app).post(`/api/v1/staff-tasks/${byManager.id}/block`)).send({ reason: "x", version: 1 })).status).toBe(200);
    // The Admin created it, so the Admin may lift it.
    expect((await as("admin", request(app).post(`/api/v1/staff-tasks/${byManager.id}/unblock`)).send({ version: 2 })).status).toBe(200);
    // A team manager who only sees the task can neither block nor unblock.
    expect(outcome(await as("social_media_manager", request(app).post(`/api/v1/staff-tasks/${task.id}/block`)).send({ reason: "x", version: 1 }))).toEqual([403, "STAFF_TASK_FORBIDDEN"]);
    expect(await finishTask(app, auth.developer!, task.id)).toBe(200);
    const done = await as("developer", request(app).post(`/api/v1/staff-tasks/${task.id}/block`)).send({ reason: "x", version: (await getTask("developer", task.id)).version });
    expect(outcome(done)).toEqual([409, "STAFF_TASK_DONE"]);
  });

  it("reopen: a done task goes back to the named stage (default the last), status from it, completion cleared", async () => {
    const task = await editorTask();
    expect(outcome(await as("admin", request(app).post(`/api/v1/staff-tasks/${task.id}/reopen`)).send({ version: 1 }))).toEqual([409, "STAFF_TASK_NOT_DONE"]);
    expect(await finishTask(app, auth.editor!, task.id)).toBe(200);
    const done = await getTask("admin", task.id);

    const bad = await as("admin", request(app).post(`/api/v1/staff-tasks/${task.id}/reopen`)).send({ stageId: "00000000-0000-4000-8000-000000000000", version: done.version });
    expect(outcome(bad)).toEqual([400, "STAFF_TASK_STAGE_INVALID"]);
    const reopened = await as("admin", request(app).post(`/api/v1/staff-tasks/${task.id}/reopen`)).send({ stageId: task.stages[1]!.id, comment: "One more pass", version: done.version });
    expect(reopened.status, JSON.stringify(reopened.body)).toBe(200);
    expect(taskOf(reopened)).toMatchObject({ status: "in_progress", completedAt: null, currentStage: { name: "Rough cut" } });
    expect(taskOf(reopened).updates[0]).toMatchObject({ kind: "reopened", fromStatus: "done", toStatus: "in_progress", toStageName: "Rough cut", comment: "One more pass" });

    // Done again, then reopened without a stage: the last one.
    expect(await finishTask(app, auth.editor!, task.id)).toBe(200);
    const again = await as("admin", request(app).post(`/api/v1/staff-tasks/${task.id}/reopen`)).send({ version: (await getTask("admin", task.id)).version });
    expect(taskOf(again)).toMatchObject({ status: "in_progress", currentStage: { name: "Final cut" } });
    // Reopening the first stage is todo.
    expect(await finishTask(app, auth.editor!, task.id)).toBe(200);
    const first = await as("admin", request(app).post(`/api/v1/staff-tasks/${task.id}/reopen`)).send({ stageId: task.stages[0]!.id, version: (await getTask("admin", task.id)).version });
    expect(taskOf(first)).toMatchObject({ status: "todo", currentStage: { position: 1 } });
  });

  it("the old status endpoint is gone (404)", async () => {
    const task = await editorTask();
    for (const role of ["admin", "editor", "developer", "social_media_manager"]) {
      expect((await as(role, request(app).post(`/api/v1/staff-tasks/${task.id}/status`)).send({ status: "done", version: 1 })).status, role).toBe(404);
    }
  });

  it("the Admin and the assignee comment at any time; comments don't bump the version", async () => {
    const task = await editorTask();
    expect((await as("editor", request(app).post(`/api/v1/staff-tasks/${task.id}/comments`)).send({ body: "First cut is up" })).status).toBe(201);
    const res = await as("admin", request(app).post(`/api/v1/staff-tasks/${task.id}/comments`)).send({ body: "Looks great" });
    expect(res.status).toBe(201);
    const t = taskOf(res);
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
  it("reassigning from the editor to a developer keeps the stages and moves visibility; the brief is editable", async () => {
    const task = await editorTask();
    const res = await as("admin", request(app).patch(`/api/v1/staff-tasks/${task.id}`)).send({ assigneeId: developer.id, brief: "New script", version: 1 });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const t = taskOf(res);
    expect(t).toMatchObject({ assigneeId: developer.id, brief: "New script", version: 2, templateName: reelTpl.name, stageCount: 4 });
    expect(t.links).toHaveLength(2);
    expect(t.updates[0]).toMatchObject({ kind: "reassigned", fromAssigneeName: "IT Tasks Editor", toAssigneeName: "IT Tasks Developer" });
    expect((await as("editor", request(app).get(`/api/v1/staff-tasks/${task.id}`))).status).toBe(404);
    expect((await as("developer", request(app).get(`/api/v1/staff-tasks/${task.id}`))).status).toBe(200);

    const stale = await as("admin", request(app).patch(`/api/v1/staff-tasks/${task.id}`)).send({ title: "y", version: 1 });
    expect([stale.status, codeOf(stale)]).toEqual([409, "STAFF_TASK_MODIFIED"]);
    const back = await as("admin", request(app).patch(`/api/v1/staff-tasks/${task.id}`)).send({ assigneeId: editor.id, version: 2 });
    expect(back.status, JSON.stringify(back.body)).toBe(200);
  });

  it("the template can't be changed (400), nor the status", async () => {
    const task = await editorTask();
    expect((await as("admin", request(app).patch(`/api/v1/staff-tasks/${task.id}`)).send({ templateId: anyTpl.id, version: 1 })).status).toBe(400);
    expect((await as("admin", request(app).patch(`/api/v1/staff-tasks/${task.id}`)).send({ status: "done", version: 1 })).status).toBe(400);
  });

  it("links a client and an event; a mismatch or unknown event is 400; a new client unlinks the event", async () => {
    const task = await createTask({ assigneeId: developer.id, clientId: clientA, eventId: eventA });
    expect(task).toMatchObject({ clientId: clientA, eventId: eventA, eventTitle: `IT Tasks Shoot ${stamp}` });
    expect(task.clientName).toBe(`IT Tasks Client A ${stamp}`);

    const mismatch = await as("admin", request(app).post("/api/v1/staff-tasks")).send({ title: "x", assigneeId: developer.id, templateId: anyTpl.id, clientId: clientB, eventId: eventA });
    expect(codeOf(mismatch)).toBe("STAFF_TASK_EVENT_INVALID");
    const unknown = await as("admin", request(app).post("/api/v1/staff-tasks")).send({ title: "x", assigneeId: developer.id, templateId: anyTpl.id, eventId: "00000000-0000-4000-8000-000000000000" });
    expect(codeOf(unknown)).toBe("STAFF_TASK_EVENT_INVALID");

    const moved = await as("admin", request(app).patch(`/api/v1/staff-tasks/${task.id}`)).send({ clientId: clientB, version: 1 });
    expect(taskOf(moved)).toMatchObject({ clientId: clientB, eventId: null });
  });

  it("the Admin deletes a task; its stages, links and timeline go with it", async () => {
    const task = await editorTask();
    expect((await as("admin", request(app).delete(`/api/v1/staff-tasks/${task.id}`))).status).toBe(204);
    expect((await as("admin", request(app).get(`/api/v1/staff-tasks/${task.id}`))).status).toBe(404);
    expect(await db.select().from(staffTaskUpdates).where(eq(staffTaskUpdates.taskId, task.id))).toEqual([]);
    const left = await db.execute(sql`select (select count(*) from task_stages where task_id = ${task.id}) as stages, (select count(*) from staff_task_links where task_id = ${task.id}) as links`);
    expect(left.rows[0]).toMatchObject({ stages: "0", links: "0" });
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

    expect(await finishTask(app, auth.developer!, future.id)).toBe(200);
    expect((await list("open=true")).tasks.map((t) => t.id)).not.toContain(future.id);
    const doneList = await list("status=done");
    expect(doneList.tasks.every((t) => t.status === "done")).toBe(true);
    expect(doneList.total).toBe(doneList.tasks.length);
    // A blocked task is found by status=blocked.
    await as("developer", request(app).post(`/api/v1/staff-tasks/${overdue.id}/block`)).send({ reason: "x", version: 1 });
    expect((await list("status=blocked")).tasks.map((t) => t.id)).toEqual([overdue.id]);
  });
});

describe("round 1: the role ladder, the creator's rights and the team's view", () => {
  const post = (role: string, body: Body) => as(role, request(app).post("/api/v1/staff-tasks")).send({ title: `IT ladder ${stamp}`, templateId: anyTpl.id, ...body });
  const get = (role: string, id: string) => as(role, request(app).get(`/api/v1/staff-tasks/${id}`));
  const detail = (res: request.Response) => (res.body as { task: Task }).task;

  it("a manager creates a task for a task-only person and is its creator; it comes back with canManage", async () => {
    const res = await post("social_media_manager", { assigneeId: developer.id, clientId: clientA, eventId: eventA });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(detail(res)).toMatchObject({ assignedById: smm.id, assignedByName: "IT Tasks SMM", canManage: true, clientId: clientA });
    // The Admin sees it too, and can manage it; the assignee cannot.
    expect(detail(await get("admin", detail(res).id))).toMatchObject({ canManage: true });
    expect(detail(await get("developer", detail(res).id))).toMatchObject({ canManage: false, assignedById: smm.id });
  });

  it("the ladder: managers assign sideways and to themselves (2026-11-20); nobody assigns to the Admin", async () => {
    for (const [role, assignee] of [
      ["social_media_manager", smm2.id],
      ["social_media_manager", smm.id],
    ] as const) {
      const res = await post(role, { assigneeId: assignee });
      expect(res.status, `${role} -> ${assignee}: ${JSON.stringify(res.body)}`).toBe(201);
      expect(detail(res)).toMatchObject({ assigneeId: assignee, assignedById: smm.id });
    }
    for (const [role, assignee] of [
      ["social_media_manager", admin.id],
      ["admin", admin.id],
    ] as const) {
      const res = await post(role, { assigneeId: assignee });
      expect([res.status, codeOf(res)], `${role} -> ${assignee}`).toEqual([400, "STAFF_TASK_ASSIGNEE_NOT_ALLOWED"]);
    }
    // The Admin may pick a manager.
    expect((await post("admin", { assigneeId: smm2.id })).status).toBe(201);
  });

  it("a manager links only their own clients (and those clients' events); another team's client is 400 STAFF_TASK_CLIENT_INVALID", async () => {
    const foreign = await post("social_media_manager", { assigneeId: developer.id, clientId: clientC });
    expect([foreign.status, codeOf(foreign)]).toEqual([400, "STAFF_TASK_CLIENT_INVALID"]);
    const unknown = await post("social_media_manager", { assigneeId: developer.id, clientId: "00000000-0000-4000-8000-000000000000" });
    expect([unknown.status, codeOf(unknown)]).toEqual([400, "STAFF_TASK_CLIENT_INVALID"]);
    // The Admin links any client.
    expect((await post("admin", { assigneeId: developer.id, clientId: clientC })).status).toBe(201);
  });

  it("the creator edits, reassigns (never to the Admin), reopens and deletes their own task", async () => {
    const task = detail(await post("social_media_manager", { assigneeId: developer.id }));
    const up = await as("social_media_manager", request(app).patch(`/api/v1/staff-tasks/${task.id}`)).send({ assigneeId: admin.id, version: 1 });
    expect([up.status, codeOf(up)]).toEqual([400, "STAFF_TASK_ASSIGNEE_NOT_ALLOWED"]);
    const moved = await as("social_media_manager", request(app).patch(`/api/v1/staff-tasks/${task.id}`)).send({ assigneeId: editor.id, title: "Renamed", version: 1 });
    expect(moved.status, JSON.stringify(moved.body)).toBe(200);
    expect(detail(moved)).toMatchObject({ assigneeId: editor.id, title: "Renamed" });
    expect(await finishTask(app, auth.editor!, task.id)).toBe(200);
    const reopened = await as("social_media_manager", request(app).post(`/api/v1/staff-tasks/${task.id}/reopen`)).send({ version: (await getTask("admin", task.id)).version });
    expect(reopened.status, JSON.stringify(reopened.body)).toBe(200);
    expect((await as("social_media_manager", request(app).delete(`/api/v1/staff-tasks/${task.id}`))).status).toBe(204);
  });

  it("a team manager who is neither creator nor assignee sees the task read-only: every write is 403 STAFF_TASK_FORBIDDEN", async () => {
    const task = await createTask({ assigneeId: developer.id, clientId: clientA });
    const seen = await get("social_media_manager", task.id);
    expect(seen.status).toBe(200);
    expect(detail(seen)).toMatchObject({ canManage: false, assignedByName: "IT Tasks Admin" });
    const stageId = task.stages[1]!.id;
    const attempts = [
      as("social_media_manager", request(app).patch(`/api/v1/staff-tasks/${task.id}`)).send({ title: "x", version: 1 }),
      as("social_media_manager", request(app).post(`/api/v1/staff-tasks/${task.id}/reopen`)).send({ version: 1 }),
      as("social_media_manager", request(app).delete(`/api/v1/staff-tasks/${task.id}`)),
      as("social_media_manager", request(app).post(`/api/v1/staff-tasks/${task.id}/stage`)).send({ stageId, version: 1 }),
      as("social_media_manager", request(app).post(`/api/v1/staff-tasks/${task.id}/block`)).send({ reason: "x", version: 1 }),
      as("social_media_manager", request(app).post(`/api/v1/staff-tasks/${task.id}/unblock`)).send({ version: 1 }),
      as("social_media_manager", request(app).post(`/api/v1/staff-tasks/${task.id}/links`)).send({ kind: "brief", url: DRIVE }),
      as("social_media_manager", request(app).post(`/api/v1/staff-tasks/${task.id}/comments`)).send({ body: "hello" }),
    ];
    for (const res of await Promise.all(attempts)) expect([res.status, codeOf(res)]).toEqual([403, "STAFF_TASK_FORBIDDEN"]);
  });

  it("a manager off the team gets 404 on read and write; a task without a client is not visible to a team manager", async () => {
    const onTeam = await createTask({ assigneeId: developer.id, clientId: clientA });
    const noClient = await createTask({ assigneeId: developer.id });
    expect((await get("social_media_manager", noClient.id)).status).toBe(404);
    for (const id of [onTeam.id, noClient.id]) {
      const off = await get("marketing_manager", id);
      expect([off.status, codeOf(off)]).toEqual([404, "STAFF_TASK_NOT_FOUND"]);
      const write = await as("marketing_manager", request(app).patch(`/api/v1/staff-tasks/${id}`)).send({ title: "x", version: 1 });
      expect([write.status, codeOf(write)]).toEqual([404, "STAFF_TASK_NOT_FOUND"]);
      const stage = await as("marketing_manager", request(app).post(`/api/v1/staff-tasks/${id}/stage`)).send({ complete: true, version: 1 });
      expect([stage.status, codeOf(stage)]).toEqual([404, "STAFF_TASK_NOT_FOUND"]);
    }
  });

  it("list: the scope is assigned + created + team; relation narrows it; the team filter is for managers", async () => {
    const mine = detail(await post("social_media_manager", { assigneeId: developer.id }));
    const team = await createTask({ assigneeId: developer.id, clientId: clientA });
    const unrelated = await createTask({ assigneeId: developer.id, clientId: clientC });
    const ids = async (role: string, q: string) =>
      ((await as(role, request(app).get(`/api/v1/staff-tasks?search=${stamp}&limit=100&${q}`))).body as { tasks: { id: string }[] }).tasks.map((t) => t.id);

    const all = await ids("social_media_manager", "");
    expect(all).toEqual(expect.arrayContaining([mine.id, team.id]));
    expect(all).not.toContain(unrelated.id);
    expect(await ids("social_media_manager", "relation=created")).toContain(mine.id);
    expect(await ids("social_media_manager", "relation=created")).not.toContain(team.id);
    expect(await ids("social_media_manager", "relation=team")).toContain(team.id);
    // (Other tests in this file give the SMM tasks of their own, e.g. a self-assigned one, so check only these.)
    const assignedToSmm = await ids("social_media_manager", "relation=assigned");
    expect(assignedToSmm).not.toContain(mine.id);
    expect(assignedToSmm).not.toContain(team.id);
    // Task-only staff: their own, and the team filter is refused.
    expect(await ids("developer", "relation=assigned")).toEqual(expect.arrayContaining([mine.id, team.id]));
    expect((await as("developer", request(app).get("/api/v1/staff-tasks?relation=team"))).status).toBe(400);
    // The role / client filters are open to everyone, still inside their scope.
    expect(await ids("social_media_manager", `clientId=${clientA}`)).toEqual(expect.arrayContaining([team.id]));
    expect(await ids("social_media_manager", `clientId=${clientC}`)).toEqual([]);
    // The Admin sees everything.
    expect(await ids("admin", "")).toEqual(expect.arrayContaining([mine.id, team.id, unrelated.id]));
  });

  it("the creator (a manager) is told when the assignee moves their task, with the stage in the message", async () => {
    const task = detail(await post("social_media_manager", { assigneeId: developer.id }));
    expect((await stagePost("developer", task.id, { stageId: task.stages[1]!.id, version: 1 })).status).toBe(200);
    const bell = await as("social_media_manager", request(app).get("/api/v1/notifications?limit=50"));
    const rows = (bell.body as { notifications: { type: string; title: string; data: Record<string, string> }[] }).notifications;
    const told = rows.find((n) => n.type === "task_status_changed" && n.data.taskId === task.id);
    expect(told).toBeDefined();
    expect(told!.title).toBe(`Moved IT ladder ${stamp} to In progress`);
    expect(told!.data).toMatchObject({ action: "stage", stageName: "In progress" });
  });

  it("GET /team-members?assignable=true lists only the roles the caller may assign to", async () => {
    const roles = async (role: string) =>
      ((await as(role, request(app).get(`/api/v1/team-members?assignable=true&search=IT%20Tasks&limit=100`))).body as { members: { fullName: string; role: string }[] }).members.map((m) => m.role);
    const forSmm = await roles("social_media_manager");
    expect(forSmm.length).toBeGreaterThan(0);
    // Managers may assign sideways (2026-11-20): other managers and task-only staff, never the Admin.
    expect(forSmm).toEqual(expect.arrayContaining(["social_media_manager", "marketing_manager", "editor", "developer"]));
    expect(forSmm).not.toContain("admin");
    const forAdmin = await roles("admin");
    expect(forAdmin).toEqual(expect.arrayContaining(["social_media_manager", "marketing_manager", "editor", "developer"]));
    expect(forAdmin).not.toContain("admin");
    expect((await as("developer", request(app).get("/api/v1/team-members?assignable=true"))).status).toBe(403);
  });
});

describe("round 2: stage templates, kinds and roles", () => {
  const post = (body: Body) => as("admin", request(app).post("/api/v1/stage-templates")).send(body);
  const list = (role: string, q: string) => as(role, request(app).get(`/api/v1/stage-templates?${q}`));
  const names = (res: request.Response) => (res.body as { templates: { name: string }[] }).templates.map((t) => t.name);

  it("a task template carries its roles; an event template can't (400); neither can 'admin'", async () => {
    const ok = await post({ name: `IT Tpl Task ${stamp}`, stages: ["Draft", "Review"], kind: "task", roles: ["editor", "content_writer", "editor"] });
    expect(ok.status, JSON.stringify(ok.body)).toBe(201);
    const t = (ok.body as { template: { id: string; kind: string; roles: string[]; version: number } }).template;
    templateIds.push(t.id);
    expect(t).toMatchObject({ kind: "task", roles: ["editor", "content_writer"] });

    const event = await post({ name: `IT Tpl Event ${stamp}`, stages: ["A"], roles: ["editor"] });
    expect(outcome(event)).toEqual([400, "STAGE_TEMPLATE_ROLES_INVALID"]);
    const admins = await post({ name: `IT Tpl Admin ${stamp}`, stages: ["A"], kind: "task", roles: ["admin"] });
    expect(outcome(admins)).toEqual([400, "STAGE_TEMPLATE_ROLES_INVALID"]);
    const unknown = await post({ name: `IT Tpl Unknown ${stamp}`, stages: ["A"], kind: "task", roles: ["boss"] });
    expect(unknown.status).toBe(400);
    // kind defaults to event; names are unique across both kinds.
    const plain = await post({ name: `IT Tpl Plain ${stamp}`, stages: ["A"] });
    expect(plain.status).toBe(201);
    templateIds.push((plain.body as { template: { id: string } }).template.id);
    expect((plain.body as { template: { kind: string; roles: string[] } }).template).toMatchObject({ kind: "event", roles: [] });
    expect(outcome(await post({ name: `it tpl task ${stamp}`, stages: ["A"], kind: "task" }))).toEqual([409, "STAGE_TEMPLATE_NAME_TAKEN"]);

    // Roles can be changed; the kind never.
    const patched = await as("admin", request(app).patch(`/api/v1/stage-templates/${t.id}`)).send({ roles: [], version: t.version });
    expect((patched.body as { template: { roles: string[] } }).template.roles).toEqual([]);
    const kind = await as("admin", request(app).patch(`/api/v1/stage-templates/${t.id}`)).send({ kind: "event", version: t.version + 1 });
    expect(outcome(kind)).toEqual([400, "VALIDATION_ERROR"]);
    const rolesOnEvent = await as("admin", request(app).patch(`/api/v1/stage-templates/${(plain.body as { template: { id: string } }).template.id}`)).send({ roles: ["editor"], version: 1 });
    expect(outcome(rolesOnEvent)).toEqual([400, "STAGE_TEMPLATE_ROLES_INVALID"]);
  });

  it("managers read ACTIVE task templates for the picker (kind=task, role=...); task-only staff get 403; management stays Admin-only", async () => {
    const forEditor = await list("social_media_manager", "kind=task&role=editor&limit=100");
    expect(forEditor.status).toBe(200);
    expect(names(forEditor)).toEqual(expect.arrayContaining([reelTpl.name, anyTpl.name]));
    expect(names(forEditor)).not.toContain(oldTpl.name); // inactive
    const forDeveloper = await list("social_media_manager", "kind=task&role=developer&limit=100");
    expect(names(forDeveloper)).toContain(anyTpl.name);
    expect(names(forDeveloper)).not.toContain(reelTpl.name);
    // kind=event never returns task templates, kind=task never event templates.
    expect(names(await list("social_media_manager", "kind=event&limit=100"))).not.toContain(reelTpl.name);
    expect(names(await list("social_media_manager", "kind=event&limit=100"))).toContain(`IT Tasks Tpl ${stamp}`);
    expect(names(await list("social_media_manager", "kind=task&limit=100"))).not.toContain(`IT Tasks Tpl ${stamp}`);
    // The Admin sees inactive ones too.
    expect(names(await list("admin", "kind=task&active=false&limit=100"))).toContain(oldTpl.name);
    expect((await list("developer", "kind=task")).status).toBe(403);
    expect((await list("editor", "")).status).toBe(403);
    expect((await list("social_media_manager", "kind=bogus")).status).toBe(400);
    expect((await as("social_media_manager", request(app).post("/api/v1/stage-templates")).send({ name: "x", stages: ["A"], kind: "task" })).status).toBe(403);
    expect((await as("social_media_manager", request(app).patch(`/api/v1/stage-templates/${reelTpl.id}`)).send({ active: false, version: 1 })).status).toBe(403);
  });

  it("events refuse a task template (400 EVENT_TEMPLATE_INVALID)", async () => {
    const res = await as("social_media_manager", request(app).post("/api/v1/events")).send({
      clientId: clientA,
      templateId: reelTpl.id,
      title: "x",
      type: "shoot",
      startsAt: "2026-12-02T10:00:00Z",
      endsAt: "2026-12-02T12:00:00Z",
    });
    expect(outcome(res)).toEqual([400, "EVENT_TEMPLATE_INVALID"]);
  });
});

describe("round 2: links on a task", () => {
  const link = (role: string, id: string, body: Body) => as(role, request(app).post(`/api/v1/staff-tasks/${id}/links`)).send(body);

  it("brief links: the creator or Admin; delivered links: the assignee or Admin; each is listed oldest first with names", async () => {
    const task = await createTask({ assigneeId: developer.id, clientId: clientA, title: `IT links ${stamp}` });
    const byManager = await createTask({ assigneeId: editor.id, templateId: reelTpl.id, clientId: clientA });
    // The Admin created `task`; its assignee adds delivered work, the Admin a brief link.
    expect((await link("admin", task.id, { kind: "brief", url: DRIVE, label: "Inputs" })).status).toBe(201);
    expect(outcome(await link("developer", task.id, { kind: "brief", url: DRIVE }))).toEqual([403, "STAFF_TASK_FORBIDDEN"]);
    const delivered = await link("developer", task.id, { kind: "delivered", url: "https://example.test/final", label: "Final", stageId: task.stages[1]!.id });
    expect(delivered.status, JSON.stringify(delivered.body)).toBe(201);
    expect(taskOf(delivered).links.map((l) => [l.kind, l.label, l.stageName, l.addedByName, l.sharedAssetId])).toEqual([
      ["brief", "Inputs", null, "IT Tasks Admin", null],
      ["delivered", "Final", "In progress", "IT Tasks Developer", null],
    ]);
    // A creator (the manager) can't add delivered work; the assignee can't add brief links.
    const mine = taskOf(await as("social_media_manager", request(app).post("/api/v1/staff-tasks")).send({ title: "x", assigneeId: editor.id, templateId: reelTpl.id }));
    expect(outcome(await link("social_media_manager", mine.id, { kind: "delivered", url: DRIVE }))).toEqual([403, "STAFF_TASK_FORBIDDEN"]);
    expect((await link("social_media_manager", mine.id, { kind: "brief", url: DRIVE })).status).toBe(201);
    expect(outcome(await link("editor", mine.id, { kind: "brief", url: DRIVE }))).toEqual([403, "STAFF_TASK_FORBIDDEN"]);
    // Strangers get 404 before any role rule.
    expect(outcome(await link("developer", byManager.id, { kind: "delivered", url: DRIVE }))).toEqual([404, "STAFF_TASK_NOT_FOUND"]);
  });

  it("validates the link: http(s) only, a stage of this task, at most 50 per task", async () => {
    const task = await createTask({ assigneeId: developer.id, title: `IT link rules ${stamp}` });
    const other = await createTask({ assigneeId: developer.id });
    expect((await link("developer", task.id, { kind: "delivered", url: "javascript:alert(1)" })).status).toBe(400);
    expect((await link("developer", task.id, { kind: "delivered", url: "ftp://x.test/a" })).status).toBe(400);
    expect(outcome(await link("developer", task.id, { kind: "delivered", url: DRIVE, stageId: other.stages[0]!.id }))).toEqual([400, "STAFF_TASK_STAGE_INVALID"]);
    expect((await link("developer", task.id, { kind: "other", url: DRIVE })).status).toBe(400);
    for (let i = 0; i < 50; i++) await db.execute(sql`insert into staff_task_links (task_id, kind, url) values (${task.id}, 'brief', ${`https://example.test/${i}`})`);
    expect(outcome(await link("developer", task.id, { kind: "delivered", url: DRIVE }))).toEqual([409, "STAFF_TASK_LINKS_LIMIT"]);
  });

  it("removing: whoever added it, or whoever manages the task; links are audited without the URL", async () => {
    const task = await createTask({ assigneeId: editor.id, templateId: reelTpl.id });
    const brief = taskOf(await link("admin", task.id, { kind: "brief", url: DRIVE })).links[0]!;
    const delivered = taskOf(await link("editor", task.id, { kind: "delivered", url: "https://example.test/cut" })).links[1]!;
    const del = (role: string, linkId: string) => as(role, request(app).delete(`/api/v1/staff-tasks/${task.id}/links/${linkId}`));
    expect(outcome(await del("editor", brief.id))).toEqual([403, "STAFF_TASK_FORBIDDEN"]);
    expect(outcome(await del("developer", brief.id))).toEqual([404, "STAFF_TASK_NOT_FOUND"]);
    expect((await del("editor", delivered.id)).status).toBe(200);
    expect(outcome(await del("editor", delivered.id))).toEqual([404, "STAFF_TASK_LINK_NOT_FOUND"]);
    const removed = await del("admin", brief.id);
    expect(removed.status).toBe(200);
    expect(taskOf(removed).links).toEqual([]);
    const audit = await db.execute(sql`select action, metadata from audit_log where entity_id = ${task.id} and action like 'staff_task.link_%' order by created_at`);
    expect(audit.rows.map((r) => (r as { action: string }).action)).toEqual(["staff_task.link_added", "staff_task.link_added", "staff_task.link_removed", "staff_task.link_removed"]);
    expect(JSON.stringify(audit.rows)).not.toContain("example.test");
  });
});

describe("round 2: share a delivered link with the client", () => {
  const link = (role: string, id: string, body: Body) => as(role, request(app).post(`/api/v1/staff-tasks/${id}/links`)).send(body);
  const share = (role: string, id: string, linkId: string, body: Body = {}) => as(role, request(app).post(`/api/v1/staff-tasks/${id}/links/${linkId}/share`)).send(body);

  /** A reel task created by the SMM (on clientA's team) for the editor, linked to eventA, with one delivered and one brief link. */
  async function deliveredTask(extra: Body = {}) {
    const created = await as("social_media_manager", request(app).post("/api/v1/staff-tasks")).send({
      title: `IT share ${stamp}`,
      assigneeId: editor.id,
      templateId: reelTpl.id,
      clientId: clientA,
      eventId: eventA,
      ...extra,
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const task = taskOf(created);
    await link("social_media_manager", task.id, { kind: "brief", url: DRIVE, label: "Inputs" });
    const withLink = taskOf(await link("editor", task.id, { kind: "delivered", url: "https://example.test/final-cut", label: "Final cut v2" }));
    return { task: withLink, delivered: withLink.links.find((l) => l.kind === "delivered")!, brief: withLink.links.find((l) => l.kind === "brief")! };
  }

  it("the creator-manager on the team shares it: an asset the client can see + the link marked, in one go; canShare tells the web", async () => {
    const { task, delivered } = await deliveredTask();
    expect(task.canShare).toBe(false); // the editor (assignee) can't share
    expect((await getTask("social_media_manager", task.id)).canShare).toBe(true);
    expect((await getTask("admin", task.id)).canShare).toBe(true);

    const res = await share("social_media_manager", task.id, delivered.id, { stageId: eventAStageIds[1] });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    const { assetId } = res.body as { assetId: string };
    expect(taskOf(res).links.find((l) => l.id === delivered.id)?.sharedAssetId).toBe(assetId);

    const asset = await as("social_media_manager", request(app).get(`/api/v1/assets/${assetId}`));
    expect(asset.status).toBe(200);
    expect((asset.body as { asset: Record<string, unknown> }).asset).toMatchObject({
      clientId: clientA,
      eventId: eventA,
      title: "Final cut v2",
      url: "https://example.test/final-cut",
      type: "other",
      visibleToClient: true,
      eventStageId: eventAStageIds[1],
      eventStageName: "Shoot",
    });
    const visible = await as("social_media_manager", request(app).get(`/api/v1/assets?clientId=${clientA}&visibleToClient=true&limit=100`));
    expect((visible.body as { assets: { id: string }[] }).assets.map((a) => a.id)).toContain(assetId);
    const audit = await db.execute(sql`select action from audit_log where (entity_id = ${assetId} or entity_id = ${task.id}) and action in ('asset.created', 'staff_task.link_shared') order by action`);
    expect(audit.rows.map((r) => (r as { action: string }).action)).toEqual(["asset.created", "staff_task.link_shared"]);

    // Sharing twice is 409.
    expect(outcome(await share("social_media_manager", task.id, delivered.id))).toEqual([409, "STAFF_TASK_LINK_ALREADY_SHARED"]);
  });

  it("the portal then shows it under the event (and nothing internal)", async () => {
    const { task, delivered } = await deliveredTask();
    const { assetId } = (await share("admin", task.id, delivered.id, { title: "Hero reel" })).body as { assetId: string };
    const token = ((await as("social_media_manager", request(app).post(`/api/v1/portal-links/${clientA}`))).body as { token: string }).token;
    const page = await request(app).get(`/api/v1/portal/${token}/events/${eventA}`);
    expect(page.status).toBe(200);
    const shared = (page.body as { event: { assets: Record<string, unknown>[] } }).event.assets;
    const mine = shared.find((a) => a.id === assetId);
    expect(mine).toMatchObject({ title: "Hero reel", url: "https://example.test/final-cut", type: "other", stageName: null });
    expect(Object.keys(mine!).sort()).toEqual(["createdAt", "id", "stageName", "stagePosition", "title", "type", "url"]);
  });

  it("two people sharing at once make exactly one asset (the link is locked)", async () => {
    const { task, delivered } = await deliveredTask();
    const [a, b] = await Promise.all([share("social_media_manager", task.id, delivered.id), share("admin", task.id, delivered.id)]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const linked = await db.execute(sql`select count(*)::int as n from staff_task_links where shared_asset_id is not null and task_id = ${task.id}`);
    expect((linked.rows[0] as { n: number }).n).toBe(1);
    const [row] = await db.select({ id: staffTaskLinks.sharedAssetId }).from(staffTaskLinks).where(and(eq(staffTaskLinks.taskId, task.id), eq(staffTaskLinks.kind, "delivered")));
    expect(row).toBeDefined();
    const made = await db.select({ id: assets.id }).from(assets).where(and(eq(assets.eventId, eventA), eq(assets.id, row!.id!)));
    expect(made).toHaveLength(1);
  });

  it("refuses: the assignee (403), an off-team manager (404), a brief link (404), a missing link (404), a task with no event (409), a stage of another event (400)", async () => {
    const { task, delivered, brief } = await deliveredTask();
    expect(outcome(await share("editor", task.id, delivered.id))).toEqual([403, "STAFF_TASK_FORBIDDEN"]);
    expect(outcome(await share("marketing_manager", task.id, delivered.id))).toEqual([404, "STAFF_TASK_NOT_FOUND"]);
    expect(outcome(await share("social_media_manager", task.id, brief.id))).toEqual([404, "STAFF_TASK_LINK_NOT_FOUND"]);
    expect(outcome(await share("social_media_manager", task.id, "00000000-0000-4000-8000-000000000000"))).toEqual([404, "STAFF_TASK_LINK_NOT_FOUND"]);
    expect(outcome(await share("social_media_manager", task.id, delivered.id, { stageId: "00000000-0000-4000-8000-000000000000" }))).toEqual([400, "ASSET_STAGE_INVALID"]);

    const noEvent = await createTask({ assigneeId: editor.id, templateId: reelTpl.id });
    const noEventLink = taskOf(await link("editor", noEvent.id, { kind: "delivered", url: DRIVE })).links[0]!;
    expect(outcome(await share("admin", noEvent.id, noEventLink.id))).toEqual([409, "STAFF_TASK_NO_EVENT"]);
    expect((await getTask("admin", noEvent.id)).canShare).toBe(false);
  });
});

