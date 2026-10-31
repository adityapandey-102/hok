import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";
import { db } from "../../src/common/database/drizzle-client";
import { eq } from "drizzle-orm";
import { profiles } from "../../src/modules/users/infrastructure/profile.schema";
import { bearerFor, closeDb, createFixtureUser, deleteClientsOwnedBy, deleteFixtureUser, deleteStageTemplates, type FixtureUser } from "./helpers";

/**
 * M5 end to end: personal entries (owner-only, client link must be the
 * owner's, version, delete), the merged calendar feed (scope, merge order,
 * filters, range cap) and the team-members lookup. Needs migration
 * 20261014300001 applied.
 */
const app = createApp();
let admin: FixtureUser;
let smm: FixtureUser;
let mm: FixtureUser;
let editor: FixtureUser;
const auth: Record<string, string> = {};
const templateIds: string[] = [];
let smmClient: string;
let mmClient: string;
const stamp = Date.now();
const as = (role: string, r: request.Test) => r.set("Authorization", auth[role]!);
type Body = Record<string, unknown>;

beforeAll(async () => {
  admin = await createFixtureUser("admin", "IT Cal Admin");
  smm = await createFixtureUser("social_media_manager", "IT Cal SMM");
  mm = await createFixtureUser("marketing_manager", "IT Cal MM");
  editor = await createFixtureUser("editor", "IT Cal Editor");
  for (const u of [admin, smm, mm, editor]) auth[u.role] = await bearerFor(u);
  // The SMM works in London: personal entries default to that zone.
  await db.update(profiles).set({ timeZone: "Europe/London" }).where(eq(profiles.id, smm.id));
  auth.social_media_manager = await bearerFor(smm);

  smmClient = ((await as("social_media_manager", request(app).post("/api/v1/clients")).send({ businessName: `IT Cal SMM Client ${stamp}` })).body as { client: { id: string } }).client.id;
  mmClient = ((await as("marketing_manager", request(app).post("/api/v1/clients")).send({ businessName: `IT Cal MM Client ${stamp}` })).body as { client: { id: string } }).client.id;
  const t = await as("admin", request(app).post("/api/v1/stage-templates")).send({ name: `IT Cal Tpl ${stamp}`, stages: ["Planned", "Done"] });
  const templateId = (t.body as { template: { id: string } }).template.id;
  templateIds.push(templateId);
  for (const [role, clientId, title, startsAt] of [
    ["social_media_manager", smmClient, "IT Cal SMM shoot", "2032-03-05T10:00:00Z"],
    ["marketing_manager", mmClient, "IT Cal MM meeting", "2032-03-06T10:00:00Z"],
  ] as const) {
    const r = await as(role, request(app).post("/api/v1/events")).send({ clientId, templateId, title, type: "shoot", startsAt, endsAt: "2032-03-06T18:00:00Z" });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
  }
});

afterAll(async () => {
  const owners = [admin, smm, mm, editor].filter(Boolean).map((u) => u.id);
  await deleteClientsOwnedBy(owners);
  await deleteStageTemplates(templateIds);
  for (const id of owners) await deleteFixtureUser(id); // personal entries cascade
  await closeDb();
});

async function createPersonal(role: string, body: Body = {}) {
  const r = await as(role, request(app).post("/api/v1/personal-events")).send({
    title: "IT Cal planning",
    startsAt: "2032-03-04T09:00:00Z",
    endsAt: "2032-03-04T10:00:00Z",
    ...body,
  });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return (r.body as { personalEvent: Body & { id: string; version: number } }).personalEvent;
}

describe("personal events", () => {
  it("belong to the caller, default to their zone, and can link only their own client", async () => {
    const p = await createPersonal("social_media_manager", { clientId: smmClient });
    expect(p).toMatchObject({ ownerId: smm.id, ownerName: "IT Cal SMM", timeZone: "Europe/London", clientId: smmClient, clientName: `IT Cal SMM Client ${stamp}`, version: 1 });
    const foreign = await as("social_media_manager", request(app).post("/api/v1/personal-events")).send({ title: "x", startsAt: "2032-03-04T09:00:00Z", endsAt: "2032-03-04T10:00:00Z", clientId: mmClient });
    expect([foreign.status, (foreign.body as { code: string }).code]).toEqual([404, "CLIENT_NOT_FOUND"]);
  });

  it("are private: another manager gets 404; the Admin can read; task-only staff 403", async () => {
    const p = await createPersonal("social_media_manager");
    expect((await as("marketing_manager", request(app).get(`/api/v1/personal-events/${p.id}`))).status).toBe(404);
    expect((await as("marketing_manager", request(app).delete(`/api/v1/personal-events/${p.id}`))).status).toBe(404);
    expect((await as("admin", request(app).get(`/api/v1/personal-events/${p.id}`))).status).toBe(200);
    expect((await as("editor", request(app).get("/api/v1/personal-events"))).status).toBe(403);
  });

  it("edit with the version (stale is 409), unlink with null, delete", async () => {
    const p = await createPersonal("social_media_manager", { clientId: smmClient });
    const ok = await as("social_media_manager", request(app).patch(`/api/v1/personal-events/${p.id}`)).send({ title: "Moved", clientId: null, version: 1 });
    expect((ok.body as { personalEvent: Body }).personalEvent).toMatchObject({ title: "Moved", clientId: null, version: 2 });
    const stale = await as("social_media_manager", request(app).patch(`/api/v1/personal-events/${p.id}`)).send({ title: "Again", version: 1 });
    expect((stale.body as { code: string }).code).toBe("PERSONAL_EVENT_MODIFIED");
    const bad = await as("social_media_manager", request(app).patch(`/api/v1/personal-events/${p.id}`)).send({ endsAt: "2032-03-04T08:00:00Z", version: 2 });
    expect((bad.body as { code: string }).code).toBe("PERSONAL_EVENT_TIMES_INVALID");
    expect((await as("social_media_manager", request(app).delete(`/api/v1/personal-events/${p.id}`))).status).toBe(204);
    expect((await as("social_media_manager", request(app).get(`/api/v1/personal-events/${p.id}`))).status).toBe(404);
  });
});

