import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { createApp } from "../../src/app";
import { db } from "../../src/common/database/drizzle-client";
import { assets } from "../../src/modules/assets/infrastructure/assets.schema";
import { clientComments } from "../../src/modules/client-comments/infrastructure/client-comments.schema";
import { clientTodos } from "../../src/modules/client-todos/infrastructure/client-todos.schema";
import { staffTasks, staffTaskUpdates } from "../../src/modules/staff-tasks/infrastructure/staff-tasks.schema";
import { profiles } from "../../src/modules/users/infrastructure/profile.schema";
import { allowedMonths, monthWindow } from "../../src/modules/reports/domain/report.rules";
import type { ClientReport, StaffReport, TeamStatusPage } from "../../src/modules/reports/domain/report.entity";
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
 * Admin reports against the real local stack, with fixtures that give KNOWN
 * numbers: tasks done on time and late, events and comments inside and
 * outside the month, replies of known latency, plus the team-status rule
 * (working vs idle) and its filters and paging. Everything is cleaned up.
 */
const app = createApp();
const stamp = Date.now();
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

let admin: FixtureUser;
let manager: FixtureUser;
let person: FixtureUser; // marketing_agent: the staff-report subject
let busyDev: FixtureUser; // developer, open task, seen now -> working
let actingDev: FixtureUser; // developer, open task, never seen but acted -> working
let idleDev: FixtureUser; // developer, open task, not seen, no activity -> idle
let noTasks: FixtureUser; // editor, seen now but nothing open -> idle
let auth: Record<string, string>;
let clientId: string;
let templateId: string;
let tz: string;
let prevMonth: string;
let prevFrom: number;
let curMonth: string;
let curFrom: number;

const get = (path: string, who = "admin") => request(app).get(path).set("Authorization", auth[who]!);
const idOf = (res: request.Response, key: string) => (res.body as Record<string, { id: string }>)[key]!.id;
/** A mid-day instant `days` after the month's local midnight (DST-safe). */
const at = (from: number, days: number) => new Date(from + days * DAY + 12 * HOUR);

async function task(assignee: FixtureUser, v: { title: string; createdAt: Date; completedAt?: Date; dueAt?: Date; open?: boolean }) {
  const [t] = await db
    .insert(staffTasks)
    .values({
      title: `RPT ${stamp} ${v.title}`,
      assigneeId: assignee.id,
      assignedBy: admin.id,
      dueAt: v.dueAt ?? null,
      status: v.open ? "todo" : "done",
      completedAt: v.open ? null : (v.completedAt ?? null),
      createdAt: v.createdAt,
    })
    .returning({ id: staffTasks.id });
  return t!.id;
}

