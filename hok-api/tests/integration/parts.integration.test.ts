import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { sql } from "drizzle-orm";
import { createApp } from "../../src/app";
import { db } from "../../src/common/database/drizzle-client";
import { bearerFor, closeDb, createFixtureUser, deleteClientsOwnedBy, deleteFixtureUser, deleteStaffTasksFor, deleteStageTemplates, type FixtureUser } from "./helpers";

/**
 * Round 4: parent and child work (parts). A stage with unfinished parts blocks the parent from passing or jumping it (STAGE_CHILDREN_OPEN),
 * the same gate as round 3's approvals. Runs against the real local stack, no mocks.
 *
 * Notification rule under test: stage_children_finished is "at least once" -- one notification when the last open part of a stage finishes;
 * two parts finishing at the very same moment may each see "no open parts left" and notify twice, never zero (the "concurrent" test).
 */
const app = createApp();
const stamp = Date.now();
let admin: FixtureUser, smm: FixtureUser, mm: FixtureUser, smm2: FixtureUser, editor: FixtureUser;
const auth: Record<string, string> = {};
const templateIds: string[] = [];
let clientA: string, clientB: string;
let eventTpl: string, taskTpl: string;

interface Stage {
  id: string;
  name: string;
  openChildren: number;
}
interface Child {
  kind: string;
  id: string;
  title: string;
  stageName: string;
  currentStageName: string;
  currentPosition: number;
  stageCount: number;
  state: string | null;
  status: string | null;
  finished: boolean;
  assigneeName: string | null;
}
/** The parts of an event or task detail that these tests read. */
interface Item {
  id: string;
  version: number;
  clientId: string | null;
  eventId: string | null;
  stages: [Stage, Stage, Stage]; // every template in this file has 3 stages
  parent: { kind: string; id: string; title: string; stageId: string; stageName: string } | null;
  children: Child[];
  hiddenChildren: number;
  nextBlockedBy: { stageId: string; stageName: string; reason: string; openChildren: number } | null;
}
interface Body {
  code?: string;
  event: Item;
  task: Item;
  template: { id: string };
  client: { id: string };
  approval: { id: string; version: number };
}
interface Res {
  status: number;
  body: Body;
}
interface Chain extends PromiseLike<Res> {
  send(body: object): Chain;
}
/** A supertest request with the caller's token, typed so the response bodies are not `any`. */
const as = (role: string, req: request.Test) => req.set("Authorization", auth[role]!) as unknown as Chain;
const code = (res: Res) => res.body.code;
const out = (res: Res) => [res.status, code(res)];

async function makeTemplate(kind: "event" | "task", stages: unknown[]) {
  const res = await as("admin", request(app).post("/api/v1/stage-templates")).send({ name: `IT Parts ${kind} ${stamp}-${templateIds.length}`, kind, stages });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  templateIds.push(res.body.template.id);
  return res.body.template.id;
}
const newEvent = async (role: string, extra: Record<string, unknown> = {}, client = clientA, title = `IT Parts event ${stamp}`) =>
  as(role, request(app).post("/api/v1/events")).send({ clientId: client, templateId: eventTpl, title, type: "shoot", startsAt: "2031-03-02T10:00:00Z", endsAt: "2031-03-02T12:00:00Z", ...extra });
const getEvent = async (role: string, id: string) => (await as(role, request(app).get(`/api/v1/events/${id}`))).body.event;
const getTask = async (role: string, id: string) => (await as(role, request(app).get(`/api/v1/staff-tasks/${id}`))).body.task;
async function moveEvent(role: string, id: string, position: number) {
  const e = await getEvent("admin", id);
  return as(role, request(app).post(`/api/v1/events/${id}/stage`)).send({ stageId: e.stages[position - 1]!.id, version: e.version });
}
async function moveTask(role: string, id: string, position: number | "complete") {
  const t = await getTask("admin", id);
  const body = position === "complete" ? { complete: true, version: t.version } : { stageId: t.stages[position - 1]!.id, version: t.version };
  return as(role, request(app).post(`/api/v1/staff-tasks/${id}/stage`)).send(body);
}
const newTask = (role: string, extra: Record<string, unknown> = {}) => as(role, request(app).post("/api/v1/staff-tasks")).send({ title: `IT Parts task ${stamp}`, templateId: taskTpl, assigneeId: editor.id, ...extra });
const notifCount = async (type: string, needle: string) => {
  const r = await db.execute(sql`select count(*)::int as n from notifications where type = ${type} and payload::text like ${"%" + needle + "%"}`);
  return (r.rows[0] as { n: number }).n;
};

