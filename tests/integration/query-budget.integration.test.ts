import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";
import { db } from "../../src/common/database/drizzle-client";
import { clients } from "../../src/modules/clients/infrastructure/clients.schema";
import { eventStages, events } from "../../src/modules/events/infrastructure/events.schema";
import { bearerFor, closeDb, createFixtureUser, deleteClientsOwnedBy, deleteFixtureUser, type FixtureUser } from "./helpers";

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
    (pool as unknown as { query: (...args: unknown[]) => Promise<unknown> }).query = (...args: unknown[]) => {
      count += 1;
      return original(...args);
    };
  });

  afterAll(async () => {
    (pool as unknown as { query: typeof original }).query = original;
    if (admin) {
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
  ];

  for (const [name, path] of lists) {
    it(`${name}: a page of 50 costs no more queries than a page of 5`, async () => {
      const small = await queriesFor(path(5));
      const big = await queriesFor(path(50));
      expect(big, `${name}: ${small} queries for 5 rows, ${big} for 50`).toBe(small);
      expect(small).toBeLessThanOrEqual(4); // auth profile + page + total
    });
  }

  it("list page sizes are capped (an over-large limit is clamped, never honoured)", async () => {
    const users = await request(app).get("/api/v1/users?limit=100000").set("Authorization", auth);
    expect((users.body as { limit: number }).limit).toBeLessThanOrEqual(100);
    const clientsPage = await request(app).get("/api/v1/clients?limit=100000").set("Authorization", auth);
    expect((clientsPage.body as { limit: number }).limit).toBeLessThanOrEqual(100);
    const eventsPage = await request(app).get("/api/v1/events?limit=100000").set("Authorization", auth);
    expect((eventsPage.body as { limit: number }).limit).toBeLessThanOrEqual(200);
  });
});