beforeAll(async () => {
  [admin, manager, person, busyDev, actingDev, idleDev, noTasks] = await Promise.all([
    createFixtureUser("admin", `RPT${stamp} Admin`),
    createFixtureUser("social_media_manager", `RPT${stamp} Manager`),
    createFixtureUser("marketing_agent", `RPT${stamp} Person`),
    createFixtureUser("developer", `RPT${stamp} Busy`),
    createFixtureUser("developer", `RPT${stamp} Acting`),
    createFixtureUser("developer", `RPT${stamp} Idle`),
    createFixtureUser("editor", `RPT${stamp} NoTasks`),
  ]);
  const [a, m] = await Promise.all([bearerFor(admin), bearerFor(manager)]);
  auth = { admin: a, manager: m };
  const [row] = await db.select({ tz: profiles.timeZone }).from(profiles).where(eq(profiles.id, admin.id));
  tz = row!.tz;
  const now = new Date();
  [curMonth, prevMonth] = allowedMonths(now, tz) as [string, string];
  curFrom = Date.parse(monthWindow(curMonth, now, tz).from);
  prevFrom = Date.parse(monthWindow(prevMonth, now, tz).from);
  const prevTo = Date.parse(monthWindow(prevMonth, now, tz).to);

  // ---- staff report: the subject's tasks (previous month) ----
  await task(person, { title: "on time", createdAt: at(prevFrom, 2), completedAt: at(prevFrom, 3), dueAt: at(prevFrom, 5) });
  await task(person, { title: "late", createdAt: at(prevFrom, 2), completedAt: at(prevFrom, 6), dueAt: at(prevFrom, 4) });
  await task(person, { title: "no due date", createdAt: at(prevFrom, 1), completedAt: at(prevFrom, 2) });
  await task(person, { title: "created before", createdAt: at(prevFrom, -5), completedAt: at(prevFrom, 7), dueAt: at(prevFrom, 9) });
  await task(person, { title: "open overdue", createdAt: at(prevFrom, 3), dueAt: at(prevFrom, 5), open: true });
  await task(person, { title: "open", createdAt: at(prevFrom, 20), open: true });
  await task(person, { title: "open now", createdAt: now, open: true });
  await task(person, { title: "done after", createdAt: at(prevFrom, -3), completedAt: new Date(prevTo + DAY) });

  // ---- team status ----
  await task(busyDev, { title: "busy open", createdAt: now, open: true, dueAt: new Date(now.getTime() + DAY) });
  const actingTask = await task(actingDev, { title: "acting open", createdAt: now, open: true });
  await task(idleDev, { title: "idle open", createdAt: now, open: true });
  await db.insert(staffTaskUpdates).values({ taskId: actingTask, authorId: actingDev.id, kind: "comment", comment: "working on it" });
  await db.update(profiles).set({ lastSeenAt: now }).where(eq(profiles.id, busyDev.id));
  await db.update(profiles).set({ lastSeenAt: now }).where(eq(profiles.id, noTasks.id));
  await db.update(profiles).set({ lastSeenAt: new Date(now.getTime() - 3 * DAY) }).where(eq(profiles.id, idleDev.id));

  // ---- client report: a client with events in and out of the current month ----
  const c = await request(app).post("/api/v1/clients").set("Authorization", auth.manager!).send({ businessName: `RPT ${stamp} Cafe` });
  clientId = idOf(c, "client");
  const t = await request(app).post("/api/v1/stage-templates").set("Authorization", auth.admin!).send({ name: `RPT Tpl ${stamp}`, stages: ["Plan", "Shoot", "Edit"] });
  templateId = idOf(t, "template");
  const mkEvent = async (title: string, type: string, startsAt: Date) => {
    const r = await request(app)
      .post("/api/v1/events")
      .set("Authorization", auth.manager!)
      .send({ clientId, templateId, title, type, startsAt: startsAt.toISOString(), endsAt: new Date(startsAt.getTime() + 2 * HOUR).toISOString() });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    return (r.body as { event: { id: string; version: number; stages: { id: string }[] } }).event;
  };
  const e1 = await mkEvent("RPT shoot", "shoot", at(curFrom, 0));
  const e2 = await mkEvent("RPT meeting", "meeting", at(curFrom, 0));
  await mkEvent("RPT last month", "shoot", at(prevFrom, 3));
  // Two stage moves on e1, and e2 cancelled.
  const m1 = await request(app).post(`/api/v1/events/${e1.id}/stage`).set("Authorization", auth.manager!).send({ stageId: e1.stages[1]!.id, version: e1.version });
  expect(m1.status, JSON.stringify(m1.body)).toBe(200);
  const m2 = await request(app).post(`/api/v1/events/${e1.id}/stage`).set("Authorization", auth.manager!).send({ stageId: e1.stages[2]!.id, version: e1.version + 1 });
  expect(m2.status, JSON.stringify(m2.body)).toBe(200);
  const cancel = await request(app).patch(`/api/v1/events/${e2.id}`).set("Authorization", auth.manager!).send({ state: "cancelled", version: e2.version });
  expect(cancel.status, JSON.stringify(cancel.body)).toBe(200);

  // Comments: three received this month (replied after 2 h and 4 h, one unanswered), one last month.
  const posted = at(curFrom, 0);
  await db.insert(clientComments).values([
    { clientId, body: "RPT solved", status: "solved", createdAt: posted, reply: "Done", repliedBy: manager.id, repliedAt: new Date(posted.getTime() + 2 * HOUR) },
    { clientId, body: "RPT in progress", status: "in_progress", createdAt: posted, reply: "On it", repliedBy: manager.id, repliedAt: new Date(posted.getTime() + 4 * HOUR) },
    { clientId, body: "RPT unanswered", status: "received", createdAt: posted },
    { clientId, body: "RPT last month", status: "solved", createdAt: at(prevFrom, 4), reply: "ok", repliedBy: manager.id, repliedAt: at(prevFrom, 5) },
  ]);
  // To-dos: two finished this month, one finished last month, two open.
  await db.insert(clientTodos).values([
    { clientId, title: "RPT done 1", status: "done", completedAt: at(curFrom, 0) },
    { clientId, title: "RPT done 2", status: "done", completedAt: at(curFrom, 0) },
    { clientId, title: "RPT done last month", status: "done", completedAt: at(prevFrom, 2) },
    { clientId, title: "RPT open 1", status: "todo" },
    { clientId, title: "RPT open 2", status: "in_progress" },
  ]);
  // Assets: two this month, one deleted this month, one last month.
  const asset = (title: string, createdAt: Date, deletedAt: Date | null = null) => ({
    clientId,
    title,
    url: `https://example.test/rpt/${stamp}/${title}`,
    type: "photo" as const,
    createdBy: manager.id,
    createdAt,
    deletedAt,
  });
  await db.insert(assets).values([asset("a1", at(curFrom, 0)), asset("a2", at(curFrom, 0)), asset("gone", at(curFrom, 0), new Date()), asset("old", at(prevFrom, 2))]);
}, 60_000);