beforeAll(async () => {
  admin = await createFixtureUser("admin", "IT Parts Admin");
  smm = await createFixtureUser("social_media_manager", "IT Parts SMM");
  mm = await createFixtureUser("marketing_manager", "IT Parts MM");
  smm2 = await createFixtureUser("social_media_manager", "IT Parts SMM Two");
  editor = await createFixtureUser("editor", "IT Parts Editor");
  for (const [k, u] of [["admin", admin], ["smm", smm], ["mm", mm], ["smm2", smm2], ["editor", editor]] as [string, FixtureUser][]) auth[k] = await bearerFor(u);
  const mk = async (r: string, name: string) => {
    const res = await as(r, request(app).post("/api/v1/clients")).send({ businessName: `${name} ${stamp}` });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    return res.body.client.id;
  };
  clientA = await mk("smm", "IT Parts A");
  clientB = await mk("smm2", "IT Parts B");
  const team = await as("admin", request(app).put(`/api/v1/clients/${clientA}/team`)).send({ leadId: smm.id, memberIds: [mm.id] });
  expect(team.status).toBe(200);
  eventTpl = await makeTemplate("event", ["Plan", "Production", "Delivery"]);
  taskTpl = await makeTemplate("task", ["Brief", "Cut", "Review"]);
});

afterAll(async () => {
  const people = [admin, smm, mm, smm2, editor].filter(Boolean).map((u) => u.id);
  await deleteStaffTasksFor(people);
  await deleteClientsOwnedBy(people);
  await deleteStageTemplates(templateIds);
  for (const id of people) await deleteFixtureUser(id);
  await closeDb();
});

describe("the 10 reels example (3 parts)", () => {
  let parent: Item;
  const kids: string[] = [];

  it("creates 3 child events under stage 2 and the parent can't pass it", async () => {
    const created = await newEvent("smm", {}, clientA, `Brand X reels ${stamp}`);
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    parent = created.body.event;
    expect(parent.parent).toBeNull();
    expect(parent.children).toEqual([]);
    expect(parent.hiddenChildren).toBe(0);
    expect(parent.stages.map((s) => s.openChildren)).toEqual([0, 0, 0]);
    expect((await moveEvent("smm", parent.id, 2)).status).toBe(200);
    parent = await getEvent("smm", parent.id);
    for (let i = 1; i <= 3; i++) {
      const res = await newEvent("smm", { parent: { kind: "event", id: parent.id, stageId: parent.stages[1].id } }, clientA, `Reel ${i} ${stamp}`);
      expect(res.status, JSON.stringify(res.body)).toBe(201);
      kids.push(res.body.event.id);
      expect(res.body.event.parent).toMatchObject({ kind: "event", id: parent.id, stageId: parent.stages[1].id, stageName: "Production" });
    }
    parent = await getEvent("smm", parent.id);
    expect(parent.stages.map((s) => s.openChildren)).toEqual([0, 3, 0]);
    expect(parent.children).toHaveLength(3);
    expect(parent.children[0]).toMatchObject({ kind: "event", stageName: "Production", currentStageName: "Plan", currentPosition: 1, stageCount: 3, state: "active", finished: false, status: null });
    expect(parent.nextBlockedBy).toMatchObject({ stageName: "Production", reason: "children", openChildren: 3 });
    expect(out(await moveEvent("smm", parent.id, 3))).toEqual([409, "STAGE_CHILDREN_OPEN"]);
    expect(out(await moveEvent("admin", parent.id, 3))).toEqual([409, "STAGE_CHILDREN_OPEN"]);
  });

  it("a jump over the stage is refused too", async () => {
    expect((await moveEvent("smm", parent.id, 1)).status).toBe(200);
    expect(out(await moveEvent("smm", parent.id, 3))).toEqual([409, "STAGE_CHILDREN_OPEN"]);
    expect((await moveEvent("smm", parent.id, 2)).status).toBe(200);
  });

  it("finishing parts unblocks it, and the notification fires once when the last one finishes", async () => {
    for (const id of kids.slice(0, 2)) expect((await moveEvent("smm", id, 3)).status).toBe(200);
    expect(out(await moveEvent("smm", parent.id, 3))).toEqual([409, "STAGE_CHILDREN_OPEN"]);
    expect(await notifCount("stage_children_finished", parent.id)).toBe(0);
    expect((await moveEvent("smm", kids[2]!, 3)).status).toBe(200);
    expect(await notifCount("stage_children_finished", parent.id)).toBe(1); // mm; the actor (smm) is skipped
    const done = await getEvent("smm", parent.id);
    expect(done.nextBlockedBy).toBeNull();
    expect(done.children.every((c) => c.finished)).toBe(true);
    expect((await moveEvent("smm", parent.id, 3)).status).toBe(200);
  });
});

