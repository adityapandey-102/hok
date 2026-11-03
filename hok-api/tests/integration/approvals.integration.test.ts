import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { and, desc, eq, sql } from "drizzle-orm";
import { createApp } from "../../src/app";
import { db } from "../../src/common/database/drizzle-client";
import { auditLog } from "../../src/common/audit/audit-log.schema";
import { stageApprovals } from "../../src/modules/approvals/infrastructure/approvals.schema";
import { bearerFor, closeDb, createFixtureUser, deleteClientsOwnedBy, deleteFixtureUser, deleteStaffTasksFor, deleteStageTemplates, type FixtureUser } from "./helpers";

/**
 * Stage approvals (round 3) against the real local stack: approvers on template stages, the move gate on events and
 * tasks (forward moves and completing stop at an unapproved approval stage), requesting and deciding (the check order,
 * no self-approval except the Admin, role / team-manager tokens that must also SEE the item), back moves and reopens
 * superseding old approvals, one pending request per stage even under a race, the SQL inbox, notifications, audit, and
 * the client's decision from the portal (same 404 for every refusal, the comment limiters, the 4 kb body limit).
 * Needs migration 20261104000001.
 */
const app = createApp();
const stamp = Date.now();
let admin: FixtureUser;
let smm: FixtureUser; // lead of clientA and clientP
let mm: FixtureUser; // marketing manager, on clientA's team
let smm2: FixtureUser; // another SMM: not on clientA's team
let editor: FixtureUser;
let developer: FixtureUser;
const auth: Record<string, string> = {};
const templateIds: string[] = [];
let clientA: string;
let clientP: string;
let clientB: string;
/** The user's example: 5 stages, stage 4 by an SMM or the Admin, stage 5 by the Admin only. */
let reelTpl: { id: string; name: string };
/** A task template whose stage 2 is approved by the client's team managers. */
let teamTaskTpl: { id: string };
/** Event templates: stage 2 by team managers; stage 2 by the client (plus a staff-only stage 3). */
let teamEventTpl: { id: string };
let clientEventTpl: { id: string };

type Json = Record<string, unknown>;
interface Stage {
  id: string;
  name: string;
  position: number;
  approvers: string[];
}
interface Approval {
  id: string;
  subject: "event" | "task";
  subjectId: string;
  subjectTitle: string;
  stageId: string;
  stageName: string;
  stagePosition: number;
  approvers: string[];
  status: string;
  requestNote: string | null;
  requestLink: string | null;
  requestedById: string | null;
  requestedByName: string | null;
  decidedById: string | null;
  decidedByName: string | null;
  decidedVia: string | null;
  decisionComment: string | null;
  version: number;
  canDecide: boolean;
  canCancel: boolean;
}
interface Item {
  id: string;
  version: number;
  stages: Stage[];
  approvals: Approval[];
  nextBlockedBy: { stageId: string; stageName: string } | null;
  currentStage?: { id: string; position: number };
  currentStageId?: string;
  state?: string;
  status?: string;
}

const as = (role: string, req: request.Test) => req.set("Authorization", auth[role]!);
const codeOf = (res: request.Response) => (res.body as { code?: string }).code;
const outcome = (res: request.Response) => [res.status, codeOf(res)];
const approvalOf = (res: request.Response) => (res.body as { approval: Approval }).approval;

async function makeTemplate(kind: "event" | "task", stages: (string | { name: string; approvers: string[] })[], name = `IT Appr ${kind} ${stamp}-${templateIds.length}`) {
  const res = await as("admin", request(app).post("/api/v1/stage-templates")).send({ name, kind, stages });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  const template = (res.body as { template: { id: string } }).template;
  templateIds.push(template.id);
  return { id: template.id, name };
}

// -- tasks --------------------------------------------------------------------------
async function newTask(templateId: string, extra: Json = {}, creator = "smm"): Promise<Item> {
  const res = await as(creator, request(app).post("/api/v1/staff-tasks")).send({ title: `IT Appr task ${stamp}`, templateId, assigneeId: editor.id, clientId: clientA, ...extra });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return (res.body as { task: Item }).task;
}
const getTask = async (role: string, id: string) => (await as(role, request(app).get(`/api/v1/staff-tasks/${id}`))).body as { task: Item };
async function moveTask(role: string, id: string, position: number | "complete") {
  const { task } = await getTask("admin", id);
  const body = position === "complete" ? { complete: true, version: task.version } : { stageId: task.stages[position - 1]!.id, version: task.version };
  return as(role, request(app).post(`/api/v1/staff-tasks/${id}/stage`)).send(body);
}

// -- events -------------------------------------------------------------------------
async function newEvent(templateId: string, client = clientA, extra: Json = {}): Promise<Item> {
  const res = await as("smm", request(app).post("/api/v1/events")).send({
    clientId: client,
    templateId,
    title: `IT Appr event ${stamp}`,
    type: "shoot",
    startsAt: "2031-03-02T10:00:00Z",
    endsAt: "2031-03-02T12:00:00Z",
    ...extra,
  });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return (res.body as { event: Item }).event;
}
const getEvent = async (role: string, id: string) => (await as(role, request(app).get(`/api/v1/events/${id}`))).body as { event: Item };
async function moveEvent(role: string, id: string, position: number) {
  const { event } = await getEvent("admin", id);
  return as(role, request(app).post(`/api/v1/events/${id}/stage`)).send({ stageId: event.stages[position - 1]!.id, version: event.version });
}

// -- approvals ----------------------------------------------------------------------
const requestApproval = (role: string, subject: "event" | "task", subjectId: string, extra: Json = {}) =>
  as(role, request(app).post("/api/v1/approvals")).send({ subject, subjectId, ...extra });
const decide = (role: string, a: Pick<Approval, "id" | "version">, decision: "approve" | "changes", comment?: string, version = a.version) =>
  as(role, request(app).post(`/api/v1/approvals/${a.id}/decision`)).send({ version, decision, ...(comment === undefined ? {} : { comment }) });
