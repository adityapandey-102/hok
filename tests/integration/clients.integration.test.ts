import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { and, desc, eq } from "drizzle-orm";
import { createApp } from "../../src/app";
import { db } from "../../src/common/database/drizzle-client";
import { auditLog } from "../../src/common/audit/audit-log.schema";
import { profiles } from "../../src/modules/users/infrastructure/profile.schema";
import { clients } from "../../src/modules/clients/infrastructure/clients.schema";
import { bearerFor, closeDb, createFixtureUser, deleteClientsOwnedBy, deleteFixtureUser, type FixtureUser } from "./helpers";

/**
 * The Clients module end to end (REQUIREMENTS §5.2): real app, real auth,
 * real Postgres. Row scope (a manager's other-owner lookups are 404s),
 * create/edit with validation and the optimistic lock, archive/unarchive and
 * the default list hiding archived clients, the Admin's owner filter and
 * reassign (with its audit row), and the database's own constraints.
 *
 * Needs migration 20261013000003_clients.sql applied.
 */
const app = createApp();
let admin: FixtureUser;
let smm: FixtureUser;
let mm: FixtureUser;
let editor: FixtureUser;
const auth: Record<string, string> = {};

interface ClientBody {
  id: string;
  ownerId: string;
  ownerName: string;
  status: string;
  version: number;
  archivedAt: string | null;
  [key: string]: unknown;
}

beforeAll(async () => {
  admin = await createFixtureUser("admin", "IT Clients Admin");
  smm = await createFixtureUser("social_media_manager", "IT Clients SMM");
  mm = await createFixtureUser("marketing_manager", "IT Clients MM");
  editor = await createFixtureUser("editor", "IT Clients Editor");
  for (const u of [admin, smm, mm, editor]) auth[u.role] = await bearerFor(u);
});

afterAll(async () => {
  const owners = [admin, smm, mm, editor].filter(Boolean).map((u) => u.id);
  await deleteClientsOwnedBy(owners);
  for (const id of owners) await deleteFixtureUser(id);
  await closeDb();
});

async function createAs(role: string, body: Record<string, unknown>): Promise<ClientBody> {
  const res = await request(app).post("/api/v1/clients").set("Authorization", auth[role]!).send(body);
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return (res.body as { client: ClientBody }).client;
}

describe("POST /clients", () => {
  it("creates a client owned by the creator, normalised, active, with the default time zone", async () => {
    const c = await createAs("social_media_manager", {
      businessName: "  IT Acme Bakery ",
      websites: ["acme-bakery.com", "shop.acme-bakery.com"],
      phones: ["+91 98765 43210", "+91 98765 43211"],
      contacts: [{ name: "Priya", phone: "+91 98765 43212" }, { name: "Dev", email: "Dev@Acme.com" }],
      email: "Hello@Acme.COM",
      socialAccounts: [
        { platform: "instagram", handle: "@acmebakery" },
        { platform: "instagram", handle: "@acmebakery_cakes" },
      ],
      services: ["Reels", "reels", "Shoots"],
      contractStart: "2026-01-01",
      contractEnd: "2026-12-31",
    });
    expect(c).toMatchObject({
      ownerId: smm.id,
      ownerName: "IT Clients SMM",
      businessName: "IT Acme Bakery",
      websites: ["https://acme-bakery.com", "https://shop.acme-bakery.com"],
      phones: ["+91 98765 43210", "+91 98765 43211"],
      contacts: [
        { name: "Priya", phone: "+91 98765 43212", email: null },
        { name: "Dev", phone: null, email: "dev@acme.com" },
      ],
      email: "hello@acme.com",
      socialAccounts: [
        { platform: "instagram", handle: "@acmebakery" },
        { platform: "instagram", handle: "@acmebakery_cakes" },
      ],
      services: ["Reels", "Shoots"],
      contractStart: "2026-01-01",
      contractEnd: "2026-12-31",
      status: "active",
      archivedAt: null,
      version: 1,
    });
    expect(typeof c.timeZone).toBe("string");
  });

  it("validates fields (time zone, links, handles, dates) with 400s", async () => {
    const bad = async (body: Record<string, unknown>) =>
      (await request(app).post("/api/v1/clients").set("Authorization", auth.social_media_manager!).send({ businessName: "X", ...body })).body as {
        code: string;
      };
    expect((await bad({ timeZone: "+05:30" })).code).toBe("VALIDATION_ERROR");
    expect((await bad({ logoUrl: "javascript:alert(1)" })).code).toBe("VALIDATION_ERROR");
    expect((await bad({ socialAccounts: [{ platform: "myspace", handle: "@x" }] })).code).toBe("VALIDATION_ERROR");
    expect((await bad({ contacts: [{ name: "" }] })).code).toBe("VALIDATION_ERROR");
    expect((await bad({ contractStart: "2026-06-01", contractEnd: "2026-05-01" })).code).toBe("CLIENT_CONTRACT_DATES_INVALID");
  });

  it("lets the Admin create for a manager, refuses task-only targets, and refuses a manager naming someone else", async () => {
    const forMm = await createAs("admin", { businessName: "IT Admin-made for MM", ownerId: mm.id });
    expect(forMm.ownerId).toBe(mm.id);

    const toEditor = await request(app).post("/api/v1/clients").set("Authorization", auth.admin!).send({ businessName: "X", ownerId: editor.id });
    expect([toEditor.status, (toEditor.body as { code: string }).code]).toEqual([400, "CLIENT_OWNER_INVALID"]);

    const smmForMm = await request(app).post("/api/v1/clients").set("Authorization", auth.social_media_manager!).send({ businessName: "X", ownerId: mm.id });
    expect([smmForMm.status, (smmForMm.body as { code: string }).code]).toEqual([403, "CLIENT_OWNER_FORBIDDEN"]);
  });

  it("is 403 for task-only staff", async () => {
    const res = await request(app).post("/api/v1/clients").set("Authorization", auth.editor!).send({ businessName: "X" });
    expect(res.status).toBe(403);
  });
});

