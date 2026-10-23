import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";
import { bearerFor, closeDb, createFixtureUser, deleteClientsOwnedBy, deleteFixtureUser, deleteStageTemplates, type FixtureUser } from "./helpers";

/**
 * Client to-do lists end to end (REQUIREMENTS section 5.4): create/list/edit/
 * delete, the open/done/all lists, overdue + due-range + priority + search
 * filters, done/reopen stamping completed_at, row scope (another manager's
 * client or to-do is 404), task-only roles 403, the optimistic lock, the
 * event-must-be-the-same-client rule and archived clients being read-only.
 * Needs migration 20261017000003 applied.
 */
const app = createApp();
let admin: FixtureUser;
let smm: FixtureUser;
let mm: FixtureUser;
let editor: FixtureUser;
const auth: Record<string, string> = {};
let clientId: string;
let otherClientId: string;
let templateId: string;
const stamp = Date.now();

const as = (role: string, req: request.Test) => req.set("Authorization", auth[role]!);

interface TodoBody {
  id: string;
  version: number;
  title: string;
  status: string;
  priority: string;
  dueAt: string | null;
  completedAt: string | null;
  eventId: string | null;
  eventTitle: string | null;
  createdByName: string | null;
  [key: string]: unknown;
}
interface ListBody {
  todos: TodoBody[];
  total: number;
  limit: number;
  offset: number;
}

beforeAll(async () => {
  admin = await createFixtureUser("admin", "IT Todos Admin");
  smm = await createFixtureUser("social_media_manager", "IT Todos SMM");
  mm = await createFixtureUser("marketing_manager", "IT Todos MM");
  editor = await createFixtureUser("editor", "IT Todos Editor");
  for (const u of [admin, smm, mm, editor]) auth[u.role] = await bearerFor(u);
  const c = await as("social_media_manager", request(app).post("/api/v1/clients")).send({ businessName: `IT Todos Client ${stamp}` });
  clientId = (c.body as { client: { id: string } }).client.id;
  const o = await as("social_media_manager", request(app).post("/api/v1/clients")).send({ businessName: `IT Todos Other ${stamp}` });
  otherClientId = (o.body as { client: { id: string } }).client.id;
  const t = await as("admin", request(app).post("/api/v1/stage-templates")).send({ name: `IT Todos Tpl ${stamp}`, stages: ["A", "B"] });
  templateId = (t.body as { template: { id: string } }).template.id;
});

afterAll(async () => {
  const owners = [admin, smm, mm, editor].filter(Boolean).map((u) => u.id);
  // Clients cascade their to-dos.
  await deleteClientsOwnedBy(owners);
  if (templateId) await deleteStageTemplates([templateId]);
  for (const id of owners) await deleteFixtureUser(id);
  await closeDb();
});

async function create(body: Record<string, unknown> = {}, role = "social_media_manager", cid = clientId): Promise<TodoBody> {
  const res = await as(role, request(app).post(`/api/v1/clients/${cid}/todos`)).send({ title: `IT todo ${stamp}`, ...body });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return (res.body as { todo: TodoBody }).todo;
}
const list = async (qs = "", role = "social_media_manager", cid = clientId) =>
  (await as(role, request(app).get(`/api/v1/clients/${cid}/todos?${qs}`))).body as ListBody;