describe("cancelled, postponed, hidden and deep", () => {
  it("a cancelled part doesn't block, a postponed one does", async () => {
    const p = (await newEvent("smm", {}, clientA, `P ${stamp}`)).body.event;
    const stage = p.stages[0].id;
    const a = (await newEvent("smm", { parent: { kind: "event", id: p.id, stageId: stage } }, clientA, "A")).body.event;
    const b = (await newEvent("smm", { parent: { kind: "event", id: p.id, stageId: stage } }, clientA, "B")).body.event;
    expect(out(await moveEvent("smm", p.id, 2))).toEqual([409, "STAGE_CHILDREN_OPEN"]);
    const cancel = async (e: Item, state: string) => as("smm", request(app).patch(`/api/v1/events/${e.id}`)).send({ state, version: (await getEvent("admin", e.id)).version });
    expect((await cancel(a, "cancelled")).status).toBe(200);
    expect((await getEvent("smm", p.id)).stages[0].openChildren).toBe(1);
    expect((await cancel(b, "postponed")).status).toBe(200);
    expect((await getEvent("smm", p.id)).stages[0].openChildren).toBe(1); // postponed still blocks
    expect(out(await moveEvent("smm", p.id, 2))).toEqual([409, "STAGE_CHILDREN_OPEN"]);
    expect(await notifCount("stage_children_finished", p.id)).toBe(0);
    expect((await cancel(b, "cancelled")).status).toBe(200);
    expect(await notifCount("stage_children_finished", p.id)).toBe(1); // cancelling the last open one clears the stage
    expect((await moveEvent("smm", p.id, 2)).status).toBe(200);
    // Child of a cancelled / postponed parent is refused.
    const q = (await newEvent("smm", {}, clientA, `Q ${stamp}`)).body.event;
    await as("smm", request(app).patch(`/api/v1/events/${q.id}`)).send({ state: "cancelled", version: q.version });
    expect(out(await newEvent("smm", { parent: { kind: "event", id: q.id, stageId: q.stages[0].id } }))).toEqual([409, "EVENT_NOT_ACTIVE"]);
  });

  it("the gate counts hidden children and the detail never describes them", async () => {
    const p = (await newEvent("smm", {}, clientA, `H ${stamp}`)).body.event;
    // The Admin makes a task part of the event on SMM2's client: SMM can't see it.
    const hidden = await newTask("admin", { title: `Secret part ${stamp}`, clientId: clientB, parent: { kind: "event", id: p.id, stageId: p.stages[0].id } });
    expect(hidden.status, JSON.stringify(hidden.body)).toBe(201);
    const view = await getEvent("smm", p.id);
    expect(view.children).toEqual([]);
    expect(view.hiddenChildren).toBe(1);
    expect(JSON.stringify(view)).not.toContain("Secret part");
    expect(view.stages[0].openChildren).toBe(1); // counted
    expect(out(await moveEvent("smm", p.id, 2))).toEqual([409, "STAGE_CHILDREN_OPEN"]);
    expect((await getEvent("admin", p.id)).children).toHaveLength(1);
    // The hidden part sees a parent it can't see as null.
    const asSmm2 = await getTask("smm2", hidden.body.task.id).catch(() => null);
    expect(asSmm2).not.toBeNull();
    expect(asSmm2!.parent).toBeNull();
    expect((await getTask("admin", hidden.body.task.id)).parent).toMatchObject({ kind: "event", id: p.id });
  });

  it("3 levels at most", async () => {
    const e1 = (await newEvent("smm", {}, clientA, `L1 ${stamp}`)).body.event;
    const e2 = (await newEvent("smm", { parent: { kind: "event", id: e1.id, stageId: e1.stages[0].id } }, clientA, "L2")).body.event;
    const e3 = (await newEvent("smm", { parent: { kind: "event", id: e2.id, stageId: e2.stages[0].id } }, clientA, "L3")).body.event;
    expect(out(await newEvent("smm", { parent: { kind: "event", id: e3.id, stageId: e3.stages[0].id } }))).toEqual([409, "WORK_TOO_DEEP"]);
    expect(out(await newTask("admin", { parent: { kind: "event", id: e3.id, stageId: e3.stages[0].id } }))).toEqual([409, "WORK_TOO_DEEP"]);
  });

  it("refusals: unseen parent 404, other client 400, wrong stage 400", async () => {
    const p = (await newEvent("smm", {}, clientA, `R ${stamp}`)).body.event;
    const parent = { kind: "event", id: p.id, stageId: p.stages[0].id };
    expect(out(await newEvent("smm2", { parent }, clientB))).toEqual([404, "EVENT_NOT_FOUND"]);
    expect(out(await newEvent("smm", { parent }, clientB))).toEqual([400, "WORK_CHILD_CLIENT_MISMATCH"]);
    expect(out(await newEvent("smm", { parent: { ...parent, stageId: "2f71448d-d7d2-4367-a22e-9de10f990cd6" } }))).toEqual([400, "WORK_PARENT_STAGE_INVALID"]);
    expect((await newEvent("mm", { parent })).status).toBe(201); // a manager on the team may
  });
});