describe("row scope", () => {
  it("a manager lists only their own clients (an ownerId filter is ignored); the Admin can filter by owner", async () => {
    await createAs("social_media_manager", { businessName: "IT Scope SMM" });
    await createAs("marketing_manager", { businessName: "IT Scope MM" });

    const smmList = await request(app).get(`/api/v1/clients?ownerId=${mm.id}&limit=100`).set("Authorization", auth.social_media_manager!);
    expect(smmList.status).toBe(200);
    const smmRows = (smmList.body as { clients: ClientBody[] }).clients;
    expect(smmRows.length).toBeGreaterThan(0);
    expect(smmRows.every((c) => c.ownerId === smm.id)).toBe(true);

    const adminByMm = await request(app).get(`/api/v1/clients?ownerId=${mm.id}&limit=100`).set("Authorization", auth.admin!);
    const adminRows = (adminByMm.body as { clients: ClientBody[] }).clients;
    expect(adminRows.length).toBeGreaterThan(0);
    expect(adminRows.every((c) => c.ownerId === mm.id)).toBe(true);
  });

  it("another manager's client is 404 on read and on every write -- never 403", async () => {
    const c = await createAs("marketing_manager", { businessName: "IT Private MM" });
    const as = (req: request.Test) => req.set("Authorization", auth.social_media_manager!);
    const expect404 = (res: request.Response) => expect([res.status, (res.body as { code: string }).code]).toEqual([404, "CLIENT_NOT_FOUND"]);
    expect404(await as(request(app).get(`/api/v1/clients/${c.id}`)));
    expect404(await as(request(app).patch(`/api/v1/clients/${c.id}`).send({ notes: "x", version: 1 })));
    expect404(await as(request(app).patch(`/api/v1/clients/${c.id}`).send({ notes: "x", version: 99 })));
    expect404(await as(request(app).post(`/api/v1/clients/${c.id}/archive`).send({})));
    // ...and the Admin sees it.
    expect((await request(app).get(`/api/v1/clients/${c.id}`).set("Authorization", auth.admin!)).status).toBe(200);
  });

  it("a non-UUID id is 404 before any query; task-only staff get 403 on the list", async () => {
    expect((await request(app).get("/api/v1/clients/abc").set("Authorization", auth.admin!)).status).toBe(404);
    expect((await request(app).get("/api/v1/clients").set("Authorization", auth.editor!)).status).toBe(403);
  });
});

describe("PATCH /clients/:id (optimistic lock)", () => {
  it("edits with the current version, then refuses the stale one with 409 CLIENT_MODIFIED", async () => {
    const c = await createAs("social_media_manager", { businessName: "IT Lock" });
    const first = await request(app)
      .patch(`/api/v1/clients/${c.id}`)
      .set("Authorization", auth.social_media_manager!)
      .send({ notes: "first", status: "paused", phones: ["+91 98765 43210"], version: 1 });
    expect(first.status).toBe(200);
    expect((first.body as { client: ClientBody }).client).toMatchObject({ notes: "first", status: "paused", version: 2 });

    const stale = await request(app).patch(`/api/v1/clients/${c.id}`).set("Authorization", auth.social_media_manager!).send({ notes: "second", version: 1 });
    expect([stale.status, (stale.body as { code: string }).code]).toEqual([409, "CLIENT_MODIFIED"]);
  });

  it("requires a version and at least one field; refuses status: archived", async () => {
    const c = await createAs("social_media_manager", { businessName: "IT Patch rules" });
    const send = (body: object) => request(app).patch(`/api/v1/clients/${c.id}`).set("Authorization", auth.social_media_manager!).send(body);
    expect((await send({ notes: "x" })).status).toBe(400);
    expect(((await send({ version: 1 })).body as { code: string }).code).toBe("VALIDATION_NO_FIELDS");
    expect((await send({ status: "archived", version: 1 })).status).toBe(400);
  });

  it("checks contract dates against the stored ones", async () => {
    const c = await createAs("social_media_manager", { businessName: "IT Dates", contractStart: "2026-06-01" });
    const res = await request(app).patch(`/api/v1/clients/${c.id}`).set("Authorization", auth.social_media_manager!).send({ contractEnd: "2026-05-01", version: 1 });
    expect((res.body as { code: string }).code).toBe("CLIENT_CONTRACT_DATES_INVALID");
  });
});