describe("client to-dos (integration)", () => {
  it("creates a to-do: todo/medium by default, with the creator's name", async () => {
    const t = await create({ description: "Book the studio" });
    expect(t.status).toBe("todo");
    expect(t.priority).toBe("medium");
    expect(t.version).toBe(1);
    expect(t.completedAt).toBeNull();
    expect(t.createdByName).toBe("IT Todos SMM");
  });

  it("rejects an empty title, a bad priority and a due date without an offset with 400", async () => {
    const post = (b: Record<string, unknown>) => as("social_media_manager", request(app).post(`/api/v1/clients/${clientId}/todos`)).send(b);
    expect((await post({ title: "  " })).status).toBe(400);
    expect((await post({ title: "x", priority: "asap" })).status).toBe(400);
    expect((await post({ title: "x", dueAt: "2026-10-20" })).status).toBe(400);
    expect((await post({ title: "x".repeat(201) })).status).toBe(400);
  });

  it("marks done (completed_at set) and reopens (cleared); done leaves the open list", async () => {
    const t = await create({ title: `Flip-${stamp}` });
    const done = await as("social_media_manager", request(app).patch(`/api/v1/client-todos/${t.id}`)).send({ status: "done", version: t.version });
    expect(done.status, JSON.stringify(done.body)).toBe(200);
    const d = (done.body as { todo: TodoBody }).todo;
    expect(d.status).toBe("done");
    expect(d.completedAt).not.toBeNull();
    expect(d.version).toBe(t.version + 1);
    expect((await list(`search=Flip-${stamp}`)).total).toBe(0); // open list
    expect((await list(`search=Flip-${stamp}&status=done`)).total).toBe(1);
    const reopened = await as("social_media_manager", request(app).patch(`/api/v1/client-todos/${t.id}`)).send({ status: "in_progress", version: d.version });
    const r = (reopened.body as { todo: TodoBody }).todo;
    expect(r.status).toBe("in_progress");
    expect(r.completedAt).toBeNull();
    expect((await list(`search=Flip-${stamp}`)).total).toBe(1);
  });

  it("filters: status, priority, overdue, due range, search (wildcards escaped), and orders by due date", async () => {
    const past = await create({ title: `Filt-past-${stamp}`, dueAt: "2020-01-01T00:00:00Z", priority: "urgent" });
    await create({ title: `Filt-future-${stamp}`, dueAt: "2099-01-01T00:00:00Z", priority: "low" });
    await create({ title: `Filt-nodue-${stamp}` });
    const finished = await create({ title: `Filt-done-${stamp}`, dueAt: "2020-02-01T00:00:00Z" });
    await as("social_media_manager", request(app).patch(`/api/v1/client-todos/${finished.id}`)).send({ status: "done", version: finished.version });

    const all = await list(`search=Filt-&limit=100`);
    expect(all.todos.map((t) => t.title)).toEqual([`Filt-past-${stamp}`, `Filt-future-${stamp}`, `Filt-nodue-${stamp}`]); // soonest due first, no due last, done excluded
    expect((await list(`search=Filt-&status=all&limit=100`)).total).toBe(4); // open + done
    expect((await list(`search=Filt-&status=done`)).todos.map((t) => t.title)).toEqual([`Filt-done-${stamp}`]);
    expect((await list(`search=Filt-&priority=urgent`)).todos.map((t) => t.id)).toEqual([past.id]);
    // Overdue = past due and not done: the done one (also past due) is excluded.
    expect((await list(`search=Filt-&overdue=true`)).todos.map((t) => t.id)).toEqual([past.id]);
    expect((await list(`search=Filt-&dueFrom=2098-01-01T00:00:00Z&dueTo=2100-01-01T00:00:00Z`)).total).toBe(1);
    expect((await list(`search=Filt-&dueFrom=2021-01-01T00:00:00Z&dueTo=2022-01-01T00:00:00Z`)).total).toBe(0);
    expect((await list(`search=FILT-PAST-${stamp}`)).total).toBe(1); // case-insensitive
    expect((await list(`search=50%25_zz`)).total).toBe(0);
    const reversed = await as("social_media_manager", request(app).get(`/api/v1/clients/${clientId}/todos?dueFrom=2026-10-15T00:00:00Z&dueTo=2026-10-14T00:00:00Z`));
    expect(reversed.status).toBe(400);
    expect((reversed.body as { code: string }).code).toBe("CLIENT_TODO_RANGE_INVALID");
    expect((await as("social_media_manager", request(app).get(`/api/v1/clients/${clientId}/todos?status=blocked`))).status).toBe(400);
    expect((await as("social_media_manager", request(app).get(`/api/v1/clients/${clientId}/todos?limit=abc`))).status).toBe(400);
  });

  it("paginates with a total and caps the page size", async () => {
    const res = await list(`limit=1&offset=1`);
    expect(res.todos).toHaveLength(1);
    expect(res.total).toBeGreaterThan(1);
    expect((await list(`limit=100000`)).limit).toBe(100);
  });

  it("links an event of the same client only (400 CLIENT_TODO_EVENT_INVALID otherwise); null unlinks", async () => {
    const ev = await as("social_media_manager", request(app).post("/api/v1/events")).send({
      clientId, templateId, title: `IT Todo Event ${stamp}`, type: "shoot", startsAt: "2031-01-01T10:00:00Z", endsAt: "2031-01-01T11:00:00Z",
    });
    expect(ev.status, JSON.stringify(ev.body)).toBe(201);
    const eventId = (ev.body as { event: { id: string } }).event.id;
    const t = await create({ eventId });
    expect(t.eventId).toBe(eventId);
    expect(t.eventTitle).toBe(`IT Todo Event ${stamp}`);
    const wrong = await as("social_media_manager", request(app).post(`/api/v1/clients/${otherClientId}/todos`)).send({ title: "x", eventId });
    expect(wrong.status).toBe(400);
    expect((wrong.body as { code: string }).code).toBe("CLIENT_TODO_EVENT_INVALID");
    const missing = await as("social_media_manager", request(app).patch(`/api/v1/client-todos/${t.id}`)).send({ eventId: "11111111-1111-4111-8111-111111111111", version: 1 });
    expect(missing.status).toBe(400);
    expect((missing.body as { code: string }).code).toBe("CLIENT_TODO_EVENT_INVALID");
    const un = await as("social_media_manager", request(app).patch(`/api/v1/client-todos/${t.id}`)).send({ eventId: null, version: 1 });
    expect(un.status).toBe(200);
    expect((un.body as { todo: TodoBody }).todo.eventId).toBeNull();
  });

  it("row scope: another manager's client and to-do are 404, task-only staff 403, admin sees all", async () => {
    const t = await create();
    const mmGet = await as("marketing_manager", request(app).get(`/api/v1/clients/${clientId}/todos`));
    expect(mmGet.status).toBe(404);
    expect((mmGet.body as { code: string }).code).toBe("CLIENT_NOT_FOUND");
    expect((await as("marketing_manager", request(app).post(`/api/v1/clients/${clientId}/todos`)).send({ title: "x" })).status).toBe(404);
    const mmPatch = await as("marketing_manager", request(app).patch(`/api/v1/client-todos/${t.id}`)).send({ title: "x", version: 1 });
    expect(mmPatch.status).toBe(404);
    expect((mmPatch.body as { code: string }).code).toBe("CLIENT_TODO_NOT_FOUND");
    // Visibility beats version: a stale version on someone else's to-do is still a 404.
    expect((await as("marketing_manager", request(app).patch(`/api/v1/client-todos/${t.id}`)).send({ title: "x", version: 99 })).status).toBe(404);
    expect((await as("marketing_manager", request(app).delete(`/api/v1/client-todos/${t.id}`))).status).toBe(404);
    for (const [method, path] of [["get", `/api/v1/clients/${clientId}/todos`], ["post", `/api/v1/clients/${clientId}/todos`], ["patch", `/api/v1/client-todos/${t.id}`], ["delete", `/api/v1/client-todos/${t.id}`]] as const) {
      const res = await as("editor", request(app)[method](path)).send({ title: "x", version: 1 });
      expect(res.status, `${method} ${path}`).toBe(403);
    }
    expect((await list("", "admin")).total).toBeGreaterThan(0);
    expect((await as("admin", request(app).patch(`/api/v1/client-todos/${t.id}`)).send({ title: "Admin edit", version: t.version })).status).toBe(200);
    expect((await request(app).get(`/api/v1/clients/${clientId}/todos`)).status).toBe(401);
    expect((await as("admin", request(app).get("/api/v1/clients/not-a-uuid/todos"))).status).toBe(404);
    expect((await as("admin", request(app).patch("/api/v1/client-todos/not-a-uuid")).send({ title: "x", version: 1 })).status).toBe(404);
    expect((await as("admin", request(app).get("/api/v1/clients/11111111-1111-4111-8111-111111111111/todos"))).status).toBe(404);
  });

  it("edits with the optimistic lock (409 CLIENT_TODO_MODIFIED) and refuses an empty patch", async () => {
    const t = await create({ title: `Lock-${stamp}` });
    const ok = await as("social_media_manager", request(app).patch(`/api/v1/client-todos/${t.id}`)).send({ title: "Renamed", priority: "high", dueAt: "2031-05-01T09:00:00+05:30", version: t.version });
    expect(ok.status).toBe(200);
    const edited = (ok.body as { todo: TodoBody }).todo;
    expect(edited.version).toBe(t.version + 1);
    expect(edited.priority).toBe("high");
    expect(edited.dueAt).toBe("2031-05-01T03:30:00.000Z");
    const stale = await as("social_media_manager", request(app).patch(`/api/v1/client-todos/${t.id}`)).send({ title: "Again", version: t.version });
    expect(stale.status).toBe(409);
    expect((stale.body as { code: string }).code).toBe("CLIENT_TODO_MODIFIED");
    const none = await as("social_media_manager", request(app).patch(`/api/v1/client-todos/${t.id}`)).send({ version: edited.version });
    expect(none.status).toBe(400);
    const noVersion = await as("social_media_manager", request(app).patch(`/api/v1/client-todos/${t.id}`)).send({ title: "x" });
    expect(noVersion.status).toBe(400);
  });

  it("hard delete: stale version is 409, then gone (second delete 404)", async () => {
    const t = await create({ title: `Gone-${stamp}` });
    const stale = await as("social_media_manager", request(app).delete(`/api/v1/client-todos/${t.id}?version=99`));
    expect(stale.status).toBe(409);
    expect((stale.body as { code: string }).code).toBe("CLIENT_TODO_MODIFIED");
    expect((await as("social_media_manager", request(app).delete(`/api/v1/client-todos/${t.id}?version=${t.version}`))).status).toBe(204);
    expect((await list(`search=Gone-${stamp}`)).total).toBe(0);
    expect((await as("social_media_manager", request(app).delete(`/api/v1/client-todos/${t.id}`))).status).toBe(404);
  });

  it("an archived client's to-dos are readable but read-only (409 CLIENT_ARCHIVED); unarchiving restores writes", async () => {
    const c = await as("social_media_manager", request(app).post("/api/v1/clients")).send({ businessName: `IT Todos Archive ${stamp}` });
    const cid = (c.body as { client: { id: string } }).client.id;
    const t = await create({}, "social_media_manager", cid);
    expect((await as("admin", request(app).post(`/api/v1/clients/${cid}/archive`)).send({})).status).toBe(200);
    expect((await list("", "social_media_manager", cid)).total).toBe(1);
    const edit = await as("social_media_manager", request(app).patch(`/api/v1/client-todos/${t.id}`)).send({ title: "x", version: t.version });
    expect(edit.status).toBe(409);
    expect((edit.body as { code: string }).code).toBe("CLIENT_ARCHIVED");
    expect((await as("social_media_manager", request(app).delete(`/api/v1/client-todos/${t.id}`))).status).toBe(409);
    const add = await as("social_media_manager", request(app).post(`/api/v1/clients/${cid}/todos`)).send({ title: "x" });
    expect(add.status).toBe(409);
    expect((add.body as { code: string }).code).toBe("CLIENT_ARCHIVED");
    await as("admin", request(app).post(`/api/v1/clients/${cid}/unarchive`)).send({});
    expect((await as("social_media_manager", request(app).patch(`/api/v1/client-todos/${t.id}`)).send({ title: "ok", version: t.version })).status).toBe(200);
  });

  it("is never exposed on the portal", async () => {
    const link = await as("social_media_manager", request(app).post(`/api/v1/portal-links/${clientId}`));
    expect(link.status, JSON.stringify(link.body)).toBe(201);
    const token = (link.body as { token: string }).token;
    for (const p of ["todos", "client-todos"]) expect((await request(app).get(`/api/v1/portal/${token}/${p}`)).status).toBe(404);
    const dash = await request(app).get(`/api/v1/portal/${token}`);
    expect(JSON.stringify(dash.body)).not.toContain(`IT todo ${stamp}`);
  });
});