describe("task parents", () => {
  it("a child task blocks the parent task until the editor completes it; the parent's people are told", async () => {
    const t = await newTask("smm", { clientId: clientA });
    expect(t.status, JSON.stringify(t.body)).toBe(201);
    const parent = t.body.task;
    expect((await moveTask("editor", parent.id, 2)).status).toBe(200);
    const parentNow = await getTask("editor", parent.id);
    const child = await newTask("smm", { title: `Child task ${stamp}`, parent: { kind: "task", id: parent.id, stageId: parentNow.stages[1].id } });
    expect(child.status, JSON.stringify(child.body)).toBe(201);
    expect(child.body.task.parent).toMatchObject({ kind: "task", id: parent.id, stageName: "Cut" });
    const view = await getTask("editor", parent.id);
    expect(view.stages[1].openChildren).toBe(1);
    expect(view.children[0]).toMatchObject({ kind: "task", status: "todo", finished: false, assigneeName: "IT Parts Editor" });
    expect(out(await moveTask("editor", parent.id, 3))).toEqual([409, "STAGE_CHILDREN_OPEN"]);
    // The editor finishes the child.
    expect((await moveTask("editor", child.body.task.id, 3)).status).toBe(200);
    expect((await moveTask("editor", child.body.task.id, "complete")).status).toBe(200);
    expect(await notifCount("stage_children_finished", parent.id)).toBe(1); // the creator (smm) hears; the actor (editor) is skipped
    expect((await moveTask("editor", parent.id, 3)).status).toBe(200);
  });

  it("a child event of a task without a client is 400; a done parent is 409", async () => {
    const t = (await newTask("smm", {})).body.task;
    expect(out(await newEvent("smm", { parent: { kind: "task", id: t.id, stageId: t.stages[0].id } }))).toEqual([400, "WORK_CHILD_EVENT_NEEDS_CLIENT"]);
  });

  it("deleting a parent task leaves its children as top-level items; deleting an open child clears the stage", async () => {
    const t = (await newTask("smm", { clientId: clientA })).body.task;
    const ev = await newEvent("smm", { parent: { kind: "task", id: t.id, stageId: t.stages[0].id } });
    expect(ev.status, JSON.stringify(ev.body)).toBe(201);
    const del = await as("smm", request(app).delete(`/api/v1/staff-tasks/${t.id}`));
    expect(del.status).toBe(204);
    const orphan = await getEvent("smm", ev.body.event.id);
    expect(orphan.parent).toBeNull();

    const t2 = (await newTask("smm", { clientId: clientA })).body.task;
    const c2 = (await newTask("smm", { title: "to delete", parent: { kind: "task", id: t2.id, stageId: t2.stages[0].id } })).body.task;
    expect((await getTask("smm", t2.id)).stages[0].openChildren).toBe(1);
    expect((await as("smm", request(app).delete(`/api/v1/staff-tasks/${c2.id}`))).status).toBe(204);
    expect((await getTask("smm", t2.id)).stages[0].openChildren).toBe(0);
    expect(await notifCount("stage_children_finished", t2.id)).toBe(1);
  });

  it("the ladder still applies, and a team manager who only sees the parent task gets 403", async () => {
    const t = (await newTask("smm", { clientId: clientA })).body.task;
    const parent = { kind: "task", id: t.id, stageId: t.stages[0].id };
    expect(out(await newTask("smm", { assigneeId: admin.id, parent }))).toEqual([400, "STAFF_TASK_ASSIGNEE_NOT_ALLOWED"]);
    expect(out(await newTask("mm", { parent }))).toEqual([403, "STAFF_TASK_FORBIDDEN"]);
    expect(out(await newTask("smm2", { parent }))).toEqual([404, "STAFF_TASK_NOT_FOUND"]);
    expect((await newTask("admin", { parent })).status).toBe(201);
  });
});