const cancel = (role: string, a: Pick<Approval, "id" | "version">) => as(role, request(app).post(`/api/v1/approvals/${a.id}/cancel`)).send({ version: a.version });
const statusesOf = async (column: "task_id" | "event_id", id: string) => {
  const r = await db.execute(sql`select s.position, a.status from stage_approvals a join ${sql.raw(column === "task_id" ? "task_stages" : "event_stages")} s on s.id = a.${sql.raw(column === "task_id" ? "task_stage_id" : "event_stage_id")} where a.${sql.raw(column)} = ${id} order by a.requested_at, s.position`);
  return (r.rows as { position: number; status: string }[]).map((x) => [x.position, x.status]);
};
async function recipientsOf(type: string, approvalId: string): Promise<string[]> {
  const r = await db.execute(sql`select user_id from notifications where type = ${type} and payload::text like ${"%" + approvalId + "%"}`);
  return (r.rows as { user_id: string }[]).map((x) => x.user_id);
}
const toDecideTotal = async (role: string) => ((await as(role, request(app).get("/api/v1/approvals?view=to_decide&limit=1"))).body as { total: number }).total;

beforeAll(async () => {
  admin = await createFixtureUser("admin", "IT Appr Admin");
  smm = await createFixtureUser("social_media_manager", "IT Appr SMM");
  mm = await createFixtureUser("marketing_manager", "IT Appr MM");
  smm2 = await createFixtureUser("social_media_manager", "IT Appr SMM Two");
  editor = await createFixtureUser("editor", "IT Appr Editor");
  developer = await createFixtureUser("developer", "IT Appr Developer");
  const people: [string, FixtureUser][] = [["admin", admin], ["smm", smm], ["mm", mm], ["smm2", smm2], ["editor", editor], ["developer", developer]];
  for (const [key, u] of people) auth[key] = await bearerFor(u);

  const mk = async (as_: string, name: string) => {
    const res = await as(as_, request(app).post("/api/v1/clients")).send({ businessName: `${name} ${stamp}` });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    return (res.body as { client: { id: string } }).client.id;
  };
  clientA = await mk("smm", "IT Appr Client A");
  clientP = await mk("smm", "IT Appr Client P");
  clientB = await mk("smm2", "IT Appr Client B");
  const team = await as("admin", request(app).put(`/api/v1/clients/${clientA}/team`)).send({ leadId: smm.id, memberIds: [mm.id] });
  expect(team.status, JSON.stringify(team.body)).toBe(200);

  reelTpl = await makeTemplate("task", ["Brief", "Rough cut", "Review", { name: "Final cut", approvers: ["social_media_manager", "admin"] }, { name: "Delivery", approvers: ["admin"] }], `Reel edit (approvals) ${stamp}`);
  teamTaskTpl = await makeTemplate("task", ["Draft", { name: "Check", approvers: ["team_managers"] }, "Done"]);
  teamEventTpl = await makeTemplate("event", ["Planned", { name: "Edit", approvers: ["team_managers"] }, "Delivered"]);
  clientEventTpl = await makeTemplate("event", ["Planned", { name: "Client Review", approvers: ["client"] }, "Delivered"]);
});

afterAll(async () => {
  const people = [admin, smm, mm, smm2, editor, developer].filter(Boolean).map((u) => u.id);
  await deleteStaffTasksFor(people);
  await deleteClientsOwnedBy(people);
  await deleteStageTemplates(templateIds);
  for (const id of people) await deleteFixtureUser(id);
  await closeDb();
});

describe("templates carry approvers", () => {
  it("returns approvers on every stage (plain names mean none), and the old string shape keeps working", async () => {
    const res = await as("admin", request(app).get(`/api/v1/stage-templates/${reelTpl.id}`));
    const stages = (res.body as { template: { stages: { name: string; approvers: string[] }[] } }).template.stages;
    expect(stages.map((s) => [s.name, s.approvers])).toEqual([
      ["Brief", []],
      ["Rough cut", []],
      ["Review", []],
      ["Final cut", ["social_media_manager", "admin"]],
      ["Delivery", ["admin"]],
    ]);
  });

  it("refuses unknown tokens, duplicates, too many, and the client on a task template (400 STAGE_TEMPLATE_APPROVERS_INVALID)", async () => {
    const post = (kind: string, approvers: string[]) =>
      as("admin", request(app).post("/api/v1/stage-templates")).send({ name: `IT bad approvers ${stamp}-${Math.random()}`, kind, stages: [{ name: "A", approvers }] });
    expect(outcome(await post("task", ["client"]))).toEqual([400, "STAGE_TEMPLATE_APPROVERS_INVALID"]);
    expect(outcome(await post("event", ["wizard"]))).toEqual([400, "STAGE_TEMPLATE_APPROVERS_INVALID"]);
    expect(outcome(await post("event", ["admin", "admin"]))).toEqual([400, "STAGE_TEMPLATE_APPROVERS_INVALID"]);
    expect(outcome(await post("event", ["admin", "team_managers", "client", "editor", "developer", "content_writer", "project_manager", "marketing_agent", "marketing_manager"]))).toEqual([400, "STAGE_TEMPLATE_APPROVERS_INVALID"]);
    // The client IS allowed on an event template.
    const ok = await post("event", ["client", "admin"]);
    expect(ok.status, JSON.stringify(ok.body)).toBe(201);
    templateIds.push((ok.body as { template: { id: string } }).template.id);
  });

  it("an update can add or clear approvers; an item made earlier keeps its own copy (FR-EVT-03)", async () => {
    const tpl = await makeTemplate("task", ["One", { name: "Two", approvers: ["admin"] }]);
    const task = await newTask(tpl.id, { clientId: undefined });
    expect(task.stages.map((s) => s.approvers)).toEqual([[], ["admin"]]);
    const edit = await as("admin", request(app).patch(`/api/v1/stage-templates/${tpl.id}`)).send({ stages: [{ name: "One", approvers: ["editor"] }, "Two"], version: 1 });
    expect(edit.status, JSON.stringify(edit.body)).toBe(200);
    expect((edit.body as { template: { stages: { approvers: string[] }[] } }).template.stages.map((s) => s.approvers)).toEqual([["editor"], []]);
    expect((await getTask("admin", task.id)).task.stages.map((s) => s.approvers)).toEqual([[], ["admin"]]);
    const fresh = await newTask(tpl.id, { clientId: undefined });
    expect(fresh.stages.map((s) => s.approvers)).toEqual([["editor"], []]);
  });
});

