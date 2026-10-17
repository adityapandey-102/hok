import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";
import { db } from "../../src/common/database/drizzle-client";
import { clients } from "../../src/modules/clients/infrastructure/clients.schema";
import { eventStages, events } from "../../src/modules/events/infrastructure/events.schema";
import { personalEvents } from "../../src/modules/personal-events/infrastructure/personal-events.schema";
import { assetTags, assets, tags } from "../../src/modules/assets/infrastructure/assets.schema";
import { clientComments } from "../../src/modules/client-comments/infrastructure/client-comments.schema";
import { staffTasks } from "../../src/modules/staff-tasks/infrastructure/staff-tasks.schema";
import { bearerFor, closeDb, createFixtureUser, deleteClientsOwnedBy, deleteFixtureUser, deleteStaffTasksFor, type FixtureUser } from "./helpers";

/**
 * Query budget: every list endpoint makes the SAME number of database queries
 * for a page of 5 as for a page of 50 (no N+1 -- one query per row would make
 * the second number ~10x the first), and every list caps its page size so no
 * request can pull an unbounded result. needleye's check, started in M2 with
 * the first list (users); every later list endpoint is added to `lists`
 * (M3: clients; M4: stage templates and events, migration 20261013000004).
 *
 * Counts queries at the connection pool, so it catches an N+1 in any layer
 * (service loops as well as repository ones).
 */