describe("approval at the end of a part", () => {
  it("a part whose last stage needs approval is unfinished until it is approved", async () => {
    const gated = await makeTemplate("event", ["Edit", { name: "Sign-off", approvers: ["team_managers"] }]);
    const p = (await newEvent("smm", {}, clientA, `G ${stamp}`)).body.event;
    const kid = (await as("smm", request(app).post("/api/v1/events")).send({ clientId: clientA, templateId: gated, title: `Gated part ${stamp}`, type: "shoot", startsAt: "2031-03-02T10:00:00Z", endsAt: "2031-03-02T12:00:00Z", parent: { kind: "event", id: p.id, stageId: p.stages[0].id } })).body.event;
    expect((await moveEvent("smm", kid.id, 2)).status).toBe(200);
    expect((await getEvent("smm", p.id)).stages[0].openChildren).toBe(1);
    const req = await as("smm", request(app).post("/api/v1/approvals")).send({ subject: "event", subjectId: kid.id });
    expect(req.status, JSON.stringify(req.body)).toBe(201);
    const dec = await as("mm", request(app).post(`/api/v1/approvals/${req.body.approval.id}/decision`)).send({ decision: "approve", version: req.body.approval.version });
    expect(dec.status, JSON.stringify(dec.body)).toBe(200);
    expect((await getEvent("smm", p.id)).stages[0].openChildren).toBe(0);
    expect(await notifCount("stage_children_finished", p.id)).toBe(1);
  });
});

