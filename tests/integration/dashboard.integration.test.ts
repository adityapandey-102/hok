import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";
import type { Dashboard } from "../../src/modules/dashboard/domain/dashboard.entity";
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
 * M10 against the real local stack: each role gets only its sections, the
 * figures count the right rows (own scope for tasks and clients, firm-wide
 * for Admin), and "today" follows the viewer's zone.
 */
const app = createApp();
let admin: FixtureUser;
let manager: FixtureUser;
let otherManager: FixtureUser;
let editor: FixtureUser;
type Who = "admin" | "manager" | "other" | "editor";
let auth: Record<Who, string>;
const templateIds: string[] = [];
let clientId: string;

const dashboard = async (who: Who): Promise<Dashboard> => {
  const res = await request(app).get("/api/v1/dashboard").set("Authorization", auth[who]);
  expect(res.status).toBe(200);
  return res.body as Dashboard;
};
/** The `id` of the record a create returned under `key` (e.g. { client: { id } }). */
const idOf = (res: request.Response, key: string) => (res.body as Record<string, { id: string }>)[key]!.id;
const HOUR = 60 * 60 * 1000;
const iso = (ms: number) => new Date(ms).toISOString();

beforeAll(async () => {
  [admin, manager, otherManager, editor] = await Promise.all([
    createFixtureUser("admin", "Dash Admin"),
    createFixtureUser("social_media_manager", "Dash Manager"),
    createFixtureUser("marketing_manager", "Dash Other"),
    createFixtureUser("editor", "Dash Editor"),
  ]);
  const [a, m, o, e] = await Promise.all([admin, manager, otherManager, editor].map(bearerFor));
  auth = { admin: a!, manager: m!, other: o!, editor: e! };

  // The manager's client: one event happening now, one in 3 days, one comment from the portal.
  const c = await request(app).post("/api/v1/clients").set("Authorization", auth.manager).send({ businessName: "Dash Test Studio" });
  clientId = idOf(c, "client");
  const t = await request(app).post("/api/v1/stage-templates").set("Authorization", auth.admin).send({ name: `IT Dash Tpl ${Date.now()}`, stages: ["Brief", "Shoot"] });
  templateIds.push(idOf(t, "template"));
  const now = Date.now();
  for (const [title, start] of [["Dash now", now - HOUR], ["Dash later", now + 3 * 24 * HOUR]] as const) {
    const e = await request(app)
      .post("/api/v1/events")
      .set("Authorization", auth.manager)
      .send({ clientId, templateId: templateIds[0], title, type: "shoot", startsAt: iso(start), endsAt: iso(start + 2 * HOUR) });
    expect(e.status).toBe(201);
  }
  const link = await request(app).post(`/api/v1/portal-links/${clientId}`).set("Authorization", auth.manager);
  expect((await request(app).post(`/api/v1/portal/${(link.body as { token: string }).token}/comments`).send({ body: "Dash test comment" })).status).toBe(201);

  // The editor's tasks: one overdue, one due later today, one done; the Admin comments on one.
  const { window } = await dashboard("editor");
  const tasks = [
    { title: "Dash overdue", dueAt: iso(now - 24 * HOUR) },
    { title: "Dash due today", dueAt: iso(Date.parse(window.tomorrowStart) - 60_000) },
    { title: "Dash finished", dueAt: null },
  ];
  const ids: string[] = [];
  for (const task of tasks) {
    const r = await request(app)
      .post("/api/v1/staff-tasks")
      .set("Authorization", auth.admin)
      .send({ ...task, assigneeId: editor.id, rawFilesUrl: "https://drive.example.com/raw" });
    expect(r.status).toBe(201);
    ids.push(idOf(r, "task"));
  }
  const done = await request(app).get(`/api/v1/staff-tasks/${ids[2]}`).set("Authorization", auth.editor);
  expect(
    (await request(app).post(`/api/v1/staff-tasks/${ids[2]}/status`).set("Authorization", auth.editor).send({ status: "done", version: (done.body as { task: { version: number } }).task.version }))
      .status,
  ).toBe(200);
  expect((await request(app).post(`/api/v1/staff-tasks/${ids[0]}/comments`).set("Authorization", auth.admin).send({ body: "Please hurry" })).status).toBe(201);
  expect((await request(app).post(`/api/v1/staff-tasks/${ids[0]}/comments`).set("Authorization", auth.editor).send({ body: "On it" })).status).toBe(201);
});