describe("the user's example: Reel edit (approvals), 5 stages", () => {
  let task: Item;
  let at4: Approval;
  let at5: Approval;

  it("starts with nothing blocked until the first approval stage; the stage list shows the approvers", async () => {
    task = await newTask(reelTpl.id);
    expect(task.stages.map((s) => s.approvers)).toEqual([[], [], [], ["social_media_manager", "admin"], ["admin"]]);
    const detail = (await getTask("editor", task.id)).task;
    expect(detail.nextBlockedBy).toMatchObject({ stageName: "Final cut" });
    expect(detail.approvals).toEqual([]);
  });

  it("2 -> 5 is refused (naming the stage), 2 -> 4 is allowed; 4 -> 5 and completing are refused", async () => {
    expect((await moveTask("editor", task.id, 2)).status).toBe(200);
    const jump = await moveTask("editor", task.id, 5);
    expect(outcome(jump)).toEqual([409, "STAGE_APPROVAL_REQUIRED"]);
    expect((jump.body as { error: string }).error).toContain("Final cut");
    expect((await moveTask("editor", task.id, 4)).status).toBe(200);
    expect(outcome(await moveTask("editor", task.id, 5))).toEqual([409, "STAGE_APPROVAL_REQUIRED"]);
    expect(outcome(await moveTask("editor", task.id, "complete"))).toEqual([409, "STAFF_TASK_NOT_AT_LAST_STAGE"]); // completing is only from the last stage
    expect((await getTask("editor", task.id)).task.nextBlockedBy).toMatchObject({ stageName: "Final cut" });
  });

  it("the editor asks for approval; a second ask is 409 STAGE_APPROVAL_PENDING; the approvers are told, the requester is not", async () => {
    const res = await requestApproval("editor", "task", task.id, { note: "Ready for a look", link: "https://drive.google.com/x" });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    at4 = approvalOf(res);
    expect(at4).toMatchObject({ subject: "task", status: "pending", stageName: "Final cut", stagePosition: 4, requestNote: "Ready for a look", requestLink: "https://drive.google.com/x", requestedByName: "IT Appr Editor", canDecide: false, canCancel: true, version: 1 });
    expect(at4.approvers).toEqual(["social_media_manager", "admin"]);
    expect(outcome(await requestApproval("editor", "task", task.id))).toEqual([409, "STAGE_APPROVAL_PENDING"]);

    const told = await recipientsOf("approval_requested", at4.id);
    expect(told).toEqual(expect.arrayContaining([smm.id, admin.id]));
    for (const not of [editor.id, mm.id, smm2.id, developer.id]) expect(told).not.toContain(not);
  });

  it("who may decide: the SMM and the Admin; the marketing manager (sees the task, wrong role) 403, a stranger 404, the requester 403", async () => {
    expect(outcome(await decide("mm", at4, "approve"))).toEqual([403, "STAGE_APPROVAL_NOT_APPROVER"]);
    expect(outcome(await decide("editor", at4, "approve"))).toEqual([403, "STAGE_APPROVAL_NOT_APPROVER"]);
    // An SMM who is not on the team and has nothing to do with the task: the same 404 as no such approval.
    expect(outcome(await decide("smm2", at4, "approve"))).toEqual([404, "STAGE_APPROVAL_NOT_FOUND"]);
    expect(outcome(await decide("developer", at4, "approve"))).toEqual([404, "STAGE_APPROVAL_NOT_FOUND"]);
    const seen = (await as("smm", request(app).get(`/api/v1/staff-tasks/${task.id}`))).body as { task: Item };
    expect(seen.task.approvals[0]).toMatchObject({ id: at4.id, canDecide: true });
    expect((await getTask("mm", task.id)).task.approvals[0]).toMatchObject({ canDecide: false, canCancel: false });
  });

  it("the check order on a decision: version last, comment before it, not-pending before the comment", async () => {
    expect(outcome(await decide("smm", at4, "changes"))).toEqual([400, "STAGE_APPROVAL_COMMENT_REQUIRED"]);
    expect(outcome(await decide("smm", at4, "changes", "   "))).toEqual([400, "STAGE_APPROVAL_COMMENT_REQUIRED"]);
    expect(outcome(await decide("smm", at4, "approve", undefined, 9))).toEqual([409, "STAGE_APPROVAL_MODIFIED"]);
    const ok = await decide("smm", at4, "approve", "Looks good");
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    at4 = approvalOf(ok);
    expect(at4).toMatchObject({ status: "approved", decidedByName: "IT Appr SMM", decidedVia: "staff", decisionComment: "Looks good", canDecide: false, canCancel: false });
    // Decided already: 409 NOT_PENDING wins over the missing comment and the stale version.
    expect(outcome(await decide("admin", at4, "changes"))).toEqual([409, "STAGE_APPROVAL_NOT_PENDING"]);
    expect(outcome(await cancel("editor", at4))).toEqual([409, "STAGE_APPROVAL_NOT_PENDING"]);
    expect(outcome(await requestApproval("editor", "task", task.id))).toEqual([409, "STAGE_APPROVAL_ALREADY_APPROVED"]);
  });

  it("tells the requester (and the creator) about the decision, not the person who made it", async () => {
    const told = await recipientsOf("approval_decided", at4.id);
    expect(told).toContain(editor.id);
    expect(told).not.toContain(smm.id); // smm made the decision (and created the task): the actor is skipped
  });

  it("4 -> 5 now works, but completing from 5 is refused until the Admin approves stage 5 -- the SMM can't", async () => {
    expect((await getTask("editor", task.id)).task.nextBlockedBy).toMatchObject({ stageName: "Delivery" });
    expect((await moveTask("editor", task.id, 5)).status).toBe(200);
    expect(outcome(await moveTask("editor", task.id, "complete"))).toEqual([409, "STAGE_APPROVAL_REQUIRED"]);
    at5 = approvalOf(await requestApproval("editor", "task", task.id));
    expect(at5).toMatchObject({ stageName: "Delivery", approvers: ["admin"] });
    expect(outcome(await decide("smm", at5, "approve"))).toEqual([403, "STAGE_APPROVAL_NOT_APPROVER"]);
    expect((await getTask("smm", task.id)).task.approvals[0]).toMatchObject({ id: at5.id, canDecide: false });
    expect((await decide("admin", at5, "approve")).status).toBe(200);
    // Told: only the Admin(s) for stage 5 (the SMM isn't an approver of it).
    const told = await recipientsOf("approval_requested", at5.id);
    expect(told).toContain(admin.id);
    expect(told).not.toContain(smm.id);
  });

  it("the editor completes it; the timeline and approvals read in order (newest first)", async () => {
    const done = await moveTask("editor", task.id, "complete");
    expect(done.status, JSON.stringify(done.body)).toBe(200);
    const detail = (done.body as { task: Item }).task;
    expect(detail.status).toBe("done");
    expect(detail.nextBlockedBy).toBeNull();
    expect(detail.approvals.map((a) => [a.stageName, a.status])).toEqual([
      ["Delivery", "approved"],
      ["Final cut", "approved"],
    ]);
  });
});