describe("both reasons at once: the approval comes first", () => {
  it("an event stage with an open part AND a missing approval says STAGE_APPROVAL_REQUIRED, then STAGE_CHILDREN_OPEN", async () => {
    const gated = await makeTemplate("event", ["Plan", { name: "Review", approvers: ["team_managers"] }, "Delivery"]);
    const p = (await newEvent("smm", { templateId: gated }, clientA, `Both ${stamp}`)).body.event;
    expect((await moveEvent("smm", p.id, 2)).status).toBe(200);
    const kid = await newEvent("smm", { parent: { kind: "event", id: p.id, stageId: p.stages[1].id } }, clientA, `Both part ${stamp}`);
    expect(kid.status, JSON.stringify(kid.body)).toBe(201);
    const open = await getEvent("smm", p.id);
    expect(open.nextBlockedBy).toMatchObject({ stageName: "Review", openChildren: 1 });
    expect(out(await moveEvent("smm", p.id, 3))).toEqual([409, "STAGE_APPROVAL_REQUIRED"]);
    const ask = await as("smm", request(app).post("/api/v1/approvals")).send({ subject: "event", subjectId: p.id });
    expect(ask.status, JSON.stringify(ask.body)).toBe(201);
    expect((await as("mm", request(app).post(`/api/v1/approvals/${ask.body.approval.id}/decision`)).send({ decision: "approve", version: ask.body.approval.version })).status).toBe(200);
    // Approved, but the part is still open.
    const afterApproval = await getEvent("smm", p.id);
    expect(afterApproval.nextBlockedBy).toMatchObject({ stageName: "Review", reason: "children", openChildren: 1 });
    expect(out(await moveEvent("smm", p.id, 3))).toEqual([409, "STAGE_CHILDREN_OPEN"]);
    // The part reaches its last stage (the default template has 3 stages), the way is clear.
    expect((await moveEvent("smm", kid.body.event.id, 3)).status).toBe(200);
    expect((await moveEvent("smm", p.id, 3)).status).toBe(200);
  });

  it("a task stage: the approval first, then the open part", async () => {
    const gated = await makeTemplate("task", ["Brief", { name: "Review", approvers: ["admin"] }, "Ship"]);
    const t = (await newTask("smm", { templateId: gated, clientId: clientA })).body.task;
    expect((await moveTask("editor", t.id, 2)).status).toBe(200);
    const kid = await newTask("smm", { title: `Both task part ${stamp}`, parent: { kind: "task", id: t.id, stageId: t.stages[1].id } });
    expect(kid.status, JSON.stringify(kid.body)).toBe(201);
    expect(out(await moveTask("editor", t.id, 3))).toEqual([409, "STAGE_APPROVAL_REQUIRED"]);
    const ask = await as("editor", request(app).post("/api/v1/approvals")).send({ subject: "task", subjectId: t.id });
    expect(ask.status, JSON.stringify(ask.body)).toBe(201);
    expect((await as("admin", request(app).post(`/api/v1/approvals/${ask.body.approval.id}/decision`)).send({ decision: "approve", version: ask.body.approval.version })).status).toBe(200);
    expect(out(await moveTask("editor", t.id, 3))).toEqual([409, "STAGE_CHILDREN_OPEN"]);
    expect((await moveTask("editor", kid.body.task.id, 3)).status).toBe(200);
    expect((await moveTask("editor", kid.body.task.id, "complete")).status).toBe(200);
    expect((await moveTask("editor", t.id, 3)).status).toBe(200);
  });
});