afterAll(async () => {
  await deleteStaffTasksFor([editor.id]);
  await deleteClientsOwnedBy([manager.id, otherManager.id]);
  await deleteStageTemplates(templateIds);
  for (const u of [admin, manager, otherManager, editor]) await deleteFixtureUser(u.id);
  await closeDb();
});

describe("GET /api/v1/dashboard", () => {
  it("requires a session", async () => {
    expect((await request(app).get("/api/v1/dashboard")).status).toBe(401);
  });

  it("gives task-only staff their own tasks only", async () => {
    const d = await dashboard("editor");
    expect(d.role).toBe("editor");
    expect(d.clients).toBeNull();
    expect(d.firm).toBeNull();
    expect(d.window.timeZone).toBe("Asia/Kolkata");
    expect(d.tasks.counts).toEqual({ todo: 2, in_progress: 0, blocked: 0, done: 1 });
    expect(d.tasks.overdue).toBe(1);
    expect(d.tasks.dueToday).toBe(1);
    // Overdue first, then soonest due; the done task is not listed.
    expect(d.tasks.open.map((t) => t.title)).toEqual(["Dash overdue", "Dash due today"]);
    // Only other people's comments.
    expect(d.tasks.recentComments.map((c) => [c.comment, c.authorName])).toEqual([["Please hurry", "Dash Admin"]]);
  });

  it("gives a manager their own clients' figures and no firm section", async () => {
    const d = await dashboard("manager");
    expect(d.firm).toBeNull();
    expect(d.clients!.clientCount).toBe(1);
    expect(d.clients!.today.map((e) => e.title)).toEqual(["Dash now"]);
    expect(d.clients!.upcoming.map((e) => e.title)).toEqual(["Dash later"]);
    expect(d.clients!.today[0]).toMatchObject({ clientName: "Dash Test Studio", currentStageName: "Brief", currentStagePosition: 1, stageCount: 2 });
    expect(d.clients!.byStage).toEqual([{ stageName: "Brief", count: 2 }]);
    expect(d.clients!.unresolvedComments).toEqual({ received: 1, inProgress: 0 });
    expect(d.clients!.latestComments).toHaveLength(1);
    expect(d.clients!.latestComments[0]).toMatchObject({ clientId, excerpt: "Dash test comment", status: "received" });
  });

  it("never shows another manager's clients", async () => {
    const d = await dashboard("other");
    expect(d.clients).toMatchObject({ clientCount: 0, today: [], upcoming: [], byStage: [], latestComments: [] });
    expect(d.clients!.unresolvedComments).toEqual({ received: 0, inProgress: 0 });
  });

  it("gives Admin the firm: totals, the team's workload and the manager's events", async () => {
    const d = await dashboard("admin");
    expect(d.firm!.totals.clients).toBeGreaterThanOrEqual(1);
    expect(d.firm!.totals.unresolvedComments).toBeGreaterThanOrEqual(1);
    expect(d.firm!.totals.openTasks).toBe(d.firm!.tasksByStatus.todo + d.firm!.tasksByStatus.in_progress + d.firm!.tasksByStatus.blocked);
    const row = d.firm!.team.find((r) => r.userId === editor.id);
    expect(row).toMatchObject({ name: "Dash Editor", role: "editor", open: 2, overdue: 1, doneThisWeek: 1 });
    expect(d.firm!.team.some((r) => r.role === "admin")).toBe(false);
    expect(d.firm!.week.some((e) => e.title === "Dash now")).toBe(true);
    // Admin's own-clients block is their own (none) — not the firm's.
    expect(d.clients!.clientCount).toBe(0);
  });
});
