import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";
import type { ActivityPage } from "../../src/modules/activity/domain/activity.entity";
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
 * The activity log against the real local stack: every source shows with the
 * right sentence, kind and person filters narrow it, the range is validated,
 * only the Admin may read it, and paging is stable. Fixture rows are removed.
 */
const app = createApp();
let admin: FixtureUser;
let manager: FixtureUser;
let editor: FixtureUser;
let auth: { admin: string; manager: string; editor: string };
const templateIds: string[] = [];
let clientId: string;
let eventId: string;
let taskId: string;
const tag = `Act${Date.now().toString(36)}`;

type Json = Record<string, unknown>;
const idOf = (res: request.Response, key: string) => (res.body as Record<string, { id: string }>)[key]!.id;

async function feed(query = ""): Promise<ActivityPage> {
  const res = await request(app).get(`/api/v1/activity${query ? `?${query}` : ""}`).set("Authorization", auth.admin);
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body as ActivityPage;
}
const summaries = (p: ActivityPage) => p.items.map((i) => i.summary);

beforeAll(async () => {
  [admin, manager, editor] = await Promise.all([
    createFixtureUser("admin", `${tag} Admin`),
    createFixtureUser("social_media_manager", `${tag} Manager`),
    createFixtureUser("editor", `${tag} Editor`),
  ]);
  const [a, m, e] = await Promise.all([admin, manager, editor].map(bearerFor));
  auth = { admin: a!, manager: m!, editor: e! };

  // Manager: a client, a portal link, an asset, an event with a stage move. (client.created, portal_link.generated, asset.created, event.created, stage move)
  const c = await request(app).post("/api/v1/clients").set("Authorization", auth.manager).send({ businessName: `${tag} Cafe` });
  clientId = idOf(c, "client");
  const t = await request(app).post("/api/v1/stage-templates").set("Authorization", auth.admin).send({ name: `${tag} Tpl`, stages: ["Brief", "Approval"] });
  templateIds.push(idOf(t, "template"));
  const hour = 3600_000;
  const start = Date.now() + 24 * hour;
  const ev = await request(app)
    .post("/api/v1/events")
    .set("Authorization", auth.manager)
    .send({ clientId, templateId: templateIds[0], title: `${tag} Brand shoot`, type: "shoot", startsAt: new Date(start).toISOString(), endsAt: new Date(start + 2 * hour).toISOString() });
  expect(ev.status, JSON.stringify(ev.body)).toBe(201);
  const event = (ev.body as { event: { id: string; version: number; stages: { id: string; name: string }[] } }).event;
  eventId = event.id;
  const move = await request(app)
    .post(`/api/v1/events/${eventId}/stage`)
    .set("Authorization", auth.manager)
    .send({ stageId: event.stages.find((s) => s.name === "Approval")!.id, version: event.version });
  expect(move.status, JSON.stringify(move.body)).toBe(200);
  expect((await request(app).post("/api/v1/assets").set("Authorization", auth.manager).send({ clientId, title: `${tag} Raw clips`, url: "https://drive.google.com/drive/folders/act", type: "video" })).status).toBe(201);
  const link = await request(app).post(`/api/v1/portal-links/${clientId}`).set("Authorization", auth.manager);
  expect(link.status).toBe(201);
  const token = (link.body as { token: string }).token;

  // A client comment, then the manager marks it In progress.
  const cm = await request(app).post(`/api/v1/portal/${token}/comments`).send({ body: "SECRET-COMMENT-BODY" });
  expect(cm.status).toBe(201);
  const comment = (cm.body as { comment: { id: string } }).comment;
  const got = await request(app).get(`/api/v1/client-comments/${comment.id}`).set("Authorization", auth.manager);
  const version = ((got.body as Json).comment as { version: number }).version;
  expect((await request(app).patch(`/api/v1/client-comments/${comment.id}`).set("Authorization", auth.manager).send({ status: "in_progress", version })).status).toBe(200);

  // Admin assigns a task to the editor; the editor moves it to In progress.
  const task = await request(app)
    .post("/api/v1/staff-tasks")
    .set("Authorization", auth.admin)
    .send({ title: `${tag} Edit the reel`, assigneeId: editor.id, rawFilesUrl: "https://drive.example.com/raw" });
  expect(task.status, JSON.stringify(task.body)).toBe(201);
  taskId = idOf(task, "task");
  const tv = ((task.body as Json).task as { version: number }).version;
  expect((await request(app).post(`/api/v1/staff-tasks/${taskId}/status`).set("Authorization", auth.editor).send({ status: "in_progress", version: tv })).status).toBe(200);
});

afterAll(async () => {
  await deleteStaffTasksFor([editor.id]);
  await deleteClientsOwnedBy([manager.id]);
  await deleteStageTemplates(templateIds);
  for (const u of [admin, manager, editor]) await deleteFixtureUser(u.id);
  await closeDb();
});