describe("more refusals and defaults", () => {
  it("a task part of an event defaults to the event's client and links to the event", async () => {
    const p = (await newEvent("smm", {}, clientA, `Def ${stamp}`)).body.event;
    const res = await newTask("smm", { title: `Default part ${stamp}`, parent: { kind: "event", id: p.id, stageId: p.stages[0].id } });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.task.clientId).toBe(clientA);
    expect(res.body.task.eventId).toBe(p.id);
    const view = await getEvent("smm", p.id);
    expect(view.children[0]).toMatchObject({ kind: "task", title: `Default part ${stamp}`, status: "todo", finished: false, assigneeName: "IT Parts Editor" });
  });

  it("an event part of a task takes the task's client; its detail names the parent", async () => {
    const t = (await newTask("smm", { clientId: clientA, title: `Task parent ${stamp}` })).body.task;
    const ev = await newEvent("smm", { parent: { kind: "task", id: t.id, stageId: t.stages[0].id } }, clientA, `Event part ${stamp}`);
    expect(ev.status, JSON.stringify(ev.body)).toBe(201);
    expect(ev.body.event.clientId).toBe(clientA);
    expect((await getEvent("smm", ev.body.event.id)).parent).toMatchObject({ kind: "task", id: t.id, title: `Task parent ${stamp}`, stageId: t.stages[0].id });
    expect(out(await newEvent("smm", { parent: { kind: "task", id: t.id, stageId: t.stages[0].id } }, clientB))).toEqual([400, "WORK_CHILD_CLIENT_MISMATCH"]);
  });

  it("someone who can move the parent but may not assign tasks can't add a task part; a done task parent takes no parts", async () => {
    const t = (await newTask("smm", { clientId: clientA })).body.task;
    const parent = { kind: "task", id: t.id, stageId: t.stages[0].id };
    expect((await newTask("editor", { parent })).status).toBe(403); // the assignee moves it but may not create tasks
    expect((await moveTask("editor", t.id, 3)).status).toBe(200);
    expect((await moveTask("editor", t.id, "complete")).status).toBe(200);
    expect(out(await newTask("smm", { parent }))).toEqual([409, "STAFF_TASK_DONE"]);
    expect(out(await newEvent("smm", { parent }, clientA))).toEqual([409, "STAFF_TASK_DONE"]);
  });

  it("an archived client takes no new parts", async () => {
    const res = await as("smm", request(app).post("/api/v1/clients")).send({ businessName: `IT Parts Archived ${stamp}` });
    const client = res.body.client.id;
    const p = (await newEvent("smm", {}, client, `Arch ${stamp}`)).body.event;
    expect((await as("admin", request(app).post(`/api/v1/clients/${client}/archive`)).send({})).status).toBe(200);
    expect(out(await newEvent("smm", { parent: { kind: "event", id: p.id, stageId: p.stages[0].id } }, client))).toEqual([409, "CLIENT_ARCHIVED"]);
  });

  it("a malformed parent is a 400", async () => {
    const p = (await newEvent("smm", {}, clientA, `Bad ${stamp}`)).body.event;
    expect((await newEvent("smm", { parent: { kind: "client", id: p.id, stageId: p.stages[0].id } })).status).toBe(400);
    expect((await newEvent("smm", { parent: { kind: "event", id: "nope", stageId: p.stages[0].id } })).status).toBe(400);
    expect((await newEvent("smm", { parent: { kind: "event", id: p.id } })).status).toBe(400);
  });
});

describe("two parts finishing together", () => {
  it("the parent's people are told at least once (once per racing part at most), and the stage is clear", async () => {
    const p = (await newEvent("smm", {}, clientA, `Race ${stamp}`)).body.event;
    const parent = { kind: "event", id: p.id, stageId: p.stages[0].id };
    const a = (await newEvent("smm", { parent }, clientA, "Race A")).body.event;
    const b = (await newEvent("smm", { parent }, clientA, "Race B")).body.event;
    const stageOf = async (id: string) => (await getEvent("admin", id)).stages;
    const [sa, sb] = [await stageOf(a.id), await stageOf(b.id)];
    const results = await Promise.all([
      as("smm", request(app).post(`/api/v1/events/${a.id}/stage`)).send({ stageId: sa[2].id, version: a.version }),
      as("smm", request(app).post(`/api/v1/events/${b.id}/stage`)).send({ stageId: sb[2].id, version: b.version }),
    ]);
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect((await getEvent("smm", p.id)).stages[0].openChildren).toBe(0);
    const n = await notifCount("stage_children_finished", p.id);
    expect(n).toBeGreaterThanOrEqual(1);
    expect(n).toBeLessThanOrEqual(2);
  });
});