describe("the gate on events, and who decides (team managers, the Admin's limits)", () => {
  let event: Item;
  let appr: Approval;

  it("an event stops at its approval stage; the team managers decide, the requester can't, the Admin isn't a token", async () => {
    event = await newEvent(teamEventTpl.id);
    expect(event.stages.map((s) => s.approvers)).toEqual([[], ["team_managers"], []]);
    // Nothing to approve at stage 1.
    expect(outcome(await requestApproval("smm", "event", event.id))).toEqual([409, "STAGE_APPROVAL_NOT_NEEDED"]);
    expect((await moveEvent("smm", event.id, 2)).status).toBe(200);
    expect(outcome(await moveEvent("smm", event.id, 3))).toEqual([409, "STAGE_APPROVAL_REQUIRED"]);
    expect((await getEvent("smm", event.id)).event.nextBlockedBy).toMatchObject({ stageName: "Edit" });

    const res = await requestApproval("smm", "event", event.id, { note: "Rough edit" });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    appr = approvalOf(res);
    expect(appr).toMatchObject({ subject: "event", clientName: expect.stringContaining("IT Appr Client A") as string, canDecide: false, canCancel: true });

    expect(outcome(await decide("smm", appr, "approve"))).toEqual([403, "STAGE_APPROVAL_SELF"]); // the requester, a team manager
    expect(outcome(await decide("admin", appr, "approve"))).toEqual([403, "STAGE_APPROVAL_NOT_APPROVER"]); // admin is not a team manager
    expect(outcome(await decide("smm2", appr, "approve"))).toEqual([404, "STAGE_APPROVAL_NOT_FOUND"]);
    expect(outcome(await decide("editor", appr, "approve"))).toEqual([404, "STAGE_APPROVAL_NOT_FOUND"]);
    // Told: the other team manager (mm), never the requester, the Admin (not a token) or a manager off the team.
    const told = await recipientsOf("approval_requested", appr.id);
    expect(told).toContain(mm.id);
    for (const not of [smm.id, admin.id, smm2.id]) expect(told).not.toContain(not);
  });

  it("a team manager approves; the event moves on; moving back supersedes the approval, and it is needed again", async () => {
    const ok = await decide("mm", appr, "approve");
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect(approvalOf(ok)).toMatchObject({ status: "approved", decidedByName: "IT Appr MM" });
    expect((await moveEvent("smm", event.id, 3)).status).toBe(200);
    expect((await moveEvent("smm", event.id, 1)).status).toBe(200);
    expect(await statusesOf("event_id", event.id)).toEqual([[2, "superseded"]]);
    const detail = (await getEvent("smm", event.id)).event;
    expect(detail.approvals.map((a) => a.status)).toEqual(["superseded"]); // kept for history
    expect(detail.nextBlockedBy).toMatchObject({ stageName: "Edit" });
    expect((await moveEvent("smm", event.id, 2)).status).toBe(200);
    expect(outcome(await moveEvent("smm", event.id, 3))).toEqual([409, "STAGE_APPROVAL_REQUIRED"]);
    const [audit] = await db.select().from(auditLog).where(and(eq(auditLog.action, "approval.superseded"), eq(auditLog.entityId, event.id))).orderBy(desc(auditLog.createdAt)).limit(1);
    expect(audit?.metadata).toMatchObject({ superseded: 1, cancelled: 0 });
  });

  it("a back move also cancels a pending request; the requester and managers may cancel, the editor can't see it", async () => {
    const pending = approvalOf(await requestApproval("smm", "event", event.id));
    expect(outcome(await cancel("editor", pending))).toEqual([404, "STAGE_APPROVAL_NOT_FOUND"]);
    expect(outcome(await cancel("smm2", pending))).toEqual([404, "STAGE_APPROVAL_NOT_FOUND"]);
    expect((await moveEvent("smm", event.id, 1)).status).toBe(200);
    expect(await statusesOf("event_id", event.id)).toEqual([[2, "superseded"], [2, "cancelled"]]);
    // Another round, cancelled by the other team manager (a manager of the item may withdraw anyone's request).
    expect((await moveEvent("smm", event.id, 2)).status).toBe(200);
    const again = approvalOf(await requestApproval("smm", "event", event.id));
    const withdrawn = await cancel("mm", again);
    expect(withdrawn.status, JSON.stringify(withdrawn.body)).toBe(200);
    expect(approvalOf(withdrawn).status).toBe("cancelled");
    expect(outcome(await cancel("smm", again))).toEqual([409, "STAGE_APPROVAL_NOT_PENDING"]);
  });

  it("an event that isn't active can't be sent for approval; a viewer who can't move it is 403", async () => {
    const e = await newEvent(teamEventTpl.id);
    expect((await moveEvent("smm", e.id, 2)).status).toBe(200);
    // mm is on the team and may move it; a stranger gets 404; developer 404.
    expect(outcome(await requestApproval("smm2", "event", e.id))).toEqual([404, "EVENT_NOT_FOUND"]);
    expect(outcome(await requestApproval("developer", "event", e.id))).toEqual([404, "EVENT_NOT_FOUND"]);
    const { event: fresh } = await getEvent("smm", e.id);
    const cancelled = await as("smm", request(app).patch(`/api/v1/events/${e.id}`)).send({ state: "cancelled", version: fresh.version });
    expect(cancelled.status, JSON.stringify(cancelled.body)).toBe(200);
    expect(outcome(await requestApproval("smm", "event", e.id))).toEqual([409, "EVENT_NOT_ACTIVE"]);
  });
});