describe("GET /api/v1/activity", () => {
  it("is Admin only", async () => {
    expect((await request(app).get("/api/v1/activity")).status).toBe(401);
    for (const who of ["manager", "editor"] as const) {
      const res = await request(app).get("/api/v1/activity").set("Authorization", auth[who]);
      expect(res.status, who).toBe(403);
    }
  });

  it("shows every source with its plain-English sentence", async () => {
    const all = await feed("limit=50");
    const text = summaries(all);
    expect(text).toContain(`${tag} Manager added the client ${tag} Cafe`);
    expect(text).toContain(`${tag} Manager created the event ${tag} Brand shoot`);
    expect(text).toContain(`${tag} Manager moved ${tag} Brand shoot to Approval`);
    expect(text).toContain(`${tag} Manager added the asset ${tag} Raw clips`);
    expect(text).toContain(`${tag} Manager created a portal link for ${tag} Cafe`);
    expect(text).toContain(`${tag} Cafe posted a comment`);
    expect(text).toContain(`${tag} Manager marked a comment from ${tag} Cafe as In progress`);
    expect(text).toContain(`${tag} Admin created the task ${tag} Edit the reel`);
    expect(text).toContain(`${tag} Editor marked ${tag} Edit the reel as In progress`);
    expect(text).toContain(`${tag} Admin created the stage template ${tag} Tpl`);
    // Newest first, and the total counts at least these.
    const times = all.items.map((i) => Date.parse(i.at));
    expect(times).toEqual([...times].sort((x, y) => y - x));
    expect(all.total).toBeGreaterThanOrEqual(text.length);
  });

  it("gives each item its kind, actor and link", async () => {
    const mine = (await feed(`actorId=${manager.id}&limit=50`)).items;
    const stage = mine.find((i) => i.summary.includes("moved"))!;
    expect(stage).toMatchObject({ kind: "events", actor: { id: manager.id, name: `${tag} Manager` }, url: `/app/events/${eventId}` });
    const client = mine.find((i) => i.summary.includes("added the client"))!;
    expect(client).toMatchObject({ kind: "clients", url: `/app/clients/${clientId}` });
    const task = (await feed(`kind=tasks&actorId=${editor.id}`)).items[0]!;
    expect(task).toMatchObject({ kind: "tasks", url: `/app/tasks/${taskId}` });
    const posted = (await feed("kind=comments")).items.find((i) => i.summary === `${tag} Cafe posted a comment`)!;
    expect(posted.actor).toBeNull();
  });

  it("filters by kind", async () => {
    for (const kind of ["clients", "events", "tasks", "comments", "assets", "accounts"] as const) {
      const p = await feed(`kind=${kind}&limit=50`);
      expect(p.items.length, kind).toBeGreaterThan(0);
      expect(new Set(p.items.map((i) => i.kind)), kind).toEqual(new Set([kind]));
    }
    const tasks = summaries(await feed("kind=tasks&limit=50"));
    expect(tasks.some((s) => s.includes("Edit the reel"))).toBe(true);
    expect(tasks.some((s) => s.includes("moved"))).toBe(false);
  });

  it("filters by person, and a client's own comment has no person", async () => {
    const p = await feed(`actorId=${editor.id}&limit=50`);
    expect(p.items.every((i) => i.actor?.id === editor.id)).toBe(true);
    expect(summaries(p)).toContain(`${tag} Editor marked ${tag} Edit the reel as In progress`);
    expect(summaries(await feed(`actorId=${manager.id}&limit=50`))).not.toContain(`${tag} Cafe posted a comment`);
  });

  it("never exposes comment bodies, tokens or raw status codes", async () => {
    const json = JSON.stringify((await feed("limit=50")).items);
    expect(json).not.toContain("SECRET-COMMENT-BODY");
    expect(json).not.toMatch(/in_progress|"token"|portal_token/);
    expect(json).not.toContain("drive.google.com");
  });

  it("bounds the range with respect to from/to", async () => {
    const future = new Date(Date.now() + 3600_000).toISOString();
    const farPast = new Date(Date.now() - 20 * 86400_000).toISOString();
    const nearPast = new Date(Date.now() - 19 * 86400_000).toISOString();
    expect((await feed(`from=${farPast}&to=${nearPast}&actorId=${manager.id}`)).total).toBe(0);
    const recent = await feed(`from=${new Date(Date.now() - 3600_000).toISOString()}&to=${future}&actorId=${manager.id}`);
    expect(recent.total).toBeGreaterThan(0);
  });

  it("rejects a bad range or query with a 400", async () => {
    const a = "2026-01-01T00:00:00Z";
    const over = await request(app).get(`/api/v1/activity?from=${a}&to=2026-03-01T00:00:00Z`).set("Authorization", auth.admin);
    expect(over.status).toBe(400);
    expect((over.body as { code: string }).code).toBe("ACTIVITY_RANGE_INVALID");
    const inverted = await request(app).get(`/api/v1/activity?from=2026-02-01T00:00:00Z&to=${a}`).set("Authorization", auth.admin);
    expect(inverted.status).toBe(400);
    expect((inverted.body as { code: string }).code).toBe("ACTIVITY_RANGE_INVALID");
    for (const q of ["kind=bogus", "limit=51", "limit=abc", "from=yesterday", "actorId=nope", "offset=-1"]) {
      expect((await request(app).get(`/api/v1/activity?${q}`).set("Authorization", auth.admin)).status, q).toBe(400);
    }
  });

  it("pages without gaps or repeats", async () => {
    const q = `actorId=${manager.id}`;
    const whole = await feed(`${q}&limit=50`);
    expect(whole.total).toBe(whole.items.length);
    expect(whole.total).toBeGreaterThanOrEqual(5);
    const first = await feed(`${q}&limit=2&offset=0`);
    const second = await feed(`${q}&limit=2&offset=2`);
    expect(first).toMatchObject({ total: whole.total, limit: 2, offset: 0 });
    expect(first.items).toHaveLength(2);
    expect([...first.items, ...second.items].map((i) => i.id)).toEqual(whole.items.slice(0, 4).map((i) => i.id));
  });
});