describe("archive / unarchive", () => {
  it("archiving hides the client from the default list; status=archived shows it; edits are refused until unarchived", async () => {
    const c = await createAs("social_media_manager", { businessName: `IT Archive ${Date.now()}` });
    const search = encodeURIComponent(c.businessName as string);

    // Archiving is the Admin's; the team member who made it can't.
    const byMember = await request(app).post(`/api/v1/clients/${c.id}/archive`).set("Authorization", auth.social_media_manager!).send({ version: 1 });
    expect([byMember.status, (byMember.body as { code: string }).code]).toEqual([403, "CLIENT_ADMIN_ONLY"]);
    const archived = await request(app).post(`/api/v1/clients/${c.id}/archive`).set("Authorization", auth.admin!).send({ version: 1 });
    expect(archived.status).toBe(200);
    expect((archived.body as { client: ClientBody }).client).toMatchObject({ status: "archived", version: 2 });
    expect((archived.body as { client: ClientBody }).client.archivedAt).not.toBeNull();

    const active = await request(app).get(`/api/v1/clients?search=${search}`).set("Authorization", auth.social_media_manager!);
    expect((active.body as { total: number }).total).toBe(0);
    const onlyArchived = await request(app).get(`/api/v1/clients?status=archived&search=${search}`).set("Authorization", auth.social_media_manager!);
    expect((onlyArchived.body as { total: number }).total).toBe(1);

    const edit = await request(app).patch(`/api/v1/clients/${c.id}`).set("Authorization", auth.social_media_manager!).send({ notes: "x", version: 2 });
    expect((edit.body as { code: string }).code).toBe("CLIENT_ARCHIVED");
    const again = await request(app).post(`/api/v1/clients/${c.id}/archive`).set("Authorization", auth.admin!).send({});
    expect((again.body as { code: string }).code).toBe("CLIENT_ARCHIVED");

    const back = await request(app).post(`/api/v1/clients/${c.id}/unarchive`).set("Authorization", auth.admin!).send({});
    expect((back.body as { client: ClientBody }).client).toMatchObject({ status: "active", archivedAt: null, version: 3 });
    const notArchived = await request(app).post(`/api/v1/clients/${c.id}/unarchive`).set("Authorization", auth.admin!).send({});
    expect((notArchived.body as { code: string }).code).toBe("CLIENT_NOT_ARCHIVED");
  });
});