describe("tasks: who may ask, a team_managers stage on a task with no client, reopen, self-approval", () => {
  it("only the assignee, creator and Admin may ask: a manager who merely sees the task gets 403; a done task 409", async () => {
    const task = await newTask(reelTpl.id);
    await moveTask("editor", task.id, 4);
    expect(outcome(await requestApproval("mm", "task", task.id))).toEqual([403, "STAFF_TASK_FORBIDDEN"]);
    expect(outcome(await requestApproval("smm2", "task", task.id))).toEqual([404, "STAFF_TASK_NOT_FOUND"]);
    expect(outcome(await requestApproval("developer", "task", task.id))).toEqual([404, "STAFF_TASK_NOT_FOUND"]);
    expect(outcome(await requestApproval("editor", "task", "00000000-0000-4000-8000-000000000000"))).toEqual([404, "STAFF_TASK_NOT_FOUND"]);
    const asked = await requestApproval("smm", "task", task.id); // the creator may ask too
    expect(asked.status).toBe(201);
    expect(approvalOf(asked).requestedByName).toBe("IT Appr SMM");

    const doneTask = await newTask(reelTpl.id);
    for (const p of [4, 5]) {
      await moveTask("editor", doneTask.id, p);
      const a = approvalOf(await requestApproval("editor", "task", doneTask.id));
      expect((await decide("admin", a, "approve")).status).toBe(200);
    }
    expect((await moveTask("editor", doneTask.id, "complete")).status).toBe(200);
    expect(outcome(await requestApproval("editor", "task", doneTask.id))).toEqual([409, "STAFF_TASK_DONE"]);
  });

  it("no self-approval: the creator who is also an approver gets 403 STAGE_APPROVAL_SELF; the Admin may approve their own request", async () => {
    const task = await newTask(reelTpl.id);
    await moveTask("smm", task.id, 4);
    const mine = approvalOf(await requestApproval("smm", "task", task.id));
    expect(outcome(await decide("smm", mine, "approve"))).toEqual([403, "STAGE_APPROVAL_SELF"]);
    expect((await decide("admin", mine, "approve")).status).toBe(200);

    const adminTask = await newTask(reelTpl.id, { clientId: undefined }, "admin");
    await moveTask("admin", adminTask.id, 4);
    const own = approvalOf(await requestApproval("admin", "task", adminTask.id));
    const ok = await decide("admin", own, "approve");
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect(approvalOf(ok)).toMatchObject({ requestedById: admin.id, decidedById: admin.id, status: "approved" });
  });

  it("team_managers on a task with no client: nobody can decide it, nobody is told, and it stays out of every inbox", async () => {
    const task = await newTask(teamTaskTpl.id, { clientId: undefined }, "admin");
    await moveTask("editor", task.id, 2);
    expect(outcome(await moveTask("editor", task.id, 3))).toEqual([409, "STAGE_APPROVAL_REQUIRED"]);
    const before = { admin: await toDecideTotal("admin"), smm: await toDecideTotal("smm") };
    const a = approvalOf(await requestApproval("editor", "task", task.id));
    expect(await recipientsOf("approval_requested", a.id)).toEqual([]);
    expect(outcome(await decide("admin", a, "approve"))).toEqual([403, "STAGE_APPROVAL_NOT_APPROVER"]);
    expect(outcome(await decide("smm", a, "approve"))).toEqual([404, "STAGE_APPROVAL_NOT_FOUND"]);
    expect(outcome(await decide("mm", a, "approve"))).toEqual([404, "STAGE_APPROVAL_NOT_FOUND"]);
    expect({ admin: await toDecideTotal("admin"), smm: await toDecideTotal("smm") }).toEqual(before);
    // The requester can still withdraw it.
    expect((await cancel("editor", a)).status).toBe(200);
  });

  it("team_managers on a task with a client: the client's team (not the creator, who asked) decides", async () => {
    const task = await newTask(teamTaskTpl.id, {}, "admin"); // created by the Admin, for clientA
    await moveTask("editor", task.id, 2);
    const a = approvalOf(await requestApproval("editor", "task", task.id));
    const told = await recipientsOf("approval_requested", a.id);
    expect(told).toEqual(expect.arrayContaining([smm.id, mm.id]));
    expect(told).not.toContain(smm2.id);
    expect((await decide("mm", a, "approve")).status).toBe(200);
  });

  it("a back move supersedes approved rows from that stage on and cancels pending ones; the audit entry counts them", async () => {
    const task = await newTask(reelTpl.id);
    await moveTask("editor", task.id, 4);
    expect((await decide("smm", approvalOf(await requestApproval("editor", "task", task.id)), "approve")).status).toBe(200);
    await moveTask("editor", task.id, 5);
    const pending5 = approvalOf(await requestApproval("editor", "task", task.id));
    expect(await statusesOf("task_id", task.id)).toEqual([[4, "approved"], [5, "pending"]]);

    // Back from 5 to 4: stage 4's approval is superseded and the request waiting at 5 is cancelled.
    const same = await moveTask("editor", task.id, 4);
    expect(same.status).toBe(200);
    expect(await statusesOf("task_id", task.id)).toEqual([[4, "superseded"], [5, "cancelled"]]);
    expect(pending5.id).toBeTruthy();
    const detail = (await getTask("editor", task.id)).task;
    expect(detail.nextBlockedBy).toMatchObject({ stageName: "Final cut" });
    expect(outcome(await moveTask("editor", task.id, 5))).toEqual([409, "STAGE_APPROVAL_REQUIRED"]);
    const [audit] = await db.select().from(auditLog).where(and(eq(auditLog.action, "approval.superseded"), eq(auditLog.entityId, task.id))).orderBy(desc(auditLog.createdAt)).limit(1);
    expect(audit?.metadata).toMatchObject({ superseded: 1, cancelled: 1 });
  });

  it("reopening a done task counts as a back move: approvals from the reopened stage on are superseded, earlier ones stay", async () => {
    const task = await newTask(reelTpl.id);
    for (const p of [4, 5]) {
      await moveTask("editor", task.id, p);
      expect((await decide("admin", approvalOf(await requestApproval("editor", "task", task.id)), "approve")).status).toBe(200);
    }
    expect(await statusesOf("task_id", task.id)).toEqual([[4, "approved"], [5, "approved"]]);
    // A back move from 5 to 4 supersedes both (positions >= 4).
    expect((await moveTask("editor", task.id, 4)).status).toBe(200);
    expect(await statusesOf("task_id", task.id)).toEqual([[4, "superseded"], [5, "superseded"]]);
    // Start over from stage 4 (where the task is), finish, then reopen.
    expect((await decide("admin", approvalOf(await requestApproval("editor", "task", task.id)), "approve")).status).toBe(200);
    await moveTask("editor", task.id, 5);
    expect((await decide("admin", approvalOf(await requestApproval("editor", "task", task.id)), "approve")).status).toBe(200);
    expect((await moveTask("editor", task.id, "complete")).status).toBe(200);
    const done = (await getTask("admin", task.id)).task;
    const reopened = await as("admin", request(app).post(`/api/v1/staff-tasks/${task.id}/reopen`)).send({ stageId: task.stages[4]!.id, version: done.version });
    expect(reopened.status, JSON.stringify(reopened.body)).toBe(200);
    // Reopened at stage 5: stage 5's approval no longer counts, stage 4's still does.
    expect((await statusesOf("task_id", task.id)).filter((s) => s[1] === "approved")).toEqual([[4, "approved"]]);
    expect(((reopened.body as { task: Item }).task).nextBlockedBy).toMatchObject({ stageName: "Delivery" });
    expect(outcome(await moveTask("editor", task.id, "complete"))).toEqual([409, "STAGE_APPROVAL_REQUIRED"]);

    // Finish again and reopen to stage 2: everything from 2 on is superseded.
    expect((await decide("admin", approvalOf(await requestApproval("editor", "task", task.id)), "approve")).status).toBe(200);
    expect((await moveTask("editor", task.id, "complete")).status).toBe(200);
    const done2 = (await getTask("admin", task.id)).task;
    const back = await as("admin", request(app).post(`/api/v1/staff-tasks/${task.id}/reopen`)).send({ stageId: task.stages[1]!.id, version: done2.version });
    expect(back.status, JSON.stringify(back.body)).toBe(200);
    expect((await statusesOf("task_id", task.id)).filter((s) => s[1] === "approved")).toEqual([]);
    expect(((back.body as { task: Item }).task).nextBlockedBy).toMatchObject({ stageName: "Final cut" });
  });
});