describe("query budget: no N+1, bounded pages (integration)", () => {
  const app = createApp();
  let admin: FixtureUser;
  let auth: string;
  let count = 0;
  // Staff tasks (M7, migration 20261014200001): its lists are skipped until that migration is applied,
  // so this file stays green for everyone else in the meantime.
  let staffTasksReady = false;
  // M5: personal events (migration 20261014300001); entries skip until it's applied.
  let personalReady = false;
  let firstClientId = "";
  const pool = db.$client;
  const original = pool.query.bind(pool) as (...args: unknown[]) => Promise<unknown>;

  beforeAll(async () => {
    admin = await createFixtureUser("admin", "Query Budget Admin");
    auth = await bearerFor(admin);
    // Enough clients that a page of 50 really returns more rows than a page of 5.
    const qbClients = await db
      .insert(clients)
      .values(Array.from({ length: 12 }, (_, i) => ({ ownerId: admin.id, businessName: `QB Client ${i}`, industry: "Budget", timeZone: "Asia/Kolkata" })))
      .returning({ id: clients.id });
    // ...and 12 events (one per client, two stages each) inside a known range, for the events lists.
    for (const [i, c] of qbClients.entries()) {
      const start = new Date(Date.UTC(2031, 0, 1 + i, 10));
      const [e] = await db
        .insert(events)
        .values({ clientId: c.id, title: `QB Event ${i}`, type: "shoot", startsAt: start, endsAt: new Date(start.getTime() + 3600_000), timeZone: "UTC", templateName: "QB", stageCount: 2 })
        .returning({ id: events.id });
      const [first] = await db.insert(eventStages).values([{ eventId: e!.id, position: 1, name: "A" }, { eventId: e!.id, position: 2, name: "B" }]).returning({ id: eventStages.id });
      await db.update(events).set({ currentStageId: first!.id }).where(eq(events.id, e!.id));
    }
    // ...and 12 asset links (two tags each) under the first client, for the assets lists.
    const qbTags = await db.insert(tags).values([{ clientId: qbClients[0]!.id, name: "QBTag" }, { clientId: qbClients[0]!.id, name: "QBOther" }]).returning({ id: tags.id });
    const qbAssets = await db
      .insert(assets)
      .values(Array.from({ length: 12 }, (_, i) => ({ clientId: qbClients[0]!.id, title: `QB Asset ${i}`, url: `https://example.test/qb/${i}`, type: "photo" as const, comment: "budget", createdBy: admin.id })))
      .returning({ id: assets.id });
    await db.insert(assetTags).values(qbAssets.flatMap((a) => qbTags.map((t) => ({ assetId: a.id, tagId: t.id }))));
    // ...and 12 client comments (half linked to an event) spread over the clients, for the comment inbox.
    firstClientId = qbClients[0]!.id;
    await db.insert(clientComments).values(Array.from({ length: 12 }, (_, i): typeof clientComments.$inferInsert => ({ clientId: qbClients[i % qbClients.length]!.id, body: `QB comment ${i}`, status: i % 3 === 0 ? "in_progress" : "received" })));
    // ...and 12 staff tasks assigned to the admin fixture (half linked to a client, half overdue), for the task lists.
    const probe = await db.execute(sql`select to_regclass('public.staff_tasks') is not null as ok`);
    staffTasksReady = (probe.rows[0] as { ok: boolean } | undefined)?.ok === true;
    if (staffTasksReady) await db.insert(staffTasks).values(
      Array.from({ length: 12 }, (_, i) => ({
        title: `QB Task ${i}`,
        assigneeId: admin.id,
        assignedBy: admin.id,
        clientId: i % 2 === 0 ? qbClients[0]!.id : null,
        dueAt: new Date(Date.UTC(i % 2 === 0 ? 2020 : 2099, 0, 1 + i)),
        priority: "high" as const,
      })),
    );
    (pool as unknown as { query: (...args: unknown[]) => Promise<unknown> }).query = (...args: unknown[]) => {
      count += 1;
      return original(...args);
    };
  });

  // M5: 12 personal entries for the fixture admin in Jan 2031 (they cascade away with the admin).
  beforeAll(async () => {
    const probe = await db.execute(sql`select to_regclass('public.personal_events') is not null as ok`);
    personalReady = (probe.rows[0] as { ok: boolean } | undefined)?.ok === true;
    if (!personalReady) return;
    await db.insert(personalEvents).values(
      Array.from({ length: 12 }, (_, i) => {
        const start = new Date(Date.UTC(2031, 0, 1 + i, 14));
        return { ownerId: admin.id, title: `QB Personal ${i}`, startsAt: start, endsAt: new Date(start.getTime() + 1800_000), timeZone: "UTC" };
      }),
    );
  });

  afterAll(async () => {
    (pool as unknown as { query: typeof original }).query = original;
    if (admin) {
      if (staffTasksReady) await deleteStaffTasksFor([admin.id]);
      await deleteClientsOwnedBy([admin.id]);
      await deleteFixtureUser(admin.id);
    }
    await closeDb();
  });

  async function queriesFor(path: string): Promise<number> {
    count = 0;
    const res = await request(app).get(path).set("Authorization", auth);
    expect(res.status, `${path} -> ${res.status}`).toBe(200);
    return count;
  }

  const lists: [string, (limit: number) => string][] = [
    ["users", (l) => `/api/v1/users?limit=${l}`],
    ["users search", (l) => `/api/v1/users?search=a&limit=${l}`],
    ["clients", (l) => `/api/v1/clients?limit=${l}`],
    ["clients search", (l) => `/api/v1/clients?search=QB&limit=${l}`],
    ["clients by owner + industry", (l) => `/api/v1/clients?ownerId=${admin.id}&industry=budget&limit=${l}`],
    ["clients archived", (l) => `/api/v1/clients?status=archived&limit=${l}`],
    ["stage templates", (l) => `/api/v1/stage-templates?limit=${l}`],
    ["events", (l) => `/api/v1/events?limit=${l}`],
    ["events calendar range", (l) => `/api/v1/events?from=2031-01-01T00:00:00Z&to=2031-02-01T00:00:00Z&limit=${l}`],
    ["events by owner + search", (l) => `/api/v1/events?ownerId=${admin.id}&search=QB&limit=${l}`],
    ["personal events", (l) => `/api/v1/personal-events?limit=${l}`],
    ["personal events range + owner", (l) => `/api/v1/personal-events?ownerId=${admin.id}&from=2031-01-01T00:00:00Z&to=2031-02-01T00:00:00Z&limit=${l}`],
    ["team members", (l) => `/api/v1/team-members?limit=${l}`],
    ["team members search + role", (l) => `/api/v1/team-members?search=a&role=admin&limit=${l}`],
    ["assets", (l) => `/api/v1/assets?limit=${l}`],
    ["assets search + type", (l) => `/api/v1/assets?search=QB&type=photo&limit=${l}`],
    ["assets by tag + date range", (l) => `/api/v1/assets?tag=qbtag&from=2020-01-01T00:00:00Z&to=2099-01-01T00:00:00Z&limit=${l}`],
    ["assets tag suggestions", (l) => `/api/v1/assets/tags?q=QB&limit=${l}`],
    ["client comments inbox", (l) => `/api/v1/client-comments?limit=${l}`],
    ["client comments by client + status", (l) => `/api/v1/client-comments?clientId=${firstClientId}&status=received&limit=${l}`],
    ["client comments search", (l) => `/api/v1/client-comments?search=QB&limit=${l}`],
    ["notifications", (l) => `/api/v1/notifications?limit=${l}`],
    ["notifications unread", (l) => `/api/v1/notifications?unread=true&limit=${l}`],
    ["dashboard team workload", (l) => `/api/v1/dashboard/team?limit=${l}`],
    ["dashboard team workload search + role", (l) => `/api/v1/dashboard/team?search=a&role=editor&limit=${l}`],
    ["staff tasks", (l) => `/api/v1/staff-tasks?limit=${l}`],
    ["staff tasks by assignee + search + priority", (l) => `/api/v1/staff-tasks?assigneeId=${admin.id}&search=QB&priority=high&limit=${l}`],
    ["staff tasks by role + overdue", (l) => `/api/v1/staff-tasks?role=admin&overdue=true&limit=${l}`],
    ["staff tasks open + due range", (l) => `/api/v1/staff-tasks?open=true&dueFrom=2000-01-01T00:00:00Z&dueTo=2100-01-01T00:00:00Z&limit=${l}`],
  ];

  for (const [name, path] of lists) {
    it(`${name}: a page of 50 costs no more queries than a page of 5`, async (ctx) => {
      if (name.startsWith("staff tasks") && !staffTasksReady) ctx.skip();
      if (name.startsWith("personal events") && !personalReady) ctx.skip();
      const small = await queriesFor(path(5));
      const big = await queriesFor(path(50));
      expect(big, `${name}: ${small} queries for 5 rows, ${big} for 50`).toBe(small);
      expect(small).toBeLessThanOrEqual(4); // auth profile + page + total
    });
  }

  // M5: the calendar feed is range-capped, not paged: a month costs the same queries as a day
  // (auth profile + one query per kind, in parallel), however many items fall in it.
  it("calendar feed: a 31-day range costs no more queries than a 1-day range", async (ctx) => {
    if (!personalReady) ctx.skip();
    const day = await queriesFor("/api/v1/calendar?from=2031-01-01T00:00:00Z&to=2031-01-02T00:00:00Z");
    const month = await queriesFor("/api/v1/calendar?from=2031-01-01T00:00:00Z&to=2031-02-01T00:00:00Z");
    expect(month, `calendar: ${day} queries for a day, ${month} for a month`).toBe(day);
    expect(day).toBeLessThanOrEqual(3);
  });

  // M10: the dashboard is aggregates + capped lists. The fixture Admin owns 12 clients, events and
  // comments, yet the count is fixed: auth profile + 5 firm reads on the overview, auth profile +
  // 7 reads (3 own tasks, 4 own clients) on "My clients".
  it("dashboard: a fixed number of queries, whatever the data", async (ctx) => {
    if (!staffTasksReady) ctx.skip();
    expect(await queriesFor("/api/v1/dashboard")).toBe(6);
    expect(await queriesFor("/api/v1/dashboard?view=mine")).toBe(8);
  });

  it("list page sizes are capped (an over-large limit is clamped, never honoured)", async () => {
    const users = await request(app).get("/api/v1/users?limit=100000").set("Authorization", auth);
    expect((users.body as { limit: number }).limit).toBeLessThanOrEqual(100);
    const clientsPage = await request(app).get("/api/v1/clients?limit=100000").set("Authorization", auth);
    expect((clientsPage.body as { limit: number }).limit).toBeLessThanOrEqual(100);
    const eventsPage = await request(app).get("/api/v1/events?limit=100000").set("Authorization", auth);
    expect((eventsPage.body as { limit: number }).limit).toBeLessThanOrEqual(200);
    const assetsPage = await request(app).get("/api/v1/assets?limit=100000").set("Authorization", auth);
    expect((assetsPage.body as { limit: number }).limit).toBeLessThanOrEqual(100);
    if (!staffTasksReady) return;
    const tasksPage = await request(app).get("/api/v1/staff-tasks?limit=100000").set("Authorization", auth);
    expect((tasksPage.body as { limit: number }).limit).toBeLessThanOrEqual(100);
  });
});