describe("PUT /clients/:id/team (Admin)", () => {
  const setTeam = (id: unknown, body: object, role = "admin") => request(app).put(`/api/v1/clients/${String(id)}/team`).set("Authorization", auth[role]!).send(body);

  it("adds a second manager: both see the client, the team lists the lead first, and an audit row records the change", async () => {
    const c = await createAs("social_media_manager", { businessName: "IT Team" });
    const res = await setTeam(c.id, { leadId: smm.id, memberIds: [mm.id], version: 1 });
    expect(res.status).toBe(200);
    const client = (res.body as { client: ClientBody & { team: { id: string; isLead: boolean }[] } }).client;
    expect(client).toMatchObject({ ownerId: smm.id, version: 2 });
    expect(client.team.map((m) => [m.id, m.isLead])).toEqual([
      [smm.id, true],
      [mm.id, false],
    ]);

    // Both team members see it -- in the list and by id.
    for (const role of ["social_media_manager", "marketing_manager"]) {
      expect((await request(app).get(`/api/v1/clients/${String(c.id)}`).set("Authorization", auth[role]!)).status, role).toBe(200);
      const list = await request(app).get(`/api/v1/clients?search=${encodeURIComponent("IT Team")}`).set("Authorization", auth[role]!);
      expect((list.body as { clients: { id: string }[] }).clients.some((x) => x.id === c.id), role).toBe(true);
    }

    const [row] = await db
      .select({ actorId: auditLog.actorId, metadata: auditLog.metadata })
      .from(auditLog)
      .where(and(eq(auditLog.action, "client.reassigned"), eq(auditLog.entityId, c.id)))
      .orderBy(desc(auditLog.createdAt))
      .limit(1);
    expect(row).toMatchObject({ actorId: admin.id, metadata: { added: [mm.id], removed: [], leadFrom: smm.id, leadTo: smm.id } });
  });

  it("taking someone off the team takes the client away from them (404); a new lead replaces the old", async () => {
    const c = await createAs("social_media_manager", { businessName: "IT Team move" });
    const res = await setTeam(c.id, { leadId: mm.id, memberIds: [] });
    expect((res.body as { client: ClientBody }).client).toMatchObject({ ownerId: mm.id, ownerName: "IT Clients MM" });
    expect((await request(app).get(`/api/v1/clients/${String(c.id)}`).set("Authorization", auth.social_media_manager!)).status).toBe(404);
    expect((await request(app).get(`/api/v1/clients/${String(c.id)}`).set("Authorization", auth.marketing_manager!)).status).toBe(200);
  });

  it("refuses task-only staff, a deactivated manager, and non-admin callers", async () => {
    const c = await createAs("social_media_manager", { businessName: "IT Team rules" });
    expect(((await setTeam(c.id, { leadId: smm.id, memberIds: [editor.id] })).body as { code: string }).code).toBe("CLIENT_OWNER_INVALID");

    const retired = await createFixtureUser("social_media_manager", "IT Retired SMM");
    try {
      await db.update(profiles).set({ active: false }).where(eq(profiles.id, retired.id));
      expect(((await setTeam(c.id, { leadId: retired.id, memberIds: [] })).body as { code: string }).code).toBe("CLIENT_OWNER_INVALID");
    } finally {
      await deleteFixtureUser(retired.id);
    }

    for (const role of ["social_media_manager", "marketing_manager", "editor"]) {
      expect((await setTeam(c.id, { leadId: mm.id, memberIds: [] }, role)).status, role).toBe(403);
    }
  });
});

describe("GET /clients (paging, filters)", () => {
  it("clamps an over-large limit, refuses a bad status / ownerId, and filters by industry case-insensitively", async () => {
    const big = await request(app).get("/api/v1/clients?limit=100000").set("Authorization", auth.admin!);
    expect((big.body as { limit: number }).limit).toBe(100);
    expect((await request(app).get("/api/v1/clients?status=deleted").set("Authorization", auth.admin!)).status).toBe(400);
    expect((await request(app).get("/api/v1/clients?ownerId=nope").set("Authorization", auth.admin!)).status).toBe(400);

    const industry = `ITIndustry${Date.now()}`;
    await createAs("social_media_manager", { businessName: "IT Industry", industry });
    const res = await request(app).get(`/api/v1/clients?industry=${industry.toLowerCase()}`).set("Authorization", auth.admin!);
    expect((res.body as { total: number }).total).toBe(1);
  });

  it("searches the business name, with LIKE wildcards taken literally", async () => {
    const marker = `Zz${Date.now()}`;
    await createAs("social_media_manager", { businessName: `${marker} 50% Off Store` });
    const hit = await request(app).get(`/api/v1/clients?search=${encodeURIComponent(`${marker} 50%`)}`).set("Authorization", auth.social_media_manager!);
    expect((hit.body as { total: number }).total).toBe(1);
    const wildcard = await request(app).get(`/api/v1/clients?search=${encodeURIComponent(`${marker}%Store`)}`).set("Authorization", auth.social_media_manager!);
    expect((wildcard.body as { total: number }).total).toBe(0);
  });

  it("also finds a client by a contact person's name or its industry, never by JSON keys", async () => {
    const marker = `Kq${Date.now()}`;
    await createAs("social_media_manager", { businessName: "IT Contact Search", industry: `${marker} Dairy`, contacts: [{ name: `${marker} Kabir` }] });
    const find = async (q: string) =>
      ((await request(app).get(`/api/v1/clients?search=${encodeURIComponent(q)}`).set("Authorization", auth.social_media_manager!)).body as { total: number }).total;
    expect(await find(`${marker} Kabir`)).toBe(1);
    expect(await find(`${marker} Dairy`)).toBe(1);
    expect(await find(`${marker} email`)).toBe(0);
  });
});

describe("database constraints (the last line of defence)", () => {
  it("refuses a bad status, an end-before-start contract and an archived row without archived_at", async () => {
    const c = await createAs("social_media_manager", { businessName: "IT Constraints" });
    await expect(db.update(clients).set({ status: "deleted" as never }).where(eq(clients.id, c.id))).rejects.toThrow();
    await expect(db.update(clients).set({ contractStart: "2026-06-01", contractEnd: "2026-05-01" }).where(eq(clients.id, c.id))).rejects.toThrow();
    await expect(db.update(clients).set({ status: "archived" }).where(eq(clients.id, c.id))).rejects.toThrow();
  });
});