describe("one pending request per stage", () => {
  it("two simultaneous requests: one 201, one 409 STAGE_APPROVAL_PENDING", async () => {
    const task = await newTask(reelTpl.id);
    await moveTask("smm", task.id, 4);
    const [a, b] = await Promise.all([requestApproval("editor", "task", task.id), requestApproval("smm", "task", task.id)]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const loser = a.status === 409 ? a : b;
    expect(codeOf(loser)).toBe("STAGE_APPROVAL_PENDING");
    const pending = await db.select().from(stageApprovals).where(and(eq(stageApprovals.taskId, task.id), eq(stageApprovals.status, "pending")));
    expect(pending).toHaveLength(1);
  });

  it("a request sent back for changes can be asked again at once; each round is its own row", async () => {
    const task = await newTask(reelTpl.id);
    await moveTask("editor", task.id, 4);
    const first = approvalOf(await requestApproval("editor", "task", task.id));
    const changes = await decide("admin", first, "changes", "Tighten the intro");
    expect(approvalOf(changes)).toMatchObject({ status: "changes_requested", decisionComment: "Tighten the intro" });
    expect(outcome(await moveTask("editor", task.id, 5))).toEqual([409, "STAGE_APPROVAL_REQUIRED"]);
    const second = approvalOf(await requestApproval("editor", "task", task.id));
    expect(second.id).not.toBe(first.id);
    expect((await decide("smm", second, "approve")).status).toBe(200);
    const rounds = (await getTask("editor", task.id)).task.approvals.map((a) => a.status);
    expect(rounds).toEqual(["approved", "changes_requested"]);
    expect((await moveTask("editor", task.id, 5)).status).toBe(200);
  });
});

describe("request validation", () => {
  it("refuses a bad body (400), a javascript: link, an over-long note and unknown keys", async () => {
    const task = await newTask(reelTpl.id);
    await moveTask("editor", task.id, 4);
    for (const body of [{ subject: "client", subjectId: task.id }, { subject: "task", subjectId: "nope" }, { subject: "task", subjectId: task.id, link: "javascript:alert(1)" }, { subject: "task", subjectId: task.id, note: "x".repeat(2001) }, { subject: "task", subjectId: task.id, status: "approved" }, {}]) {
      expect(outcome(await as("editor", request(app).post("/api/v1/approvals")).send(body)), JSON.stringify(body).slice(0, 80)).toEqual([400, "VALIDATION_ERROR"]);
    }
    const bad = await as("admin", request(app).post("/api/v1/approvals/not-a-uuid/decision")).send({ version: 1, decision: "approve" });
    expect(outcome(bad)).toEqual([404, "STAGE_APPROVAL_NOT_FOUND"]);
    expect(outcome(await as("admin", request(app).post("/api/v1/approvals/00000000-0000-4000-8000-000000000000/decision")).send({ version: 1, decision: "approve" }))).toEqual([404, "STAGE_APPROVAL_NOT_FOUND"]);
    expect((await as("admin", request(app).post("/api/v1/approvals/00000000-0000-4000-8000-000000000000/decision")).send({ decision: "approve" })).status).toBe(400);
  });

  it("needs a signed-in user", async () => {
    expect((await request(app).get("/api/v1/approvals")).status).toBe(401);
    expect((await request(app).get("/api/v1/approvals/count")).status).toBe(401);
    expect((await request(app).post("/api/v1/approvals")).status).toBe(401);
  });
});

describe("the inbox: GET /approvals and /approvals/count", () => {
  it("to_decide is worked out in SQL per role, with paging totals; requested and all_visible; the badge count matches", async () => {
    const base = { smm: await toDecideTotal("smm"), mm: await toDecideTotal("mm"), admin: await toDecideTotal("admin"), editor: await toDecideTotal("editor"), smm2: await toDecideTotal("smm2") };
    // Three tasks waiting at stage 4 (SMM or Admin), one waiting at the team-manager stage of a clientA task.
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const t = await newTask(reelTpl.id, { title: `IT Appr inbox ${stamp} ${i}` });
      await moveTask("editor", t.id, 4);
      ids.push(approvalOf(await requestApproval("editor", "task", t.id)).id);
    }
    const tm = await newTask(teamTaskTpl.id, { title: `IT Appr inbox team ${stamp}` });
    await moveTask("editor", tm.id, 2);
    ids.push(approvalOf(await requestApproval("editor", "task", tm.id)).id);

    expect(await toDecideTotal("smm")).toBe(base.smm + 4); // three SMM-stage ones + the team-manager one
    expect(await toDecideTotal("mm")).toBe(base.mm + 1); // a marketing manager on the team: only the team-manager one
    expect(await toDecideTotal("admin")).toBe(base.admin + 3);
    expect(await toDecideTotal("editor")).toBe(base.editor);
    expect(await toDecideTotal("smm2")).toBe(base.smm2);

    // The count endpoint is the same number.
    for (const role of ["smm", "mm", "admin", "editor", "smm2"]) {
      expect(((await as(role, request(app).get("/api/v1/approvals/count"))).body as { toDecide: number }).toDecide, role).toBe(await toDecideTotal(role));
    }

    // Paging: a page of 2 out of the SMM's list, total unchanged by the page size, newest first.
    const p1 = (await as("smm", request(app).get("/api/v1/approvals?view=to_decide&limit=2&offset=0"))).body as { approvals: Approval[]; total: number; limit: number; offset: number };
    const p2 = (await as("smm", request(app).get("/api/v1/approvals?view=to_decide&limit=2&offset=2"))).body as { approvals: Approval[]; total: number };
    expect(p1).toMatchObject({ total: base.smm + 4, limit: 2, offset: 0 });
    expect(p1.approvals).toHaveLength(2);
    expect(p2.total).toBe(p1.total);
    expect(p1.approvals.every((a) => a.canDecide && a.status === "pending")).toBe(true);
    expect(new Set([...p1.approvals, ...p2.approvals].map((a) => a.id)).size).toBe(Math.min(4, p1.total));
    const waits = [...p1.approvals, ...p2.approvals].map((a) => (a as unknown as { requestedAt: string }).requestedAt);
    expect(waits).toEqual([...waits].sort()); // to_decide: what has waited longest comes first
    const big = (await as("smm", request(app).get("/api/v1/approvals?limit=100000"))).body as { limit: number };
    expect(big.limit).toBe(100);

    // "I requested": the editor's own; "all visible": the SMM sees the clientA ones too, with the status filter.
    const mine = (await as("editor", request(app).get("/api/v1/approvals?view=requested&limit=100"))).body as { approvals: Approval[] };
    expect(ids.every((id) => mine.approvals.some((a) => a.id === id))).toBe(true);
    expect(mine.approvals.every((a) => a.requestedById === editor.id)).toBe(true);
    expect(mine.approvals[0]!.id).toBe(ids[3]); // "I requested": newest first
    const visibleToSmm2 = (await as("smm2", request(app).get("/api/v1/approvals?view=all_visible&limit=100"))).body as { approvals: Approval[] };
    expect(visibleToSmm2.approvals.some((a) => ids.includes(a.id))).toBe(false);
    const approved = (await as("admin", request(app).get("/api/v1/approvals?view=all_visible&status=approved&limit=100"))).body as { approvals: Approval[] };
    expect(approved.approvals.length).toBeGreaterThan(0);
    expect(approved.approvals.every((a) => a.status === "approved")).toBe(true);
    expect(outcome(await as("admin", request(app).get("/api/v1/approvals?view=everything")))).toEqual([400, "VALIDATION_ERROR"]);
  });

  it("deciding takes a request out of the deciders' inbox; the dashboard carries the same count and the oldest", async () => {
    const before = await toDecideTotal("smm");
    const t = await newTask(reelTpl.id, { title: `IT Appr dash ${stamp}` });
    await moveTask("editor", t.id, 4);
    const a = approvalOf(await requestApproval("editor", "task", t.id));
    expect(await toDecideTotal("smm")).toBe(before + 1);
    const dash = (await as("smm", request(app).get("/api/v1/dashboard"))).body as { approvals: { toDecide: number; oldest: Approval[] } };
    expect(dash.approvals.toDecide).toBe(before + 1);
    expect(dash.approvals.oldest.length).toBeLessThanOrEqual(3);
    expect(dash.approvals.oldest.every((x) => x.status === "pending")).toBe(true);
    expect((await decide("smm", a, "approve")).status).toBe(200);
    expect(await toDecideTotal("smm")).toBe(before);
  });
});