describe("query budget", () => {
  const pool = db.$client;
  const original = pool.query.bind(pool) as (...args: unknown[]) => Promise<unknown>;
  let count = 0;
  beforeAll(async () => {
    await request(app).get("/api/v1/auth/me").set("Authorization", auth.smm!);
    await new Promise((resolve) => setTimeout(resolve, 300)); // let the throttled "last seen" write land
    (pool as unknown as { query: (...args: unknown[]) => Promise<unknown> }).query = (...args: unknown[]) => {
      count += 1;
      return original(...args);
    };
  });
  afterAll(() => {
    (pool as unknown as { query: typeof original }).query = original;
  });
  const counted = async (fn: () => PromiseLike<Res>) => {
    count = 0;
    const res = await fn();
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    return count;
  };

  it("detail: the parts are two reads (events, tasks) whether there are none or twelve; a part adds one for its own parent", async () => {
    const bare = (await newEvent("smm", {}, clientA, `QB bare ${stamp}`)).body.event;
    const busy = (await newEvent("smm", {}, clientA, `QB busy ${stamp}`)).body.event;
    for (let i = 0; i < 12; i++) {
      const parent = { kind: "event", id: busy.id, stageId: busy.stages[0].id };
      expect((await (i % 2 === 0 ? newEvent("smm", { parent }, clientA, `QB part ${i}`) : newTask("smm", { title: `QB part ${i}`, parent }))).status).toBe(201);
    }
    const base = await counted(() => as("smm", request(app).get(`/api/v1/events/${bare.id}`)));
    const heavy = await counted(() => as("smm", request(app).get(`/api/v1/events/${busy.id}`)));
    expect(heavy, `event detail: ${base} queries with no parts, ${heavy} with 12`).toBe(base);
    expect(base).toBeLessThanOrEqual(7);
    const kids = (await getEvent("smm", busy.id)).children;
    const asPart = await counted(() => as("smm", request(app).get(`/api/v1/events/${kids.find((c) => c.kind === "event")!.id}`)));
    expect(asPart, `a part's detail: ${asPart} vs ${base}`).toBe(base + 1);
    // A task: 8 reads; the part of a task parent adds 1 for its own parent (no client or event link, so nothing else).
    const plain = (await newTask("smm")).body.task;
    const parentTask = (await newTask("smm")).body.task;
    const partTask = (await newTask("smm", { parent: { kind: "task", id: parentTask.id, stageId: parentTask.stages[0].id } })).body.task;
    const taskBase = await counted(() => as("smm", request(app).get(`/api/v1/staff-tasks/${plain.id}`)));
    expect(taskBase).toBeLessThanOrEqual(8);
    expect(await counted(() => as("smm", request(app).get(`/api/v1/staff-tasks/${partTask.id}`)))).toBe(taskBase + 1);
  });

  it("a move: the open-part counts are one grouped read per kind, whether the item has parts or not", async () => {
    const bare = (await newEvent("smm", {}, clientA, `QB move bare ${stamp}`)).body.event;
    const busy = (await newEvent("smm", {}, clientA, `QB move busy ${stamp}`)).body.event;
    for (let i = 0; i < 6; i++) {
      const parent = { kind: "event", id: busy.id, stageId: busy.stages[2].id }; // on the LAST stage, so moving 1 -> 2 isn't blocked
      expect((await newEvent("smm", { parent }, clientA, `QB move part ${i}`)).status).toBe(201);
    }
    const move = (e: Item) => counted(() => as("smm", request(app).post(`/api/v1/events/${e.id}/stage`)).send({ stageId: e.stages[1].id, version: e.version }));
    const base = await move(bare);
    const heavy = await move(busy);
    expect(heavy, `event move: ${base} queries with no parts, ${heavy} with 6`).toBe(base);
  });
});