afterAll(async () => {
  const users = [admin, manager, person, busyDev, actingDev, idleDev, noTasks].filter(Boolean);
  const ids = users.map((u) => u.id);
  await deleteStaffTasksFor(ids); // their timelines cascade
  await deleteClientsOwnedBy(ids); // comments and to-dos cascade with the client
  if (templateId) await deleteStageTemplates([templateId]);
  for (const id of ids) await deleteFixtureUser(id);
  await closeDb();
});

describe("reports: access", () => {
  const paths = () => [
    "/api/v1/reports/team-status",
    `/api/v1/reports/staff?userId=${person.id}&month=${prevMonth}`,
    `/api/v1/reports/client?clientId=${clientId}&month=${curMonth}`,
  ];
  it("is Admin only: a manager gets 403 and no token 401", async () => {
    for (const p of paths()) {
      expect((await get(p, "manager")).status, p).toBe(403);
      expect((await request(app).get(p)).status, p).toBe(401);
      expect((await get(p)).status, p).toBe(200);
    }
  });
});

describe("team status", () => {
  const page = async (qs: string) => {
    const res = await get(`/api/v1/reports/team-status?search=RPT${stamp}&${qs}`);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    return res.body as TeamStatusPage;
  };
  const byName = (p: TeamStatusPage, suffix: string) => p.members.find((m) => m.name === `RPT${stamp} ${suffix}`)!;

  it("applies the working / idle rule and the counts", async () => {
    const p = await page("limit=50");
    expect(p.total).toBe(6); // the admin is not a staff row; the manager is (idle, nothing open)
    expect(p.rule.windowHours).toBe(24);
    expect(byName(p, "Busy")).toMatchObject({ status: "working", openTasks: 1, overdue: 0 });
    expect(byName(p, "Acting")).toMatchObject({ status: "working", openTasks: 1, lastSeenAt: null });
    expect(byName(p, "Acting").activityLast24h).toBeGreaterThanOrEqual(1);
    expect(byName(p, "Idle")).toMatchObject({ status: "idle", openTasks: 1, activityLast24h: 0 });
    expect(byName(p, "NoTasks")).toMatchObject({ status: "idle", openTasks: 0 });
    // The subject has 3 open tasks, 1 overdue.
    expect(byName(p, "Person")).toMatchObject({ openTasks: 3, overdue: 1 });
  });

  it("filters by status, role and search on the server, and pages", async () => {
    const working = await page("status=working");
    expect(working.total).toBe(2);
    expect(working.members.map((m) => m.status)).toEqual(["working", "working"]);
    const idle = await page("status=idle");
    expect(idle.total).toBe(4);
    expect((await page("role=developer")).total).toBe(3);
    expect((await page("role=developer&status=working")).total).toBe(2);
    const second = await page("limit=2&offset=2");
    expect(second).toMatchObject({ total: 6, limit: 2, offset: 2 });
    expect(second.members).toHaveLength(2);
    expect((await get(`/api/v1/reports/team-status?search=zzz-no-one-${stamp}`)).body).toMatchObject({ total: 0, members: [] });
  });

  it("is strict about its query", async () => {
    expect((await get("/api/v1/reports/team-status?status=busy")).status).toBe(400);
    expect((await get("/api/v1/reports/team-status?role=admin")).status).toBe(400);
    expect((await get("/api/v1/reports/team-status?limit=abc")).status).toBe(400);
    expect(((await get("/api/v1/reports/team-status?limit=100000")).body as TeamStatusPage).limit).toBe(50);
  });
});