describe("GET /calendar", () => {
  const RANGE = "from=2032-03-01T00:00:00Z&to=2032-04-01T00:00:00Z";

  it("a manager sees their clients' events + their own entries, merged by start; never another manager's", async () => {
    const mine = await createPersonal("social_media_manager", { title: "IT Cal SMM private", startsAt: "2032-03-05T08:00:00Z", endsAt: "2032-03-05T09:00:00Z" });
    await createPersonal("marketing_manager", { title: "IT Cal MM private" });
    const res = await as("social_media_manager", request(app).get(`/api/v1/calendar?${RANGE}&ownerId=${mm.id}`));
    expect(res.status).toBe(200);
    const body = res.body as { items: (Body & { kind: string; title: string; startsAt: string })[]; truncated: boolean };
    const titles = body.items.map((i) => i.title);
    expect(titles).toContain("IT Cal SMM shoot");
    expect(titles).toContain("IT Cal SMM private");
    expect(titles).not.toContain("IT Cal MM meeting");
    expect(titles).not.toContain("IT Cal MM private");
    const starts = body.items.map((i) => i.startsAt);
    expect([...starts].sort()).toEqual(starts);
    expect(body.items.find((i) => i.id === mine.id)).toMatchObject({ kind: "personal", ownerId: smm.id });
    expect(body.items.find((i) => i.title === "IT Cal SMM shoot")).toMatchObject({ kind: "event", eventType: "shoot", currentStageName: "Planned", stageCount: 2, clientName: `IT Cal SMM Client ${stamp}` });
    expect(body.truncated).toBe(false);
  });

  it("the Admin sees every event; ownerId narrows events and switches the personal entries to that owner", async () => {
    const all = (await as("admin", request(app).get(`/api/v1/calendar?${RANGE}&include=events`))).body as { items: { title: string }[] };
    expect(all.items.map((i) => i.title)).toEqual(expect.arrayContaining(["IT Cal SMM shoot", "IT Cal MM meeting"]));
    const mmView = (await as("admin", request(app).get(`/api/v1/calendar?${RANGE}&ownerId=${mm.id}`))).body as { items: { title: string; ownerId: string }[] };
    expect(mmView.items.length).toBeGreaterThan(0);
    expect(mmView.items.every((i) => i.ownerId === mm.id)).toBe(true);
  });

  it("filters: clientId, eventType (drops personal entries), include=personal", async () => {
    const byClient = (await as("social_media_manager", request(app).get(`/api/v1/calendar?${RANGE}&clientId=${smmClient}&include=events`))).body as { items: { clientId: string }[] };
    expect(byClient.items.every((i) => i.clientId === smmClient)).toBe(true);
    const shoots = (await as("social_media_manager", request(app).get(`/api/v1/calendar?${RANGE}&eventType=shoot`))).body as { items: { kind: string }[] };
    expect(shoots.items.every((i) => i.kind === "event")).toBe(true);
    const personal = (await as("social_media_manager", request(app).get(`/api/v1/calendar?${RANGE}&include=personal`))).body as { items: { kind: string }[] };
    expect(personal.items.length).toBeGreaterThan(0);
    expect(personal.items.every((i) => i.kind === "personal")).toBe(true);
  });

  it("requires a range of at most 92 days; task-only staff 403", async () => {
    expect((await as("admin", request(app).get("/api/v1/calendar"))).status).toBe(400);
    const wide = await as("admin", request(app).get("/api/v1/calendar?from=2032-01-01T00:00:00Z&to=2032-06-01T00:00:00Z"));
    expect((wide.body as { code: string }).code).toBe("CALENDAR_RANGE_INVALID");
    expect((await as("editor", request(app).get(`/api/v1/calendar?${RANGE}`))).status).toBe(403);
  });
});

describe("GET /team-members", () => {
  it("managers get active staff as { id, fullName, role } only; task-only staff 403", async () => {
    const res = await as("social_media_manager", request(app).get(`/api/v1/team-members?search=IT%20Cal&limit=100`));
    expect(res.status).toBe(200);
    const members = (res.body as { members: Body[] }).members;
    expect(members.map((m) => m.fullName)).toEqual(expect.arrayContaining(["IT Cal Admin", "IT Cal Editor", "IT Cal MM", "IT Cal SMM"]));
    for (const m of members) expect(Object.keys(m).sort()).toEqual(["fullName", "id", "role"]);
    const editors = (await as("marketing_manager", request(app).get(`/api/v1/team-members?search=IT%20Cal&role=editor`))).body as { members: Body[] };
    expect(editors.members.map((m) => m.id)).toEqual([editor.id]);
    expect((await as("editor", request(app).get("/api/v1/team-members"))).status).toBe(403);
  });

  it("leaves out deactivated accounts", async () => {
    const gone = await createFixtureUser("developer", `IT Cal Gone ${stamp}`);
    try {
      await db.update(profiles).set({ active: false }).where(eq(profiles.id, gone.id));
      const res = await as("admin", request(app).get(`/api/v1/team-members?search=${encodeURIComponent(`IT Cal Gone ${stamp}`)}`));
      expect((res.body as { total: number }).total).toBe(0);
    } finally {
      await deleteFixtureUser(gone.id);
    }
  });
});