describe("audit", () => {
  it("records requested, decided and cancelled with ids only (never the note or comment)", async () => {
    const t = await newTask(reelTpl.id);
    await moveTask("editor", t.id, 4);
    const a = approvalOf(await requestApproval("editor", "task", t.id, { note: "SECRET-NOTE" }));
    const b = await decide("smm", a, "changes", "SECRET-COMMENT");
    expect(b.status).toBe(200);
    const c = approvalOf(await requestApproval("editor", "task", t.id));
    await cancel("editor", c);
    const rows = await db.select().from(auditLog).where(eq(auditLog.entityType, "stage_approval"));
    const mineRows = rows.filter((r) => r.entityId === a.id || r.entityId === c.id);
    expect(mineRows.map((r) => r.action).sort()).toEqual(["approval.cancelled", "approval.decided", "approval.requested", "approval.requested"]);
    expect(mineRows.find((r) => r.action === "approval.decided")).toMatchObject({ actorId: smm.id, metadata: { decision: "changes", subject: "task", subjectId: t.id } });
    expect(JSON.stringify(mineRows)).not.toContain("SECRET");
  });
});

describe("the client decides in the portal", () => {
  const body = (res: request.Response) => res.body as Json;
  let token: string;
  let strangerToken: string;
  let event: Item;
  let pending: { id: string; version: number };
  const portalPost = (tokenValue: string, approvalId: string, payload: Json) => request(app).post(`/api/v1/portal/${tokenValue}/approvals/${approvalId}`).send(payload);
  const portalEvent = async (tokenValue: string, id: string) => ((await request(app).get(`/api/v1/portal/${tokenValue}/events/${id}`)).body as { event: Json }).event;

  beforeAll(async () => {
    const link = await as("smm", request(app).post(`/api/v1/portal-links/${clientP}`));
    expect(link.status).toBe(201);
    token = body(link).token as string;
    const other = await as("smm2", request(app).post(`/api/v1/portal-links/${clientB}`));
    expect(other.status).toBe(201);
    strangerToken = body(other).token as string;
    event = await newEvent(clientEventTpl.id, clientP);
  });

  it("nothing is pending before a request; the stage gate holds", async () => {
    expect((await moveEvent("smm", event.id, 2)).status).toBe(200);
    expect(outcome(await moveEvent("smm", event.id, 3))).toEqual([409, "STAGE_APPROVAL_REQUIRED"]);
    const e = await portalEvent(token, event.id);
    expect(e.pendingApproval).toBeNull();
    expect(e.approvalHistory).toEqual([]);
  });

  it("a request shows on the portal event page and flags the dashboard's current event, without staff names", async () => {
    const res = await requestApproval("smm", "event", event.id, { note: "Please check the logo", link: "https://drive.google.com/final" });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    pending = approvalOf(res);
    const e = await portalEvent(token, event.id);
    expect(e.pendingApproval).toEqual({ id: pending.id, version: 1, stageName: "Client Review", requestNote: "Please check the logo", requestLink: "https://drive.google.com/final", requestedAt: expect.any(String) as string });
    expect(JSON.stringify(e)).not.toContain("IT Appr SMM");
    const dash = body(await request(app).get(`/api/v1/portal/${token}`));
    expect(dash.current).toMatchObject({ id: event.id, awaitingYourApproval: true });
  });

  it("staff can't decide a client-only stage, not even the Admin (403 NOT_APPROVER)", async () => {
    expect(outcome(await decide("admin", pending, "approve"))).toEqual([403, "STAGE_APPROVAL_NOT_APPROVER"]);
    expect(outcome(await decide("smm", pending, "approve"))).toEqual([403, "STAGE_APPROVAL_NOT_APPROVER"]);
    expect(((await getEvent("smm", event.id)).event.approvals[0])).toMatchObject({ canDecide: false, canCancel: true });
  });

  it("changes need a comment (400); a stale version is 409", async () => {
    expect(outcome(await portalPost(token, pending.id, { version: 1, decision: "changes" }))).toEqual([400, "STAGE_APPROVAL_COMMENT_REQUIRED"]);
    expect(outcome(await portalPost(token, pending.id, { version: 7, decision: "approve" }))).toEqual([409, "STAGE_APPROVAL_MODIFIED"]);
  });

  it("the client asks for changes: the comment is kept as plain text, the team is told, the audit has no actor", async () => {
    const comment = "Logo <b>too small</b> & <script>alert(1)</script>";
    const res = await portalPost(token, pending.id, { version: 1, decision: "changes", comment });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(res.headers["cache-control"]).toContain("no-store");
    const e = await portalEvent(token, event.id);
    expect(e.pendingApproval).toBeNull();
    expect(e.approvalHistory).toEqual([{ stageName: "Client Review", status: "changes_requested", decidedVia: "portal", decidedAt: expect.any(String) as string, decisionComment: comment }]);
    expect(JSON.stringify(e)).not.toContain("IT Appr SMM");
    const staff = (await getEvent("smm", event.id)).event.approvals[0]!;
    expect(staff).toMatchObject({ status: "changes_requested", decidedVia: "portal", decidedById: null, decidedByName: null, decisionComment: comment });
    expect(await recipientsOf("approval_decided", pending.id)).toContain(smm.id);
    const [audit] = await db.select().from(auditLog).where(and(eq(auditLog.action, "approval.decided"), eq(auditLog.entityId, pending.id)));
    expect(audit).toMatchObject({ actorId: null, metadata: { decision: "changes", via: "portal", linkId: expect.any(String) as string } });
    expect((await request(app).get(`/api/v1/portal/${token}`).then((r) => body(r).current) as Json).awaitingYourApproval).toBe(false);
    // Decided already: the same 404 as everything else.
    expect(outcome(await portalPost(token, pending.id, { version: 1, decision: "approve" }))).toEqual([404, "PORTAL_APPROVAL_NOT_FOUND"]);
  });

  it("the team moves the work back, asks again; the client approves; the event moves on", async () => {
    expect((await moveEvent("smm", event.id, 1)).status).toBe(200);
    expect((await moveEvent("smm", event.id, 2)).status).toBe(200);
    expect(outcome(await moveEvent("smm", event.id, 3))).toEqual([409, "STAGE_APPROVAL_REQUIRED"]);
    const again = approvalOf(await requestApproval("smm", "event", event.id));
    expect(again.id).not.toBe(pending.id);
    // Another client's link can't touch it.
    expect(outcome(await portalPost(strangerToken, again.id, { version: 1, decision: "approve" }))).toEqual([404, "PORTAL_APPROVAL_NOT_FOUND"]);
    expect((await portalPost(token, again.id, { version: 1, decision: "approve" })).status).toBe(200);
    const e = await portalEvent(token, event.id);
    expect((e.approvalHistory as { status: string }[]).map((h) => h.status)).toEqual(["approved", "changes_requested"]);
    expect((await moveEvent("smm", event.id, 3)).status).toBe(200);
    expect(await recipientsOf("approval_decided", again.id)).toContain(smm.id);
  });

  it("a stage the client isn't an approver of, and a task's approval, are 404 on the portal -- and never show on the page", async () => {
    const team = await newEvent(teamEventTpl.id, clientP);
    await moveEvent("smm", team.id, 2);
    const teamApproval = approvalOf(await requestApproval("smm", "event", team.id));
    expect(outcome(await portalPost(token, teamApproval.id, { version: 1, decision: "approve" }))).toEqual([404, "PORTAL_APPROVAL_NOT_FOUND"]);
    const e = await portalEvent(token, team.id);
    expect(e.pendingApproval).toBeNull();
    expect(e.approvalHistory).toEqual([]);
    expect((await getEvent("smm", team.id)).event.approvals[0]!.status).toBe("pending");

    const task = await newTask(reelTpl.id, { clientId: clientP });
    await moveTask("editor", task.id, 4);
    const taskApproval = approvalOf(await requestApproval("editor", "task", task.id));
    expect(outcome(await portalPost(token, taskApproval.id, { version: 1, decision: "approve" }))).toEqual([404, "PORTAL_APPROVAL_NOT_FOUND"]);
  });

  it("a made-up or malformed id is the same 404; unknown keys and an over-size body are refused", async () => {
    expect(outcome(await portalPost(token, "not-a-uuid", { version: 1, decision: "approve" }))).toEqual([404, "PORTAL_APPROVAL_NOT_FOUND"]);
    expect(outcome(await portalPost("x", "00000000-0000-4000-8000-000000000000", { version: 1, decision: "approve" }))).toEqual([404, "PORTAL_LINK_INVALID"]);
    const big = await portalPost(token, "00000000-0000-4000-8000-000000000000", { version: 1, decision: "changes", comment: "x".repeat(5000) });
    expect(big.status).toBe(413);
  });

  it("uses the comment limiters (the budget is per IP: a burst of posts ends in 429)", async () => {
    const first = await portalPost(token, "00000000-0000-4000-8000-000000000000", { version: 1, decision: "approve" });
    expect(first.headers["ratelimit"] ?? first.headers["ratelimit-policy"]).toBeDefined();
    let limited: request.Response | undefined;
    for (let i = 0; i < 12 && !limited; i++) {
      const r = await portalPost(token, "00000000-0000-4000-8000-000000000000", { version: 1, decision: "approve" });
      if (r.status === 429) limited = r;
    }
    expect(limited, "no 429 after 12 more posts").toBeDefined();
    expect(codeOf(limited!)).toBe("RATE_LIMITED");
  });
});