describe("staff report", () => {
  const report = async (month = prevMonth, userId = person.id) => get(`/api/v1/reports/staff?userId=${userId}&month=${month}`);

  it("counts assigned, completed, on time vs late, average days and the live set", async () => {
    const res = await report();
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const r = res.body as StaffReport;
    expect(r.person).toMatchObject({ userId: person.id, name: `RPT${stamp} Person`, role: "marketing_agent" });
    expect(r.month).toMatchObject({ month: prevMonth, timeZone: tz });
    expect(r).toMatchObject({ assigned: 5, completed: 4, onTime: 3, late: 1, openNow: 3, overdueNow: 1 });
    // 1 + 4 + 1 + 12 days over 4 completed tasks.
    expect(r.avgDaysToComplete).toBe(4.5);
  });

  it("the weekly series adds up to the month and its days are contiguous", async () => {
    const r = (await report()).body as StaffReport;
    expect(r.weeks.reduce((n, w) => n + w.assigned, 0)).toBe(5);
    expect(r.weeks.reduce((n, w) => n + w.completed, 0)).toBe(4);
    expect(r.weeks[0]!.startDay).toBe(`${prevMonth}-01`);
    r.weeks.slice(1).forEach((w, i) => expect(w.startDay > r.weeks[i]!.endDay).toBe(true));
  });

  it("a month with no tasks is zeros and a null average, not an error", async () => {
    const months = allowedMonths(new Date(), tz);
    const r = (await report(months[5])).body as StaffReport;
    expect(r).toMatchObject({ assigned: 0, completed: 0, onTime: 0, late: 0, avgDaysToComplete: null });
  });

  it("refuses a month outside the last 6, a malformed one and an unknown person", async () => {
    const future = await report("2999-01");
    expect(future.status).toBe(400);
    expect((future.body as { code: string }).code).toBe("REPORT_MONTH_OUT_OF_RANGE");
    expect(((await report("2000-01")).body as { code: string }).code).toBe("REPORT_MONTH_OUT_OF_RANGE");
    expect((await report("2026-13")).status).toBe(400);
    expect((await report(prevMonth, "not-a-uuid")).status).toBe(400);
    expect((await report(prevMonth, "00000000-0000-4000-8000-000000000000")).status).toBe(404);
  });
});

describe("client report", () => {
  const report = async (month = curMonth, id = clientId) => get(`/api/v1/reports/client?clientId=${id}&month=${month}`);

  it("counts events, stage moves, comments (with reply time), to-dos and assets for the month", async () => {
    const res = await report();
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const r = res.body as ClientReport;
    expect(r.client).toMatchObject({ clientId, name: `RPT ${stamp} Cafe`, ownerId: manager.id, ownerName: `RPT${stamp} Manager` });
    expect(r.events.total).toBe(2);
    expect(r.events.byState).toMatchObject({ active: 1, cancelled: 1, postponed: 0 });
    expect(r.events.byType).toMatchObject({ shoot: 1, meeting: 1, campaign: 0 });
    expect(r.stageMoves).toBe(2);
    expect(r.comments).toMatchObject({ received: 3, solved: 1, replied: 2, avgFirstReplyHours: 3 });
    expect(r.comments.byStatus).toMatchObject({ received: 1, in_progress: 1, solved: 1 });
    expect(r.todos).toEqual({ done: 2, open: 2 });
    expect(r.assetsAdded).toBe(2);
  });

  it("the previous month shows only what belongs to it", async () => {
    const r = (await report(prevMonth)).body as ClientReport;
    expect(r.events.total).toBe(1);
    expect(r.stageMoves).toBe(0);
    expect(r.comments).toMatchObject({ received: 1, solved: 1, replied: 1, avgFirstReplyHours: 24 });
    expect(r.todos).toEqual({ done: 1, open: 2 });
    expect(r.assetsAdded).toBe(1);
  });

  it("a quiet month is zeros with a null reply time", async () => {
    const r = (await report(allowedMonths(new Date(), tz)[5])).body as ClientReport;
    expect(r.events.total).toBe(0);
    expect(r.comments).toMatchObject({ received: 0, replied: 0, avgFirstReplyHours: null });
  });

  it("refuses a bad month and answers 404 for an unknown client", async () => {
    expect(((await report("2999-01")).body as { code: string }).code).toBe("REPORT_MONTH_OUT_OF_RANGE");
    expect((await report(curMonth, "00000000-0000-4000-8000-000000000000")).status).toBe(404);
    expect((await report(curMonth, "nope")).status).toBe(400);
  });
});
